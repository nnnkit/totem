import { useMemo } from "react";
import parse from "html-react-parser";
import type {
  Bookmark,
  ArticleContentBlock,
  ArticleContentEntity,
} from "../../types";
import {
  detectArticleHeadings,
  groupBlocks,
  renderBlockInlineContent,
} from "./utils";
import { RichTextBlock } from "./TweetText";
import { CodeBlock } from "./CodeBlock";
import { cn } from "../../lib/cn";
import { resolveArticleCoverImageUrl } from "../../lib/export/article-cover";

interface ArticleBlockRendererProps {
  blocks: ArticleContentBlock[];
  entityMap: Record<string, ArticleContentEntity>;
}

function uniqueKey(seed: string, seen: Map<string, number>): string {
  const count = seen.get(seed) ?? 0;
  seen.set(seed, count + 1);
  return count === 0 ? seed : `${seed}-${count}`;
}

function blockKeySeed(block: ArticleContentBlock): string {
  const entityKeys = block.entityRanges.map((range) => range.key).join("-");
  return `${block.type}:${block.text.slice(0, 80)}:${entityKeys}`;
}

function ArticleBlockRenderer({ blocks, entityMap }: ArticleBlockRendererProps) {
  const groups = useMemo(() => groupBlocks(blocks), [blocks]);
  const keyedGroups = useMemo(() => {
    const seenGroups = new Map<string, number>();
    let section = 0;

    return groups.map((group) => {
      const blocksInGroup = group.type === "single" ? [group.block] : group.items;
      const seed = `${group.type}:${blocksInGroup.map(blockKeySeed).join("|")}`;
      const key = uniqueKey(seed, seenGroups);
      const sectionId = `section-block-${section}`;
      section += 1;

      if (group.type === "single") {
        return { ...group, key, sectionId };
      }

      const seenItems = new Map<string, number>();
      return {
        ...group,
        key,
        sectionId,
        items: group.items.map((item) => ({
          block: item,
          key: uniqueKey(blockKeySeed(item), seenItems),
        })),
      };
    });
  }, [groups]);

  return (
    <div className="prose prose-lg prose-reader font-serif max-w-none [&_a]:text-accent [&_a:hover]:underline">
      {keyedGroups.map((group) => {
        if (group.type === "unordered-list") {
          return (
            <ul key={group.key} id={group.sectionId}>
              {group.items.map(({ block, key }) => (
                <li key={key}>
                  {parse(renderBlockInlineContent(block, entityMap))}
                </li>
              ))}
            </ul>
          );
        }

        if (group.type === "ordered-list") {
          return (
            <ol key={group.key} id={group.sectionId}>
              {group.items.map(({ block, key }) => (
                <li key={key}>
                  {parse(renderBlockInlineContent(block, entityMap))}
                </li>
              ))}
            </ol>
          );
        }

        const { block } = group;
        const html = renderBlockInlineContent(block, entityMap);

        if (block.type === "atomic") {
          for (const range of block.entityRanges) {
            const entity = entityMap[String(range.key)];
            if (entity?.type === "MEDIA") {
              const imageUrl = entity.data?.imageUrl;
              const videoUrl = entity.data?.videoUrl;
              if (typeof videoUrl === "string" && videoUrl) {
                return (
                  <figure
                    key={group.key}
                    className="-mx-6 my-6 flex justify-center"
                  >
                    <video
                      src={videoUrl}
                      controls
                      playsInline
                      poster={
                        typeof imageUrl === "string" && imageUrl
                          ? imageUrl
                          : undefined
                      }
                      className="h-auto max-h-[72vh] max-w-full min-w-0 rounded bg-gray-950 object-contain"
                    />
                  </figure>
                );
              }
              if (typeof imageUrl === "string" && imageUrl) {
                return (
                  <figure
                    key={group.key}
                    className="-mx-6 my-6 flex justify-center"
                  >
                    <img
                      src={imageUrl}
                      alt=""
                      className="h-auto max-w-full min-w-0 rounded object-cover"
                      loading="lazy"
                    />
                  </figure>
                );
              }
            }
            if (entity?.type === "MARKDOWN") {
              const markdown = String(entity.data?.markdown || "");
              if (markdown) {
                const code = markdown
                  .replace(/^```\w*\n?/, "")
                  .replace(/\n?```$/, "");
                return (
                  <CodeBlock
                    key={group.key}
                    code={code}
                  />
                );
              }
            }
            if (entity?.type === "DIVIDER") {
              return <hr key={group.key} />;
            }
          }
          return null;
        }

        if (!block.text.trim()) {
          return <div key={group.key} className="h-2" />;
        }

        if (block.type === "header-one") {
          return (
            <h2
              key={group.key}
              id={group.sectionId}
              className="scroll-mt-24"
            >
              {parse(html)}
            </h2>
          );
        }

        if (block.type === "header-two") {
          return (
            <h3
              key={group.key}
              id={group.sectionId}
              className="scroll-mt-24"
            >
              {parse(html)}
            </h3>
          );
        }

        if (block.type === "header-three") {
          return (
            <h4
              key={group.key}
              id={group.sectionId}
              className="scroll-mt-24"
            >
              {parse(html)}
            </h4>
          );
        }

        if (block.type === "blockquote") {
          return (
            <blockquote
              key={group.key}
              id={group.sectionId}
              className="break-inside-avoid"
            >
              {parse(html)}
            </blockquote>
          );
        }

        if (block.type === "code-block") {
          return (
            <CodeBlock
              key={group.key}
              code={block.text}
            />
          );
        }

        return (
          <p
            key={group.key}
            id={group.sectionId}
          >
            {parse(html)}
          </p>
        );
      })}
    </div>
  );
}

