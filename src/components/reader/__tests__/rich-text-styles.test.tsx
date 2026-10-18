import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RichTextBlock } from "../TweetText";
import { styleParagraphSegments } from "../utils";

// Trimmed from a real long post (note_tweet text and its richtext_tags).
const text =
  "We'll be spending a lot more time trying to understand the outputs of language models. A few thoughts, tips & tricks:\n\nWriting. Something I've had success with: Ask your LLM to explain something in ASD-STE100, it's a controlled language specification originally developed for aerospace maintenance documentation. LLMs well-versed in this language and it comes with heavy constraints on clean writing style that I often find a lot more readable. Sometimes I've tried to soften it a bit e.g. ask for \"80% of the way to ASD-STE100\" because the spec is quite stringent. But even better:";
const styles = [{ start: 119, end: 126, style: "bold" as const }];

function paragraphTexts(html: string): string[] {
  return Array.from(html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g), (m) =>
    m[1].replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&#x27;/g, "'").replace(/&quot;/g, '"'),
  );
}

describe("RichTextBlock text styles", () => {
  it("renders the bold range as an element", () => {
    const html = renderToStaticMarkup(<RichTextBlock text={text} textStyles={styles} />);
    expect(html).toContain('<strong class="font-semibold">Writing</strong>. Something');
    expect(html.match(/<strong/g)).toHaveLength(1);
  });

  it("keeps each paragraph's text identical so highlights stay anchored", () => {
    const plain = renderToStaticMarkup(<RichTextBlock text={text} sectionIdPrefix="s" />);
    const styled = renderToStaticMarkup(<RichTextBlock text={text} textStyles={styles} sectionIdPrefix="s" />);
    expect(paragraphTexts(styled)).toEqual(paragraphTexts(plain));
    expect(paragraphTexts(styled)).toHaveLength(2);
  });

  it("falls back to unstyled paragraphs when one can't be located", () => {
    expect(styleParagraphSegments("abc", ["zzz"], styles)).toBeNull();
  });
});
