import type { ArticleContent, ArticleContentBlock, Highlight } from "../../types";
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
import { buildHighlightsSection, sanitizeWikiLinkText } from "./highlights-markdown";

export interface ArticleMarkdownMetadata {
  postUrl?: string;
  exportedAtLabel?: string;
  authorName?: string;
  authorHandle?: string;
  savedDate?: string;
  tags?: string[];
  highlightCount?: number;
  noteCount?: number;
}

interface ArticleMarkdownOptions {
  authorProfileImageUrl?: string;
  metadata?: ArticleMarkdownMetadata;
  includeCoverImage?: boolean;
  highlights?: Highlight[];
}

function assembleMarkdown(combined: string, highlightsSection: string): string {
  const trimmed = combined.trimEnd();
  if (!highlightsSection) return trimmed ? trimmed + "\n" : "";
  return [trimmed, highlightsSection].filter(Boolean).join("\n\n") + "\n";
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
  const name = metadata.authorName?.trim() ?? "";
  const handle = metadata.authorHandle?.replace(/^@/, "").trim() ?? "";
  if (name || handle) {
    // Wikilink so Obsidian's graph clusters notes by author. Fall back to the
    // handle when no display name is available.
    const linkText = sanitizeWikiLinkText(name || `@${handle}`);
    if (linkText) {
      lines.push(`author: ${yamlScalar(`[[${linkText}]]`)}`);
    }
    if (handle) {
      lines.push(`handle: ${yamlScalar(`@${handle}`)}`);
    }
  }
  if (metadata.savedDate) {
    lines.push(`saved: ${metadata.savedDate}`);
  }
  if (metadata.exportedAtLabel) {
    lines.push(`exported: ${yamlScalar(metadata.exportedAtLabel)}`);
  }
  const tags = metadata.tags?.filter((tag) => tag.trim());
  if (tags && tags.length > 0) {
    lines.push(`tags: [${tags.map((tag) => tag.trim()).join(", ")}]`);
  }
  if (typeof metadata.highlightCount === "number" && metadata.highlightCount > 0) {
    lines.push(`highlights: ${metadata.highlightCount}`);
  }
  if (typeof metadata.noteCount === "number" && metadata.noteCount > 0) {
    lines.push(`notes: ${metadata.noteCount}`);
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
      meta.authorHandle ||
      meta.savedDate ||
      (meta.tags && meta.tags.length > 0))
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

  const highlightsSection = options?.highlights?.length
    ? buildHighlightsSection(options.highlights)
    : "";

  if (hasBlocks) {
    const body = blocksToMarkdown(
      article.contentBlocks!,
      article.entityMap || {},
      article.title?.trim(),
      meta?.postUrl,
    );
    return assembleMarkdown(
      `${metaBlock}${titlePart}${coverPart}${body}`,
      highlightsSection,
    );
  }

  if (headings.length === 0) {
    const body = richTextArticleMarkdown(plainText);
    return assembleMarkdown(
      `${metaBlock}${titlePart}${coverPart}${body}`,
      highlightsSection,
    );
  }

  const body = buildHeadingChunksMarkdown(
    plainText,
    headings,
    article.title?.trim(),
  );
  return assembleMarkdown(
    `${metaBlock}${titlePart}${coverPart}${body}`,
    highlightsSection,
  );
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
