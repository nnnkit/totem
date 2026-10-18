import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RichTextBlock } from "../TweetText";
import { styleParagraphSegments } from "../utils";

// Trimmed from a real long post (note_tweet with richtext_tags).
const text =
  "A few thoughts, tips & tricks:\n\nWriting. Ask your LLM to explain it in ASD-STE100, see https://example.com/x\n\nIn summary: try @karpathy's tips";
const styles = [
  { start: text.indexOf("Writing"), end: text.indexOf("Writing") + "Writing".length, style: "bold" as const },
  { start: text.indexOf("In summary:"), end: text.indexOf("In summary:") + "In summary:".length, style: "bold" as const },
  { start: text.indexOf("explain"), end: text.indexOf("explain") + "explain".length, style: "italic" as const },
];

function paragraphTexts(html: string): string[] {
  return Array.from(html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g), (m) =>
    m[1].replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&#x27;/g, "'"),
  );
}

describe("RichTextBlock text styles", () => {
  it("renders bold and italic ranges as elements", () => {
    const html = renderToStaticMarkup(<RichTextBlock text={text} textStyles={styles} />);
    expect(html).toContain('<strong class="font-semibold">Writing</strong>');
    expect(html).toContain('<strong class="font-semibold">In summary:</strong>');
    expect(html).toContain("<em>explain</em>");
    expect(html).toContain('<a href="https://example.com/x"');
  });

  it("keeps each paragraph's text identical so highlights stay anchored", () => {
    const plain = renderToStaticMarkup(<RichTextBlock text={text} sectionIdPrefix="s" />);
    const styled = renderToStaticMarkup(<RichTextBlock text={text} textStyles={styles} sectionIdPrefix="s" />);
    expect(paragraphTexts(styled)).toEqual(paragraphTexts(plain));
    expect(paragraphTexts(styled)).toHaveLength(3);
  });

  it("falls back to unstyled paragraphs when one can't be located", () => {
    expect(styleParagraphSegments("abc", ["zzz"], styles)).toBeNull();
  });
});
