import { describe, expect, it } from "vitest";
import {
  collectFreeTextTerms,
  freeTextQuery,
  parseQuery,
  type Ast,
} from "../parser";

describe("parseQuery", () => {
  it("returns empty for blank input", () => {
    expect(parseQuery("")).toEqual({ kind: "empty" });
    expect(parseQuery("   ")).toEqual({ kind: "empty" });
  });

  it("parses a single word as a term", () => {
    expect(parseQuery("react")).toEqual({ kind: "term", value: "react" });
  });

  it("parses adjacent words as implicit AND", () => {
    const ast = parseQuery("react hooks");
    expect(ast.kind).toBe("and");
    if (ast.kind === "and") {
      expect(ast.children.map((c: Ast) => c.kind)).toEqual(["term", "term"]);
    }
  });

  it("parses uppercase OR", () => {
    const ast = parseQuery("react OR vue");
    expect(ast.kind).toBe("or");
  });

  it("treats lowercase 'or' as a term, not an operator", () => {
    const ast = parseQuery("react or vue");
    expect(ast.kind).toBe("and");
  });

  it("parses negation with leading -", () => {
    const ast = parseQuery("-react");
    expect(ast.kind).toBe("not");
    if (ast.kind === "not") {
      expect(ast.child).toEqual({ kind: "term", value: "react" });
    }
  });

  it("parses uppercase NOT", () => {
    const ast = parseQuery("NOT react");
    expect(ast.kind).toBe("not");
  });

  it("parses quoted phrases", () => {
    expect(parseQuery('"deep work"')).toEqual({
      kind: "phrase",
      value: "deep work",
    });
  });

  it("parses parenthesized groups", () => {
    const ast = parseQuery("(react OR vue) hooks");
    expect(ast.kind).toBe("and");
  });

  it("parses from: operator", () => {
    expect(parseQuery("from:elonmusk")).toEqual({
      kind: "operator",
      key: "from",
      value: "elonmusk",
    });
  });

  it("treats @handle as from: sugar", () => {
    expect(parseQuery("@elonmusk")).toEqual({
      kind: "operator",
      key: "from",
      value: "elonmusk",
    });
  });

  it("parses has: and filter: operators", () => {
    expect(parseQuery("has:image")).toEqual({
      kind: "operator",
      key: "has",
      value: "image",
    });
    expect(parseQuery("filter:videos")).toEqual({
      kind: "operator",
      key: "filter",
      value: "videos",
    });
  });

  it("parses min_faves: operator", () => {
    expect(parseQuery("min_faves:1000")).toEqual({
      kind: "operator",
      key: "min_faves",
      value: "1000",
    });
  });

  it("aliases min_likes → min_faves", () => {
    expect(parseQuery("min_likes:1000")).toEqual({
      kind: "operator",
      key: "min_faves",
      value: "1000",
    });
  });

  it("parses since: with ISO date", () => {
    expect(parseQuery("since:2025-01-01")).toEqual({
      kind: "operator",
      key: "since",
      value: "2025-01-01",
    });
  });

  it("parses combined operators with free text", () => {
    const ast = parseQuery("from:elonmusk has:image react");
    expect(ast.kind).toBe("and");
    if (ast.kind === "and") {
      expect(ast.children).toHaveLength(3);
      expect(ast.children[0].kind).toBe("operator");
      expect(ast.children[1].kind).toBe("operator");
      expect(ast.children[2].kind).toBe("term");
    }
  });

  it("treats unknown operator-like input as a term", () => {
    const ast = parseQuery("nope:thing");
    expect(ast.kind).toBe("term");
    if (ast.kind === "term") {
      expect(ast.value).toBe("nope:thing");
    }
  });

  it("survives unbalanced parens", () => {
    const ast = parseQuery("(react");
    expect(ast.kind).toBe("term");
  });

  it("survives a stray closing paren", () => {
    const ast = parseQuery("react)");
    // Parser tolerates the stray paren and yields just the term.
    expect(ast.kind).toBe("term");
  });

  it("survives an unterminated quote (treats rest as the phrase)", () => {
    const ast = parseQuery('"deep work');
    expect(ast.kind).toBe("phrase");
  });
});

describe("collectFreeTextTerms / freeTextQuery", () => {
  it("returns the term values, excluding operators", () => {
    const ast = parseQuery("from:elonmusk react hooks");
    expect(collectFreeTextTerms(ast)).toEqual(["react", "hooks"]);
    expect(freeTextQuery(ast)).toBe("react hooks");
  });

  it("includes phrase values", () => {
    const ast = parseQuery('"deep work" focus');
    expect(collectFreeTextTerms(ast)).toEqual(["deep work", "focus"]);
  });

  it("excludes negated subtrees from highlighting terms", () => {
    const ast = parseQuery("react -typescript");
    expect(collectFreeTextTerms(ast)).toEqual(["react"]);
  });

  it("handles operator-only queries", () => {
    const ast = parseQuery("from:elonmusk has:image");
    expect(collectFreeTextTerms(ast)).toEqual([]);
    expect(freeTextQuery(ast).trim()).toBe("");
  });
});
