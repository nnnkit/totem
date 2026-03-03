import { describe, expect, it } from "vitest";
import { decodeHtmlEntities } from "../text";

describe("decodeHtmlEntities", () => {
  it("decodes named and numeric entities", () => {
    expect(decodeHtmlEntities("Tom &amp; Jerry &#39; &#x1F600;")).toBe(
      "Tom & Jerry ' 😀",
    );
  });

  it("unwraps double-encoded numeric entities", () => {
    expect(decodeHtmlEntities("Value: &amp;#39;")).toBe("Value: '");
  });

  it("keeps invalid numeric entities unchanged instead of throwing", () => {
    const input = "Bad: &#9999999999; and &#x110000;";

    expect(() => decodeHtmlEntities(input)).not.toThrow();
    expect(decodeHtmlEntities(input)).toBe(input);
  });
});
