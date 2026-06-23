import type { ArticleContent, ArticleContentBlock } from "../../types";
import {
  detectArticleHeadings,
  headingBlockMatchesArticleTitle,
} from "../../components/reader/utils";
import {
  type ArticleBlockEmit,
  walkArticleBlocks,
} from "./article-block-walk";
import { resolveArticleCoverImageUrl } from "./article-cover";
import { renderBlockInlineMarkdown } from "./block-inline-markdown";
import { richTextArticleMarkdown } from "./article-plain-markdown";
import { splitPlainTextByHeadings } from "./article-heading-chunks";
import { optimizeMarkdownForAgent } from "./agent-markdown-optimizer";

export interface ArticleMarkdownMetadata {
  postUrl?: string;
  exportedAtLabel?: string;
  authorName?: string;
  authorHandle?: string;
}

interface ArticleMarkdownOptions {
  authorProfileImageUrl?: string;
  metadata?: ArticleMarkdownMetadata;
  includeCoverImage?: boolean;
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
  const longestBacktickRun = Math.max(
    0,
    ...Array.from(code.matchAll(/`+/g), (match) => match[0].length),
  );
  const fence = "`".repeat(Math.max(3, longestBacktickRun + 1));
  return `${fence}\n${code}\n${fence}`;
}

function markdownImageAlt(value: string): string {
  return value
    .replace(/[\r\n]+/g, " ")
    .replace(/\\/g, "\\\\")
    .replace(/]/g, "\\]")
    .trim();
}

function markdownImage(url: string, alt: string): string {
  return `![${markdownImageAlt(alt)}](${url})`;
}

function formatBlockquoteMarkdown(content: string): string {
  const lines = content.split("\n");
  return lines.map((line) => `> ${line}`).join("\n");
}

const HEADING_PREFIX: Record<1 | 2 | 3, string> = {
  1: "##",
  2: "###",
  3: "####",
};

const markdownEmit: ArticleBlockEmit<string> = {
  unorderedList(items, entityMap) {
    return items
      .map((item) => `- ${renderBlockInlineMarkdown(item, entityMap)}`)
      .join("\n");
  },
  orderedList(items, entityMap) {
    return items
      .map((item, i) => `${i + 1}. ${renderBlockInlineMarkdown(item, entityMap)}`)
      .join("\n");
  },
  mediaImage(url, alt) {
    return markdownImage(url, alt);
  },
  mediaVideo(imageUrl, postUrl) {
    const parts: string[] = [];
    if (imageUrl) {
      parts.push(markdownImage(imageUrl, "Video preview"));
    }
    if (postUrl) {
      parts.push(`[Watch on X](${postUrl})`);
    } else {
      parts.push("*Video — open the source URL in the front matter on X.*");
    }
    return parts.join("\n\n");
  },
  markdownEntity(code) {
    return fenceCodeBlock(code);
  },
  divider() {
    return "---";
  },
  empty() {
    return "";
  },
  heading(level, block, entityMap) {
    return `${HEADING_PREFIX[level]} ${renderBlockInlineMarkdown(block, entityMap)}`;
  },
  blockquote(block, entityMap) {
    return formatBlockquoteMarkdown(renderBlockInlineMarkdown(block, entityMap));
  },
  codeBlock(block) {
    return fenceCodeBlock(block.text);
  },
  paragraph(block, entityMap) {
    return renderBlockInlineMarkdown(block, entityMap);
  },
};

function blocksToMarkdown(
  blocks: ArticleContentBlock[],
  entityMap: Record<string, import("../../types").ArticleContentEntity>,
  articleTitle: string | undefined,
  watchOnXUrl: string | undefined,
): string {
  return walkArticleBlocks(
    blocks,
    entityMap,
    articleTitle,
    watchOnXUrl,
    markdownEmit,
  ).join("\n\n");
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
  options?: ArticleMarkdownOptions,
): string {
  const plainText = article.plainText?.trim() || "";
  const coverImageUrl =
    options?.includeCoverImage === false
      ? ""
      : resolveArticleCoverImageUrl(
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

  const coverAlt = article.title?.trim()
    ? `Cover image for ${article.title.trim()}`
    : "Cover image";
  const coverPart = coverImageUrl
    ? `${markdownImage(coverImageUrl, coverAlt)}\n\n`
    : "";

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

export function articleToAgentMarkdown(
  article: ArticleContent,
  options?: ArticleMarkdownOptions,
): string {
  const metadata = options?.metadata
    ? {
        postUrl: options.metadata.postUrl,
        authorName: options.metadata.authorName,
        authorHandle: options.metadata.authorHandle,
      }
    : undefined;

  return optimizeMarkdownForAgent(
    articleToMarkdown(article, {
      authorProfileImageUrl: options?.authorProfileImageUrl,
      metadata,
      includeCoverImage: false,
    }),
  );
}
