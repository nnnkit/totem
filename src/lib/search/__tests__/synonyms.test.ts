import { describe, expect, it } from "vitest";
import { expandSynonymQueries } from "../synonyms";

describe("expandSynonymQueries", () => {
  it("returns just the verbatim query when no synonyms apply", () => {
    expect(expandSynonymQueries("react")).toEqual(["react"]);
  });

  it("expands a single abbreviation to canonical alternates", () => {
    const out = expandSynonymQueries("js");
    expect(out[0]).toBe("js"); // verbatim first
    expect(out).toContain("javascript");
    expect(out).toContain("ecmascript");
  });

  it("expands per-token alternates and combines", () => {
    const out = expandSynonymQueries("js performance");
    expect(out[0]).toBe("js performance");
    expect(out).toContain("javascript performance");
    expect(out).toContain("ecmascript performance");
  });

  it("does not expand operator tokens", () => {
    const out = expandSynonymQueries("from:elonmusk js");
    for (const q of out) expect(q).toContain("from:elonmusk");
  });

  it("does not expand quoted phrases", () => {
    const out = expandSynonymQueries('"deep work" js');
    for (const q of out) expect(q).toContain('"deep work"');
  });

  it("does not expand sigil tokens", () => {
    expect(expandSynonymQueries("@js")).toEqual(["@js"]);
    expect(expandSynonymQueries("#js")).toEqual(["#js"]);
    expect(expandSynonymQueries("$js")).toEqual(["$js"]);
  });

  it("caps explosion at MAX_EXPANSIONS", () => {
    const out = expandSynonymQueries("js ts ai db");
    expect(out.length).toBeLessThanOrEqual(8);
    expect(out[0]).toBe("js ts ai db"); // verbatim still first
  });
});
