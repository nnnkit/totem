import type { ArticleContent, ArticleContentBlock } from "../../types";
import {
  detectArticleHeadings,
  groupBlocks,
  headingBlockMatchesArticleTitle,
} from "../../components/reader/utils";
import { resolveArticleCoverImageUrl } from "./article-cover";
import { renderBlockInlineMarkdown } from "./block-inline-markdown";
import { richTextArticleMarkdown } from "./article-plain-markdown";
import { splitPlainTextByHeadings } from "./article-heading-chunks";

export interface ArticleMarkdownMetadata {
  postUrl?: string;
  exportedAtLabel?: string;
  authorName?: string;
  authorHandle?: string;
}

function yamlScalar(s: string): string {
  const oneLine = s.replace(/[\r\n]+/g, " ");
  return `"${oneLine.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function buildYamlFrontmatter(
  articleTitle: string | undefined,
  metadata: ArticleMarkdownMetadata,
): string {
  const lines: string[] = ["---"];
  if (articleTitle?.trim()) {
    lines.push(`title: ${yamlScalar(articleTitle.trim())}`);
  }
  if (metadata.postUrl) {
    lines.push(`source: ${metadata.postUrl}`);
  }
  if (metadata.exportedAtLabel) {
    lines.push(`exported: ${yamlScalar(metadata.exportedAtLabel)}`);
  }
  if (metadata.authorName?.trim() || metadata.authorHandle?.trim()) {
    const name = metadata.authorName?.trim() ?? "";
    const handle = metadata.authorHandle?.replace(/^@/, "").trim() ?? "";
    const author =
      name && handle
        ? `${name} (@${handle})`
        : name || (handle ? `@${handle}` : "");
    if (author) {
      lines.push(`author: ${yamlScalar(author)}`);
    }
  }
  lines.push("---", "");
  return lines.join("\n");
}

function fenceCodeBlock(code: string): string {
  let fence = "```";
  while (code.includes(fence)) {
    fence += "`";
  }
  return `${fence}\n${code}\n${fence}`;
}

function stripMarkdownEntityCode(markdown: string): string {
  return markdown
    .replace(/^```\w*\n?/, "")
    .replace(/\n?```$/, "");
}

function formatBlockquoteMarkdown(content: string): string {
  const lines = content.split("\n");
  return lines.map((line) => `> ${line}`).join("\n");
}

function blocksToMarkdown(
  blocks: ArticleContentBlock[],
  entityMap: Record<string, import("../../types").ArticleContentEntity>,
  articleTitle: string | undefined,
  watchOnXUrl: string | undefined,
): string {
  const groups = groupBlocks(blocks);
  const out: string[] = [];

  for (let groupIdx = 0; groupIdx < groups.length; groupIdx++) {
    const group = groups[groupIdx];

    if (group.type === "unordered-list") {
      const items = group.items.map((item) => {
        const line = renderBlockInlineMarkdown(item, entityMap);
        return `- ${line}`;
      });
      out.push(items.join("\n"));
      continue;
    }

    if (group.type === "ordered-list") {
      const items = group.items.map((item, i) => {
        const line = renderBlockInlineMarkdown(item, entityMap);
        return `${i + 1}. ${line}`;
      });
      out.push(items.join("\n"));
      continue;
    }

    const { block } = group;

    if (block.type === "atomic") {
      for (const range of block.entityRanges) {
        const entity = entityMap[String(range.key)];
        if (entity?.type === "MEDIA") {
          const imageUrl = entity.data?.imageUrl;
          const videoUrl = entity.data?.videoUrl;
          if (typeof videoUrl === "string" && videoUrl) {
            const parts: string[] = [];
            if (typeof imageUrl === "string" && imageUrl) {
              parts.push(`![](${imageUrl})`);
            }
            if (watchOnXUrl) {
              parts.push(`[Watch on X](${watchOnXUrl})`);
            } else {
              parts.push("*Video — open the source URL in the front matter on X.*");
            }
            out.push(parts.join("\n\n"));
            break;
          }
          if (typeof imageUrl === "string" && imageUrl) {
            out.push(`![](${imageUrl})`);
            break;
          }
        }
        if (entity?.type === "MARKDOWN") {
          const markdown = String(entity.data?.markdown || "");
          if (markdown) {
            const code = stripMarkdownEntityCode(markdown);
            out.push(fenceCodeBlock(code));
            break;
          }
        }
        if (entity?.type === "DIVIDER") {
          out.push("---");
          break;
        }
      }
      continue;
    }

    if (!block.text.trim()) {
      out.push("");
      continue;
    }

    const inline = renderBlockInlineMarkdown(block, entityMap);

    if (
      (block.type === "header-one" ||
        block.type === "header-two" ||
        block.type === "header-three") &&
      headingBlockMatchesArticleTitle(block.text, articleTitle)
    ) {
      continue;
    }

    if (block.type === "header-one") {
      out.push(`## ${inline}`);
      continue;
    }
    if (block.type === "header-two") {
      out.push(`### ${inline}`);
      continue;
    }
    if (block.type === "header-three") {
      out.push(`#### ${inline}`);
      continue;
    }
    if (block.type === "blockquote") {
      out.push(formatBlockquoteMarkdown(inline));
      continue;
    }
    if (block.type === "code-block") {
      out.push(fenceCodeBlock(block.text));
      continue;
    }

    out.push(inline);
  }

  return out.join("\n\n");
}

