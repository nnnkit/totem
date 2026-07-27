import { describe, expect, it } from "vitest";
import type { Highlight } from "../../../types";
import {
  buildHighlightsDigest,
  buildHighlightsSection,
  countHighlightsAndNotes,
  sanitizeWikiLinkText,
} from "../highlights-markdown";

function makeHighlight(overrides: Partial<Highlight> & { id: string }): Highlight {
  return {
    tweetId: "tweet-1",
    sectionId: "1",
    startOffset: 0,
    endOffset: 10,
    selectedText: "some text",
    note: null,
    color: "yellow",
    createdAt: Date.UTC(2026, 0, 1),
    ...overrides,
  };
}

describe("sanitizeWikiLinkText", () => {
  it("strips characters that break wikilinks and collapses whitespace", () => {
    expect(sanitizeWikiLinkText("Jane [#1] ^Doe| ")).toBe("Jane 1 Doe");
    expect(sanitizeWikiLinkText("  multiple   spaces  ")).toBe("multiple spaces");
  });
});

describe("countHighlightsAndNotes", () => {
  it("counts passages, passage-notes, and standalone notes", () => {
    const highlights = [
      makeHighlight({ id: "a", selectedText: "passage", note: null }),
      makeHighlight({ id: "b", selectedText: "passage with note", note: "my note" }),
      makeHighlight({ id: "c", selectedText: "", note: "standalone", type: "note" }),
    ];
    expect(countHighlightsAndNotes(highlights)).toEqual({ highlights: 2, notes: 2 });
  });

  it("returns zeroes for an empty list", () => {
    expect(countHighlightsAndNotes([])).toEqual({ highlights: 0, notes: 0 });
  });
});

describe("buildHighlightsSection", () => {
  it("returns an empty string when there is nothing to render", () => {
    expect(buildHighlightsSection([])).toBe("");
  });

  it("renders highlights as blockquotes with block-reference ids and notes", () => {
    const section = buildHighlightsSection([
      makeHighlight({
        id: "abc123",
        selectedText: "First quote",
        note: "A note",
      }),
    ]);
    expect(section).toContain("## Highlights");
    expect(section).toContain("> First quote");
    expect(section).toContain("^h-abc123");
    expect(section).toContain("**Note:** A note");
  });

  it("orders highlights by section, then position, not creation time", () => {
    const section = buildHighlightsSection([
      makeHighlight({
        id: "late",
        sectionId: "10",
        startOffset: 0,
        selectedText: "Section ten",
        createdAt: 1,
      }),
      makeHighlight({
        id: "early",
        sectionId: "2",
        startOffset: 5,
        selectedText: "Section two",
        createdAt: 100,
      }),
      makeHighlight({
        id: "earliest",
        sectionId: "2",
        startOffset: 1,
        selectedText: "Section two start",
        createdAt: 50,
      }),
    ]);
    const first = section.indexOf("Section two start");
    const second = section.indexOf("Section two\n");
    const third = section.indexOf("Section ten");
    expect(first).toBeLessThan(second);
    expect(second).toBeLessThan(third);
  });

  it("renders standalone notes in a separate Notes section", () => {
    const section = buildHighlightsSection([
      makeHighlight({ id: "p", selectedText: "A passage", note: null }),
      makeHighlight({ id: "n", selectedText: "", note: "Just a thought", type: "note" }),
    ]);
    expect(section).toContain("## Highlights");
    expect(section).toContain("## Notes");
    expect(section).toContain("- Just a thought ^h-n");
  });
});

describe("buildHighlightsDigest", () => {
  it("groups highlights by source and demotes section headings", () => {
    const digest = buildHighlightsDigest(
      [
        {
          title: "My Article",
          sourceUrl: "https://x.com/test/status/1",
          authorName: "Test User",
          authorHandle: "test",
          highlights: [makeHighlight({ id: "x", selectedText: "Quoted line" })],
        },
      ],
      "2026-07-27",
    );
    expect(digest).toContain("# Highlights & notes");
    expect(digest).toContain("## My Article");
    expect(digest).toContain("by Test User (@test)");
    expect(digest).toContain("[Open on X](https://x.com/test/status/1)");
    // Per-source headings are demoted so the digest keeps one top-level title.
    expect(digest).toContain("### Highlights");
    expect(digest).not.toMatch(/^## Highlights/m);
  });

  it("skips sources with no renderable highlights", () => {
    const digest = buildHighlightsDigest(
      [
        {
          title: "Empty",
          sourceUrl: "https://x.com/test/status/2",
          highlights: [],
        },
      ],
      "2026-07-27",
    );
    expect(digest).toContain("No highlights or notes yet.");
    expect(digest).not.toContain("## Empty");
  });
});
