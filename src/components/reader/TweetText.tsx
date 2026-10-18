import { Fragment, type ReactNode, useMemo } from "react";
import parse from "html-react-parser";
import type { TextStyleRange } from "../../types";
import {
  paragraphizeText,
  paragraphHtml,
  styleParagraphSegments,
  textClassForMode,
  type StyledSegment,
} from "./utils";

interface Props {
  text: string;
  textStyles?: TextStyleRange[];
  compact?: boolean;
  style?: "tweet" | "article";
  sectionIdPrefix?: string;
}

function StyledSegments({ segments }: { segments: StyledSegment[] }) {
  return segments.map((segment, index) => {
    let node: ReactNode = parse(paragraphHtml(segment.text));
    if (segment.italic) node = <em>{node}</em>;
    if (segment.bold) node = <strong className="font-semibold">{node}</strong>;
    return <Fragment key={index}>{node}</Fragment>;
  });
}

export function RichTextBlock({ text, textStyles, compact = false, style = "tweet", sectionIdPrefix }: Props) {
  const paragraphs = useMemo(
    () => paragraphizeText(text, style),
    [text, style],
  );
  const styled = useMemo(
    () => (textStyles?.length ? styleParagraphSegments(text, paragraphs, textStyles) : null),
    [text, paragraphs, textStyles],
  );
  const keyedParagraphs = useMemo(() => {
    const seen = new Map<string, number>();
    return paragraphs.map((paragraph, order) => {
      const count = seen.get(paragraph) ?? 0;
      seen.set(paragraph, count + 1);
      return {
        paragraph,
        order,
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
      {keyedParagraphs.map(({ paragraph, order, key, sectionId }) => (
        <p
          key={key}
          id={sectionId}
          className={textClass}
        >
          {styled ? <StyledSegments segments={styled[order]} /> : parse(paragraphHtml(paragraph))}
        </p>
      ))}
    </div>
  );
}
