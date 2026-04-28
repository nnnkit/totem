import { describe, expect, it } from "vitest";
import {
  expandCompound,
  processTerm,
  tokenize,
  tokenizeWithOffsets,
} from "../tokenize";

describe("tokenize", () => {
  it("returns [] on empty input", () => {
    expect(tokenize("")).toEqual([]);
  });

  it("preserves @handles as single tokens", () => {
    expect(tokenize("hello @elonmusk world")).toEqual([
      "hello",
      "@elonmusk",
      "world",
    ]);
  });

  it("preserves #hashtags and $cashtags", () => {
    expect(tokenize("react #frontend $TSLA")).toEqual([
      "react",
      "#frontend",
      "$TSLA",
    ]);
  });

  it("preserves URLs as single tokens", () => {
    expect(tokenize("see https://github.com/foo/bar today")).toEqual([
      "see",
      "https://github.com/foo/bar",
      "today",
    ]);
  });

  it("splits on punctuation but keeps Unicode letters", () => {
    expect(tokenize("naïve, café — résumé")).toEqual([
      "naïve",
      "café",
      "résumé",
    ]);
  });
});

describe("processTerm", () => {
  it("lowercases plain words", () => {
    expect(processTerm("React")).toBe("react");
  });

  it("emits both literal and bare-word for @handles", () => {
    expect(processTerm("@ElonMusk")).toEqual(["@elonmusk", "elonmusk"]);
  });

  it("emits both literal and bare-word for #tags", () => {
    expect(processTerm("#Frontend")).toEqual(["#frontend", "frontend"]);
  });

  it("emits both literal and bare-word for $cashtags", () => {
    expect(processTerm("$TSLA")).toEqual(["$tsla", "tsla"]);
  });

  it("returns empty for empty input", () => {
    expect(processTerm("")).toBe("");
  });
});

describe("expandCompound", () => {
  it("includes the original token first", () => {
    expect(expandCompound("dan_abramov")).toContain("dan_abramov");
  });

  it("splits underscore-separated compounds", () => {
    const out = expandCompound("dan_abramov");
    expect(out).toContain("dan");
    expect(out).toContain("abramov");
  });

  it("splits camelCase identifiers", () => {
    const out = expandCompound("elonMusk");
    expect(out).toContain("elon");
    expect(out).toContain("musk");
  });

  it("splits dotted domains", () => {
    const out = expandCompound("github.com");
    expect(out).toContain("github");
    expect(out).toContain("com");
  });

  it("splits hyphenated names", () => {
    const out = expandCompound("open-ai");
    expect(out).toContain("open");
    expect(out).toContain("ai");
  });

  it("splits letter↔digit boundaries", () => {
    const out = expandCompound("user123abc");
    expect(out).toContain("user");
    expect(out).toContain("123");
    expect(out).toContain("abc");
  });

  it("strips leading sigil from sub-words", () => {
    const out = expandCompound("@dan_abramov");
    expect(out).toContain("@dan_abramov");
    expect(out).toContain("dan");
    expect(out).toContain("abramov");
    expect(out).not.toContain("@dan");
  });

  it("does not emit single-character fragments", () => {
    const out = expandCompound("a_b_long");
    expect(out).not.toContain("a");
    expect(out).not.toContain("b");
    expect(out).toContain("long");
  });
});

describe("tokenizeWithOffsets", () => {
  it("returns offsets matching the source string", () => {
    const text = "hello @elon";
    const tokens = tokenizeWithOffsets(text);
    expect(tokens).toHaveLength(2);
    expect(text.slice(tokens[0].start, tokens[0].end)).toBe("hello");
    expect(text.slice(tokens[1].start, tokens[1].end)).toBe("@elon");
  });

  it("preserves original case while lowercasing the token field", () => {
    const tokens = tokenizeWithOffsets("Hello @ElonMusk");
    expect(tokens[0].original).toBe("Hello");
    expect(tokens[0].token).toBe("hello");
    expect(tokens[1].original).toBe("@ElonMusk");
    expect(tokens[1].token).toBe("@elonmusk");
  });
});