function buildHeadingChunksMarkdown(
  plainText: string,
  headings: { index: number; text: string }[],
  articleTitle: string | undefined,
): string {
  const chunks = splitPlainTextByHeadings(plainText, headings);
  const parts: string[] = [];
  for (const chunk of chunks) {
    if (
      chunk.heading &&
      !headingBlockMatchesArticleTitle(chunk.heading, articleTitle)
    ) {
      parts.push(`#### ${chunk.heading}`);
    }
    if (chunk.text) {
      parts.push(richTextArticleMarkdown(chunk.text));
    }
  }
  return parts.join("\n\n");
}

export function hasExportableArticle(article: ArticleContent | null | undefined): boolean {
  if (!article) return false;
  const plain = article.plainText?.trim() || "";
  const blocks = article.contentBlocks?.length ?? 0;
  return plain.length > 0 || blocks > 0;
}

export function articleToMarkdown(
  article: ArticleContent,
  options?: {
    authorProfileImageUrl?: string;
    metadata?: ArticleMarkdownMetadata;
  },
): string {
  const plainText = article.plainText?.trim() || "";
  const coverImageUrl = resolveArticleCoverImageUrl(
    article.coverImageUrl,
    options?.authorProfileImageUrl,
  );

  const hasBlocks =
    article.contentBlocks !== undefined && article.contentBlocks.length > 0;
  const headings = hasBlocks
    ? []
    : detectArticleHeadings(plainText, { articleTitle: article.title?.trim() });

  const meta = options?.metadata;
  const metaBlock =
    meta &&
    (meta.postUrl ||
      meta.exportedAtLabel ||
      meta.authorName ||
      meta.authorHandle)
      ? buildYamlFrontmatter(article.title, meta)
      : "";

  const titlePart = article.title?.trim()
    ? `# ${article.title.trim()}\n\n`
    : "";

  const coverPart = coverImageUrl ? `![](${coverImageUrl})\n\n` : "";

  if (hasBlocks) {
    const body = blocksToMarkdown(
      article.contentBlocks!,
      article.entityMap || {},
      article.title?.trim(),
      meta?.postUrl,
    );
    const combined = `${metaBlock}${titlePart}${coverPart}${body}`.trimEnd();
  return combined ? combined + "\n" : "";
  }

  if (headings.length === 0) {
    const body = richTextArticleMarkdown(plainText);
    const combined = `${metaBlock}${titlePart}${coverPart}${body}`.trimEnd();
  return combined ? combined + "\n" : "";
  }

  const body = buildHeadingChunksMarkdown(
    plainText,
    headings,
    article.title?.trim(),
  );
  const combined = `${metaBlock}${titlePart}${coverPart}${body}`.trimEnd();
  return combined ? combined + "\n" : "";
}