interface Props {
  article: NonNullable<Bookmark["article"]>;
  compact?: boolean;
  authorProfileImageUrl?: string;
}

export function TweetArticle({ article, compact = false, authorProfileImageUrl }: Props) {
  const plainText = article.plainText?.trim() || "";
  const coverImageUrl = useMemo(
    () => resolveArticleCoverImageUrl(article.coverImageUrl, authorProfileImageUrl),
    [article.coverImageUrl, authorProfileImageUrl],
  );

  const hasBlocks =
    article.contentBlocks !== undefined && article.contentBlocks.length > 0;
  const headings = useMemo(
    () =>
      hasBlocks
        ? []
        : detectArticleHeadings(plainText, {
            articleTitle: article.title?.trim(),
          }),
    [plainText, hasBlocks, article.title],
  );

  const titleClass = "reader-heading mt-6 text-4xl font-bold text-balance text-foreground";

  if (hasBlocks) {
    return (
      <section>
        {coverImageUrl && !compact && (
          <div className="-mx-6 mb-5">
            <img
              src={coverImageUrl}
              alt=""
              className="w-full object-cover"
              loading="lazy"
            />
          </div>
        )}
        {coverImageUrl && compact && (
          <img
            src={coverImageUrl}
            alt=""
            className="mb-5 w-full rounded object-cover"
            loading="lazy"
          />
        )}
        {article.title && (
          <h1
            id="section-article-title"
            className={cn(titleClass, "mb-5")}
          >
            {article.title}
          </h1>
        )}
        <ArticleBlockRenderer
          blocks={article.contentBlocks!}
          entityMap={article.entityMap || {}}
        />
      </section>
    );
  }

  if (headings.length === 0) {
    return (
      <section>
        {coverImageUrl && !compact && (
          <div className="-mx-6 mb-5">
            <img
              src={coverImageUrl}
              alt=""
              className="w-full object-cover"
              loading="lazy"
            />
          </div>
        )}
        {coverImageUrl && compact && (
          <img
            src={coverImageUrl}
            alt=""
            className="mb-5 w-full rounded object-cover"
            loading="lazy"
          />
        )}
        {article.title && (
          <h1 id="section-article-title" className={titleClass}>
            {article.title}
          </h1>
        )}
        <div className="mt-2">
          <RichTextBlock text={plainText} compact={compact} style="article" />
        </div>
      </section>
    );
  }

  const lines: string[] = [];
  for (const line of plainText.split(/\n/)) {
    const trimmed = line.trim();
    if (trimmed) lines.push(trimmed);
  }
  const headingByLineIndex = new Map(
    headings.map((heading, index) => [heading.index, { ...heading, headingIdx: index }]),
  );

  const chunks: { heading?: string; headingIdx: number; text: string }[] = [];
  let currentLines: string[] = [];
  let currentHeading: string | undefined;
  let currentHeadingIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    const heading = headingByLineIndex.get(i);
    if (heading) {
      if (currentLines.length > 0 || currentHeading !== undefined) {
        chunks.push({
          heading: currentHeading,
          headingIdx: currentHeadingIdx,
          text: currentLines.join("\n"),
        });
      }
      currentHeading = heading.text;
      currentHeadingIdx = heading.headingIdx;
      currentLines = [];
    } else {
      currentLines.push(lines[i]);
    }
  }
  if (currentLines.length > 0 || currentHeading !== undefined) {
    chunks.push({
      heading: currentHeading,
      headingIdx: currentHeadingIdx,
      text: currentLines.join("\n"),
    });
  }

  const headingClass =
    "reader-heading text-base font-semibold mt-6 mb-2 text-foreground";

  return (
    <section>
      {coverImageUrl && !compact && (
        <div className="-mx-6 mb-5">
          <img
            src={coverImageUrl}
            alt=""
            className="w-full object-cover"
            loading="lazy"
          />
        </div>
      )}
      {coverImageUrl && compact && (
        <img
          src={coverImageUrl}
          alt=""
          className="mb-5 w-full rounded object-cover"
          loading="lazy"
        />
      )}
      {article.title && (
        <h1 id="section-article-title" className={titleClass}>
          {article.title}
        </h1>
      )}
      <div>
        {chunks.map((chunk) => (
          <div key={`${chunk.heading ?? "intro"}:${chunk.text.slice(0, 80)}`}>
            {chunk.heading && (
              <h4
                id={`section-article-${chunk.headingIdx}`}
                className={headingClass}
              >
                {chunk.heading}
              </h4>
            )}
            {chunk.text && (
              <div className={chunk.heading ? "" : "mt-2"}>
                <RichTextBlock
                  text={chunk.text}
                  compact={compact}
                  style="article"
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
