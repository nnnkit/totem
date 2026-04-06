import type { ArticleContent, ArticleContentBlock } from "../../types";
import {
  detectArticleHeadings,
  escapeHtml,
  groupBlocks,
  headingBlockMatchesArticleTitle,
  paragraphHtml,
  paragraphizeText,
  renderBlockInlineContent,
} from "../../components/reader/utils";
import { resolveArticleCoverImageUrl } from "./article-cover";
import { slugifyArticleBasename } from "./article-filename";

function stripMarkdownEntityCode(markdown: string): string {
  return markdown
    .replace(/^```\w*\n?/, "")
    .replace(/\n?```$/, "");
}

function blocksToArticleHtml(
  blocks: ArticleContentBlock[],
  entityMap: Record<string, import("../../types").ArticleContentEntity>,
  articleTitle: string | undefined,
  postUrl: string | undefined,
): string {
  const groups = groupBlocks(blocks);
  const out: string[] = [];

  for (let groupIdx = 0; groupIdx < groups.length; groupIdx++) {
    const group = groups[groupIdx];

    if (group.type === "unordered-list") {
      const items = group.items
        .map(
          (item) =>
            `<li>${renderBlockInlineContent(item, entityMap)}</li>`,
        )
        .join("");
      out.push(`<ul>${items}</ul>`);
      continue;
    }

    if (group.type === "ordered-list") {
      const items = group.items
        .map(
          (item) =>
            `<li>${renderBlockInlineContent(item, entityMap)}</li>`,
        )
        .join("");
      out.push(`<ol>${items}</ol>`);
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
            const imgPart =
              typeof imageUrl === "string" && imageUrl
                ? `<img src="${escapeHtml(imageUrl)}" alt="" />`
                : "";
            const linkPart = postUrl
              ? `<p class="print-video-link"><a href="${escapeHtml(postUrl)}">Watch on X</a></p>`
              : `<p class="print-video-link"><em>Video</em> — use the source link above.</p>`;
            out.push(
              `<figure class="print-video">${imgPart}${linkPart}</figure>`,
            );
            break;
          }
          if (typeof imageUrl === "string" && imageUrl) {
            out.push(
              `<figure><img src="${escapeHtml(imageUrl)}" alt="" /></figure>`,
            );
            break;
          }
        }
        if (entity?.type === "MARKDOWN") {
          const markdown = String(entity.data?.markdown || "");
          if (markdown) {
            const code = stripMarkdownEntityCode(markdown);
            out.push(
              `<pre><code>${escapeHtml(code)}</code></pre>`,
            );
            break;
          }
        }
        if (entity?.type === "DIVIDER") {
          out.push("<hr />");
          break;
        }
      }
      continue;
    }

    if (!block.text.trim()) {
      out.push('<div class="spacer"></div>');
      continue;
    }

    const html = renderBlockInlineContent(block, entityMap);

    if (
      (block.type === "header-one" ||
        block.type === "header-two" ||
        block.type === "header-three") &&
      headingBlockMatchesArticleTitle(block.text, articleTitle)
    ) {
      continue;
    }

    if (block.type === "header-one") {
      out.push(`<h2>${html}</h2>`);
      continue;
    }
    if (block.type === "header-two") {
      out.push(`<h3>${html}</h3>`);
      continue;
    }
    if (block.type === "header-three") {
      out.push(`<h4>${html}</h4>`);
      continue;
    }
    if (block.type === "blockquote") {
      out.push(`<blockquote>${html}</blockquote>`);
      continue;
    }
    if (block.type === "code-block") {
      out.push(`<pre><code>${escapeHtml(block.text)}</code></pre>`);
      continue;
    }

    out.push(`<p>${html}</p>`);
  }

  return out.join("\n");
}

function richTextArticleHtml(plainText: string): string {
  const trimmed = plainText.replace(/\r\n/g, "\n").trim();
  if (!trimmed) return "";

  const paragraphs = paragraphizeText(trimmed, "article");
  if (paragraphs.length === 0) return "";

  return paragraphs.map((p) => `<p>${paragraphHtml(p)}</p>`).join("\n");
}

function buildHeadingChunksHtml(
  plainText: string,
  headings: { index: number; text: string }[],
  articleTitle: string | undefined,
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
    if (
      chunk.heading &&
      !headingBlockMatchesArticleTitle(chunk.heading, articleTitle)
    ) {
      parts.push(`<h4>${escapeHtml(chunk.heading)}</h4>`);
    }
    if (chunk.text) {
      parts.push(richTextArticleHtml(chunk.text));
    }
  }
  return parts.join("\n");
}

export interface ArticlePrintHtmlMetadata {
  postUrl?: string;
  exportedAtLabel?: string;
  authorName?: string;
  authorHandle?: string;
}

const FONT_LINKS = `
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Spectral:ital,wght@0,400;0,600;0,700;1,400&display=swap" rel="stylesheet" />
`;

