import { useMemo } from "react";
import parse from "html-react-parser";
import { paragraphizeText, paragraphHtml, textClassForMode } from "./utils";

interface Props {
  text: string;
  compact?: boolean;
  style?: "tweet" | "article";
  sectionIdPrefix?: string;
}

export function RichTextBlock({ text, compact = false, style = "tweet", sectionIdPrefix }: Props) {
  const paragraphs = useMemo(
    () => paragraphizeText(text, style),
    [text, style],
  );
  const keyedParagraphs = useMemo(() => {
    const seen = new Map<string, number>();
    return paragraphs.map((paragraph, order) => {
      const count = seen.get(paragraph) ?? 0;
      seen.set(paragraph, count + 1);
      return {
        paragraph,
        key: count === 0 ? paragraph : `${paragraph}-${count}`,
        sectionId: sectionIdPrefix ? `${sectionIdPrefix}-${order}` : undefined,
      };
    });
  }, [paragraphs, sectionIdPrefix]);
  const textClass = textClassForMode(compact);

  if (paragraphs.length === 0) return null;

  const spacingClass = compact ? "space-y-3" : style === "article" ? "space-y-7" : "space-y-6";

  return (
    <div className={spacingClass}>
      {keyedParagraphs.map(({ paragraph, key, sectionId }) => (
        <p
          key={key}
          id={sectionId}
          className={textClass}
        >
          {parse(paragraphHtml(paragraph))}
        </p>
      ))}
    </div>
  );
}
