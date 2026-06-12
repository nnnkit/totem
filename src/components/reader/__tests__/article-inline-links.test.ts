import { describe, expect, it } from "vitest";
import type { ArticleContentBlock } from "../../../types";
import { renderBlockInlineContent, sanitizeMediaSrc } from "../utils";

describe("renderBlockInlineContent", () => {
  it("renders urls from block data when entity ranges are missing", () => {
    const url = "https://x.com/beckerrjon/status/2021280975318040917";
    const block: ArticleContentBlock = {
      type: "unstyled",
      text: url,
      inlineStyleRanges: [],
      entityRanges: [],
      depth: 0,
      data: {
        urls: [{ fromIndex: 0, toIndex: url.length, text: url }],
      },
    };

    expect(renderBlockInlineContent(block, {})).toBe(
      `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`,
    );
  });

  it("auto-linkifies raw urls without structured metadata", () => {
    const block: ArticleContentBlock = {
      type: "unstyled",
      text: "Dataset: https://example.com/report",
      inlineStyleRanges: [],
      entityRanges: [],
      depth: 0,
    };

    expect(renderBlockInlineContent(block, {})).toContain(
      '<a href="https://example.com/report" target="_blank" rel="noopener noreferrer">https://example.com/report</a>',
    );
  });
});

describe("sanitizeMediaSrc", () => {
  it("keeps http urls and drops executable or relative schemes", () => {
    expect(sanitizeMediaSrc("https://example.com/image.jpg")).toBe(
      "https://example.com/image.jpg",
    );
    expect(sanitizeMediaSrc(" javascript:alert(1) ")).toBe("");
    expect(sanitizeMediaSrc("data:image/png;base64,abc")).toBe("");
    expect(sanitizeMediaSrc("/relative/image.jpg")).toBe("");
  });
});
