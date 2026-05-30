import {
  Fragment,
  type ElementType,
  type ReactNode,
} from "react";
import { highlightField, type QueryTerms } from "../lib/search/highlight";
import { cn } from "../lib/cn";

interface HighlightedProps {
  /** Raw text to display. */
  text: string;
  /** Lowercased query terms; pass an empty set to render plain text. */
  terms: QueryTerms;
  /** Snippet window in tokens; default renders the entire string. */
  windowTokens?: number;
  /** Element to wrap output in (default span). */
  as?: ElementType;
  className?: string;
  /** Fallback to render when there's no match (defaults to plain `text`). */
  fallback?: ReactNode;
  /**
   * When true, render `null` if there's no match and `text` is provided.
   * Useful for snippet lines that should disappear when the body doesn't
   * match the active query.
   */
  hideOnNoMatch?: boolean;
}

/**
 * Renders `text` with matched query terms wrapped in `<mark>` elements.
 *
 * The highlighter returns structured `{ text, isMatch }` segments; this
 * component maps them to React children. Every text segment passes through
 * React's normal text-escaping — there is no raw-HTML output anywhere.
 */
export function Highlighted({
  text,
  terms,
  windowTokens = 999,
  as: Tag = "span",
  className,
  fallback,
  hideOnNoMatch = false,
}: HighlightedProps) {
  if (!text) return null;

  if (terms.size === 0) {
    if (hideOnNoMatch) return null;
    return <Tag className={className}>{text}</Tag>;
  }

  const result = highlightField(text, terms, windowTokens);
  if (!result) {
    if (hideOnNoMatch) return null;
    return <Tag className={className}>{fallback ?? text}</Tag>;
  }

  let offset = 0;
  const segments = result.segments.map((seg) => {
    const key = `${offset}-${seg.text}`;
    offset += seg.text.length;
    return { ...seg, key };
  });

  return (
    <Tag className={className}>
      {segments.map((seg) =>
        seg.isMatch ? (
          <mark
            key={seg.key}
            className={cn(
              "rounded-sm bg-amber-200/70 px-px text-foreground",
              "dark:bg-amber-400/30",
            )}
          >
            {seg.text}
          </mark>
        ) : (
          <Fragment key={seg.key}>{seg.text}</Fragment>
        ),
      )}
    </Tag>
  );
}
