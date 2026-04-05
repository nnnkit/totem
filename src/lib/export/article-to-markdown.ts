import type { ArticleContent, ArticleContentBlock } from "../../types";
import { detectArticleHeadings, groupBlocks } from "../../components/reader/utils";
import { resolveArticleCoverImageUrl } from "./article-cover";
import { renderBlockInlineMarkdown } from "./block-inline-markdown";
import { richTextArticleMarkdown } from "./article-plain-markdown";

export interface ArticleMarkdownMetadata {
  postUrl?: string;
  exportedAtLabel?: string;
  authorName?: string;
  authorHandle?: string;
}

function yamlScalar(s: string): string {
  if (/[":\n#]/.test(s)) {
    return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  }
  return s;
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
): string {
  const lines = plainText
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const headingLineIndices = new Set(headings.map((h) => h.index));

  const chunks: { heading?: string; headingIdx: number; text: string }[] = [];
  let currentLines: string[] = [];
  let currentHeading: string | undefined;
  let currentHeadingIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    if (headingLineIndices.has(i)) {
      if (currentLines.length > 0 || currentHeading !== undefined) {
        chunks.push({
          heading: currentHeading,
          headingIdx: currentHeadingIdx,
          text: currentLines.join("\n"),
        });
      }
      const hIdx = headings.findIndex((h) => h.index === i);
      currentHeading = headings[hIdx].text;
      currentHeadingIdx = hIdx;
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

  const parts: string[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    if (chunk.heading) {
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
  const headings = hasBlocks ? [] : detectArticleHeadings(plainText);

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
    );
    return `${metaBlock}${titlePart}${coverPart}${body}`.trimEnd() + "\n";
  }

  if (headings.length === 0) {
    const body = richTextArticleMarkdown(plainText);
    return `${metaBlock}${titlePart}${coverPart}${body}`.trimEnd() + "\n";
  }

  const body = buildHeadingChunksMarkdown(plainText, headings);
  return `${metaBlock}${titlePart}${coverPart}${body}`.trimEnd() + "\n";
}
