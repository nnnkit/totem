import { describe, expect, it } from "vitest";
import type { ArticleContent } from "../../../types";
import { articleToMarkdown } from "../article-to-markdown";
import { articleToPrintDocumentHtml } from "../article-to-print-html";

const ARTICLE_TITLE = "The Comprehensive Title";

const entityMap = {
  "0": { type: "MEDIA", data: { imageUrl: "https://img.example.com/photo.jpg", altText: "A photo" } },
  "1": {
    type: "MEDIA",
    data: { videoUrl: "https://video.example.com/v.mp4", imageUrl: "https://img.example.com/poster.jpg" },
  },
  "2": { type: "MEDIA", data: { videoUrl: "https://video.example.com/v2.mp4" } },
  "3": { type: "MARKDOWN", data: { markdown: "```js\nconst x = 1;\n```" } },
  "4": { type: "DIVIDER", data: {} },
  "5": { type: "LINK", data: { url: "https://link.example.com" } },
};

const blocksArticle: ArticleContent = {
  title: ARTICLE_TITLE,
  plainText: "ignored when blocks present",
  coverImageUrl: "https://img.example.com/cover.jpg",
  entityMap,
  contentBlocks: [
    { type: "header-one", text: ARTICLE_TITLE, inlineStyleRanges: [], entityRanges: [], depth: 0 },
    {
      type: "unstyled",
      text: "First paragraph with a link entity here.",
      inlineStyleRanges: [{ offset: 22, length: 11, style: "BOLD" }],
      entityRanges: [{ offset: 24, length: 4, key: 5 }],
      depth: 0,
    },
    { type: "unstyled", text: "", inlineStyleRanges: [], entityRanges: [], depth: 0 },
    {
      type: "unstyled",
      text: "Second paragraph, plain text.",
      inlineStyleRanges: [],
      entityRanges: [],
      depth: 0,
    },
    { type: "header-one", text: "A Header One", inlineStyleRanges: [], entityRanges: [], depth: 0 },
    { type: "header-two", text: "A Header Two", inlineStyleRanges: [], entityRanges: [], depth: 0 },
    { type: "header-three", text: "A Header Three", inlineStyleRanges: [], entityRanges: [], depth: 0 },
    { type: "unordered-list-item", text: "First bullet", inlineStyleRanges: [], entityRanges: [], depth: 0 },
    { type: "unordered-list-item", text: "Second bullet", inlineStyleRanges: [], entityRanges: [], depth: 0 },
    { type: "ordered-list-item", text: "First numbered", inlineStyleRanges: [], entityRanges: [], depth: 0 },
    { type: "ordered-list-item", text: "Second numbered", inlineStyleRanges: [], entityRanges: [], depth: 0 },
    {
      type: "blockquote",
      text: "A quote line one\nA quote line two",
      inlineStyleRanges: [],
      entityRanges: [],
      depth: 0,
    },
    {
      type: "code-block",
      text: "function f() {\n  return `tpl`;\n}",
      inlineStyleRanges: [],
      entityRanges: [],
      depth: 0,
    },
    { type: "atomic", text: " ", inlineStyleRanges: [], entityRanges: [{ offset: 0, length: 1, key: 0 }], depth: 0 },
    { type: "atomic", text: " ", inlineStyleRanges: [], entityRanges: [{ offset: 0, length: 1, key: 1 }], depth: 0 },
    { type: "atomic", text: " ", inlineStyleRanges: [], entityRanges: [{ offset: 0, length: 1, key: 2 }], depth: 0 },
    { type: "atomic", text: " ", inlineStyleRanges: [], entityRanges: [{ offset: 0, length: 1, key: 3 }], depth: 0 },
    { type: "atomic", text: " ", inlineStyleRanges: [], entityRanges: [{ offset: 0, length: 1, key: 4 }], depth: 0 },
    {
      type: "unstyled",
      text: "Final paragraph with *inline* and `code` styling.",
      inlineStyleRanges: [
        { offset: 22, length: 6, style: "ITALIC" },
        { offset: 35, length: 4, style: "CODE" },
      ],
      entityRanges: [],
      depth: 0,
    },
  ],
};

const blocksMetadata = {
  postUrl: "https://x.com/someone/status/123",
  exportedAtLabel: "June 24, 2026",
  authorName: "Jane Doe",
  authorHandle: "@janedoe",
};

