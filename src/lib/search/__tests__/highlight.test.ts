import { describe, expect, it } from "vitest";
import { highlightField, queryToTerms } from "../highlight";

describe("highlightField", () => {
  it("returns null when no terms match", () => {
    const out = highlightField("hello world", new Set(["xyz"]), 30);
    expect(out).toBeNull();
  });

  it("returns null on empty input", () => {
    expect(highlightField("", new Set(["a"]), 30)).toBeNull();
  });

  it("marks exact-match tokens as isMatch=true and rest as false", () => {
    const out = highlightField(
      "hello deep work world",
      new Set(["deep"]),
      30,
    );
    expect(out).not.toBeNull();
    const text = out!.segments.map((s) => s.text).join("");
    expect(text).toContain("deep");
    const matches = out!.segments.filter((s) => s.isMatch);
    expect(matches).toHaveLength(1);
    expect(matches[0].text).toBe("deep");
  });

  it("marks all occurrences in the snippet, not just the first", () => {
    const out = highlightField(
      "deep work matters and deep focus matters",
      new Set(["deep"]),
      30,
    );
    const matches = out!.segments.filter((s) => s.isMatch);
    expect(matches.map((m) => m.text)).toEqual(["deep", "deep"]);
  });

  it("supports prefix matches", () => {
    const out = highlightField(
      "elonmusk says hi",
      new Set(["elon"]),
      30,
    );
    const matches = out!.segments.filter((s) => s.isMatch);
    expect(matches.map((m) => m.text)).toEqual(["elonmusk"]);
  });

  it("counts distinct matched terms", () => {
    const out = highlightField(
      "react hooks pattern react reducer",
      new Set(["react", "hooks"]),
      30,
    );
    expect(out!.matchedTermCount).toBe(2);
  });

  it("never builds an HTML string — segments are plain text", () => {
    const out = highlightField(
      'click <script>alert("xss")</script> please',
      new Set(["script"]),
      30,
    );
    // Output is structured segments. The literal "<" and ">" sit inside
    // segment.text fields and never become HTML; the renderer hands them to
    // React as text children.
    expect(out).not.toBeNull();
    const joined = out!.segments.map((s) => s.text).join("");
    expect(joined).toContain("<script>");
    const markTagPattern = /<\/?mark/;
    // No segment text starts with a literal HTML mark wrapper.
    for (const seg of out!.segments) {
      expect(markTagPattern.test(seg.text)).toBe(false);
    }
  });
});

describe("queryToTerms", () => {
  it("returns an empty set for empty input", () => {
    expect(queryToTerms("")).toEqual(new Set());
    expect(queryToTerms("   ")).toEqual(new Set());
  });

  it("lowercases plain words", () => {
    expect(queryToTerms("Deep Work")).toEqual(new Set(["deep", "work"]));
  });

  it("includes both sigil and bare variant for @handles", () => {
    expect(queryToTerms("@ElonMusk")).toEqual(
      new Set(["@elonmusk", "elonmusk"]),
    );
  });

  it("handles mixed queries", () => {
    expect(queryToTerms("hooks @swyx #react")).toEqual(
      new Set(["hooks", "@swyx", "swyx", "#react", "react"]),
    );
  });
});
