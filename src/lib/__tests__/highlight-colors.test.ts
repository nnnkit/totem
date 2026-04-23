import { describe, expect, it } from "vitest";
import {
  DEFAULT_HIGHLIGHT_COLOR,
  HIGHLIGHT_COLORS,
  resolveHighlightColor,
} from "../highlight-colors";

describe("resolveHighlightColor", () => {
  it("returns the default for empty string", () => {
    expect(resolveHighlightColor("")).toBe(DEFAULT_HIGHLIGHT_COLOR);
  });

  it("returns the default for null", () => {
    expect(resolveHighlightColor(null)).toBe(DEFAULT_HIGHLIGHT_COLOR);
  });

  it("returns the default for undefined", () => {
    expect(resolveHighlightColor(undefined)).toBe(DEFAULT_HIGHLIGHT_COLOR);
  });

  it("maps the legacy 'green' value to the default (classic)", () => {
    expect(resolveHighlightColor("green")).toBe("classic");
  });

  it("maps any unknown value to the default", () => {
    expect(resolveHighlightColor("magenta")).toBe("classic");
    expect(resolveHighlightColor("RED")).toBe("classic");
    expect(resolveHighlightColor(" classic ")).toBe("classic");
  });

  it("passes through every known color unchanged", () => {
    for (const c of HIGHLIGHT_COLORS) {
      expect(resolveHighlightColor(c)).toBe(c);
    }
  });

  it("default is classic", () => {
    expect(DEFAULT_HIGHLIGHT_COLOR).toBe("classic");
  });
});