const noBlocksArticle: ArticleContent = {
  title: "Plain Text Article",
  plainText:
    "This is a plain text article with no blocks. It has multiple sentences. The second sentence continues here. Visit https://example.com for more.",
  coverImageUrl: "",
};

const headingChunksArticle: ArticleContent = {
  title: "Headings Only Article",
  plainText:
    "Headings Only Article\nIntroduction\nThis is the introductory body text that is clearly longer than the heading above it.\nConclusion\nThis is the concluding body text that is also longer than its heading line above.",
  coverImageUrl: "",
};

function videoBlockArticle(
  title: string,
  data: Record<string, unknown>,
): ArticleContent {
  return {
    title,
    plainText: "ignored when blocks present",
    coverImageUrl: "",
    entityMap: { "0": { type: "MEDIA", data } },
    contentBlocks: [
      {
        type: "atomic",
        text: " ",
        inlineStyleRanges: [],
        entityRanges: [{ offset: 0, length: 1, key: 0 }],
        depth: 0,
      },
    ],
  };
}

const VIDEO_NO_SOURCE_FALLBACK =
  "*Video — open the source URL in the front matter on X.*";

describe("article render golden", () => {
  // The blocks-path golden above always supplies a postUrl, so the markdown
  // emitter's video-without-source fallback (the else branch of mediaVideo) is
  // only covered here. C9 — see issue #63.
  it("markdown — video block without a source URL emits the front-matter fallback", () => {
    expect(
      articleToMarkdown(
        videoBlockArticle("Video Without Source", {
          videoUrl: "https://video.example.com/clip.mp4",
        }),
        { includeCoverImage: false },
      ),
    ).toBe(`# Video Without Source\n\n${VIDEO_NO_SOURCE_FALLBACK}\n`);
  });

  it("markdown — video without a source keeps the poster preview above the fallback", () => {
    const markdown = articleToMarkdown(
      videoBlockArticle("Video With Poster", {
        videoUrl: "https://video.example.com/clip.mp4",
        imageUrl: "https://img.example.com/poster.jpg",
      }),
      { includeCoverImage: false },
    );
    expect(markdown).toContain(
      "![Video preview](https://img.example.com/poster.jpg)",
    );
    expect(markdown).toContain(VIDEO_NO_SOURCE_FALLBACK);
    expect(markdown).not.toContain("Watch on X");
  });

  it("markdown — blocks path (all block types + title skip + metadata + cover)", () => {
    expect(
      articleToMarkdown(blocksArticle, { metadata: blocksMetadata }),
    ).toMatchInlineSnapshot(`
      "---
      title: "The Comprehensive Title"
      source: https://x.com/someone/status/123
      author: "[[Jane Doe]]"
      handle: "@janedoe"
      exported: "June 24, 2026"
      ---
      # The Comprehensive Title

      ![Cover image for The Comprehensive Title](https://img.example.com/cover.jpg)

      First paragraph with a** l**[**ink **](https://link.example.com)**entit**y here.



      Second paragraph, plain text.

      ## A Header One

      ### A Header Two

      #### A Header Three

      - First bullet
      - Second bullet

      1. First numbered
      2. Second numbered

      > A quote line one
      > A quote line two

      \`\`\`
      function f() {
        return \`tpl\`;
      }
      \`\`\`

      ![A photo](https://img.example.com/photo.jpg)

      ![Video preview](https://img.example.com/poster.jpg)

      [Watch on X](https://x.com/someone/status/123)

      [Watch on X](https://x.com/someone/status/123)

      \`\`\`
      const x = 1;
      \`\`\`

      ---

      Final paragraph with \\**inline*\\* and \`code\` styling.
      "
    `);
  });

  it("print html — blocks path (all block types + title skip + metadata + cover)", () => {
    expect(
      articleToPrintDocumentHtml(blocksArticle, { metadata: blocksMetadata }),
    ).toMatchInlineSnapshot(`
      "<!DOCTYPE html>
      <html lang="en">
      <head>
      <meta charset="utf-8" />
      <title>the-comprehensive-title</title>

      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
      <link href="https://fonts.googleapis.com/css2?family=Spectral:ital,wght@0,400;0,600;0,700;1,400&display=swap" rel="stylesheet" />

      <style>
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
      </style>
      </head>
      <body>
      <div class="meta">Source: <a href="https://x.com/someone/status/123">https://x.com/someone/status/123</a><br />Author: Jane Doe (<a href="https://x.com/janedoe">@janedoe</a>)<br />June 24, 2026</div><hr />
      <h1>The Comprehensive Title</h1>
      <figure class="print-cover"><img src="https://img.example.com/cover.jpg" alt="" /></figure>
      <p>First paragraph with a<strong> l</strong><a href="https://link.example.com" target="_blank" rel="noopener noreferrer"><strong>ink </strong></a><strong>entit</strong>y here.</p>
      <div class="spacer"></div>
      <p>Second paragraph, plain text.</p>
      <h2>A Header One</h2>
      <h3>A Header Two</h3>
      <h4>A Header Three</h4>
      <ul><li>First bullet</li><li>Second bullet</li></ul>
      <ol><li>First numbered</li><li>Second numbered</li></ol>
      <blockquote>A quote line one
      A quote line two</blockquote>
      <pre><code>function f() {
        return \`tpl\`;
      }</code></pre>
      <figure><img src="https://img.example.com/photo.jpg" alt="" /></figure>
      <figure class="print-video"><img src="https://img.example.com/poster.jpg" alt="" /><p class="print-video-link"><a href="https://x.com/someone/status/123">Watch on X</a></p></figure>
      <figure class="print-video"><p class="print-video-link"><a href="https://x.com/someone/status/123">Watch on X</a></p></figure>
      <pre><code>const x = 1;</code></pre>
      <hr />
      <p>Final paragraph with *<em>inline</em>* and <code>code</code> styling.</p>
      </body>
      </html>"
    `);
  });

  it("markdown — richText path (no blocks, no detected headings)", () => {
    expect(articleToMarkdown(noBlocksArticle)).toMatchInlineSnapshot(`
      "# Plain Text Article

      This is a plain text article with no blocks. It has multiple sentences. The second sentence continues here. Visit [https://example.com](https://example.com) for more.
      "
    `);
  });

  it("print html — richText path (no blocks, no detected headings)", () => {
    expect(articleToPrintDocumentHtml(noBlocksArticle)).toMatchInlineSnapshot(`
      "<!DOCTYPE html>
      <html lang="en">
      <head>
      <meta charset="utf-8" />
      <title>plain-text-article</title>

      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
      <link href="https://fonts.googleapis.com/css2?family=Spectral:ital,wght@0,400;0,600;0,700;1,400&display=swap" rel="stylesheet" />

      <style>
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
      </style>
      </head>
      <body>

      <h1>Plain Text Article</h1>

      <p>This is a plain text article with no blocks. It has multiple sentences. The second sentence continues here. Visit <a href="https://example.com" target="_blank" rel="noopener noreferrer">https://example.com</a> for more.</p>
      </body>
      </html>"
    `);
  });

  it("markdown — heading-chunks path (no blocks, detected headings)", () => {
    expect(articleToMarkdown(headingChunksArticle)).toMatchInlineSnapshot(`
      "# Headings Only Article

      Headings Only Article

      #### Introduction

      This is the introductory body text that is clearly longer than the heading above it.

      #### Conclusion

      This is the concluding body text that is also longer than its heading line above.
      "
    `);
  });

  it("print html — heading-chunks path (no blocks, detected headings)", () => {
    expect(
      articleToPrintDocumentHtml(headingChunksArticle),
    ).toMatchInlineSnapshot(`
      "<!DOCTYPE html>
      <html lang="en">
      <head>
      <meta charset="utf-8" />
      <title>headings-only-article</title>

      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
      <link href="https://fonts.googleapis.com/css2?family=Spectral:ital,wght@0,400;0,600;0,700;1,400&display=swap" rel="stylesheet" />

      <style>
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
      </style>
      </head>
      <body>

      <h1>Headings Only Article</h1>

      <p>Headings Only Article</p>
      <h4>Introduction</h4>
      <p>This is the introductory body text that is clearly longer than the heading above it.</p>
      <h4>Conclusion</h4>
      <p>This is the concluding body text that is also longer than its heading line above.</p>
      </body>
      </html>"
    `);
  });
});