const PRINT_STYLES = `
@page {
  margin: 14mm 16mm;
  size: auto;
}
* { box-sizing: border-box; }
html {
  height: auto;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
body {
  font-family: "Spectral", Charter, "Iowan Old Style", Georgia, serif;
  font-size: 1.125rem;
  line-height: 1.75;
  color: #111;
  max-width: 42rem;
  margin: 0 auto;
  padding: 0;
}
h1, h2, h3, h4 {
  font-family: "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  font-weight: 700;
  color: #111;
}
h2, h3, h4 {
  page-break-after: avoid;
  break-after: avoid-page;
}
h1 {
  font-size: 2.25rem;
  line-height: 1.15;
  margin: 0 0 0.55em;
}
h2 {
  font-size: 1.5rem;
  line-height: 1.25;
  margin: 1.35em 0 0.4em;
}
h3 {
  font-size: 1.25rem;
  line-height: 1.3;
  margin: 1.15em 0 0.35em;
}
h4 {
  font-size: 1rem;
  line-height: 1.35;
  margin: 1em 0 0.3em;
}
p {
  margin: 0 0 1.15em;
  orphans: 3;
  widows: 3;
}
ul, ol {
  margin: 0 0 1em;
  padding-left: 1.35em;
}
li { margin: 0.2em 0; }
blockquote {
  margin: 0 0 1em;
  padding-left: 1em;
  border-left: 3px solid #ccc;
  break-inside: avoid;
  page-break-inside: avoid;
}
pre {
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: break-word;
  background: #f5f5f5;
  padding: 0.65em 0.85em;
  border-radius: 4px;
  font-size: 0.88em;
  line-height: 1.5;
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
  break-inside: avoid;
  page-break-inside: avoid;
}
code {
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
  font-size: 0.92em;
}
figure {
  margin: 0.85em 0;
  break-inside: avoid;
  page-break-inside: avoid;
}
figure img {
  max-width: 100%;
  height: auto;
  display: block;
  margin-left: auto;
  margin-right: auto;
}
.print-video-link {
  margin: 0.5em 0 0;
  text-align: center;
  font-size: 0.95em;
}
a {
  color: #0a5;
  overflow-wrap: anywhere;
  word-break: normal;
}
hr {
  border: none;
  border-top: 1px solid #ccc;
  margin: 1em 0;
  break-inside: avoid;
}
.meta {
  font-family: "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  font-size: 0.8125rem;
  line-height: 1.5;
  color: #555;
  margin-bottom: 1em;
}
.meta a {
  color: #055;
  overflow-wrap: anywhere;
}
.spacer {
  height: 0.35rem;
}
@media print {
  body {
    max-width: none;
    width: 100%;
    padding: 0;
    font-size: 11pt;
    line-height: 1.65;
  }
  h1 { font-size: 20pt; }
  h2 { font-size: 14pt; }
  h3 { font-size: 13pt; }
  h4 { font-size: 11pt; }
  figure.print-cover img {
    max-height: 2.75in;
    width: auto;
    max-width: 100%;
    object-fit: contain;
  }
  figure:not(.print-cover) img {
    max-height: 3.5in;
    width: auto;
    max-width: 100%;
    object-fit: contain;
  }
  .spacer {
    height: 0;
    margin: 0;
    padding: 0;
  }
}
`;

export function articleToPrintDocumentHtml(
  article: ArticleContent,
  options?: {
    authorProfileImageUrl?: string;
    metadata?: ArticlePrintHtmlMetadata;
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

  const metaParts: string[] = [];
  if (options?.metadata?.postUrl) {
    metaParts.push(
      `Source: <a href="${escapeHtml(options.metadata.postUrl)}">${escapeHtml(options.metadata.postUrl)}</a>`,
    );
  }
  if (options?.metadata?.authorName?.trim() || options?.metadata?.authorHandle?.trim()) {
    const name = options.metadata.authorName?.trim() ?? "";
    const handle = options.metadata.authorHandle?.replace(/^@/, "").trim() ?? "";
    const author =
      name && handle
        ? `${escapeHtml(name)} (<a href="https://x.com/${escapeHtml(handle)}">@${escapeHtml(handle)}</a>)`
        : name
          ? escapeHtml(name)
          : handle
            ? `<a href="https://x.com/${escapeHtml(handle)}">@${escapeHtml(handle)}</a>`
            : "";
    if (author) {
      metaParts.push(`Author: ${author}`);
    }
  }
  if (options?.metadata?.exportedAtLabel) {
    metaParts.push(escapeHtml(options.metadata.exportedAtLabel));
  }
  const metaHtml =
    metaParts.length > 0
      ? `<div class="meta">${metaParts.join("<br />")}</div><hr />`
      : "";

  const titleHtml = article.title?.trim()
    ? `<h1>${escapeHtml(article.title.trim())}</h1>`
    : "";

  const coverHtml = coverImageUrl
    ? `<figure class="print-cover"><img src="${escapeHtml(coverImageUrl)}" alt="" /></figure>`
    : "";

  let bodyHtml = "";
  if (hasBlocks) {
    bodyHtml = blocksToArticleHtml(
      article.contentBlocks!,
      article.entityMap || {},
      article.title?.trim(),
      options?.metadata?.postUrl,
    );
  } else if (headings.length === 0) {
    bodyHtml = richTextArticleHtml(plainText);
  } else {
    bodyHtml = buildHeadingChunksHtml(
      plainText,
      headings,
      article.title?.trim(),
    );
  }

  const documentTitle = slugifyArticleBasename(article);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(documentTitle)}</title>
${FONT_LINKS}
<style>${PRINT_STYLES}</style>
</head>
<body>
${metaHtml}
${titleHtml}
${coverHtml}
${bodyHtml}
</body>
</html>`;
}
