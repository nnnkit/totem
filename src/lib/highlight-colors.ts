export const HIGHLIGHT_COLORS = ["classic", "yellow", "mint", "dark"] as const;

export type HighlightColor = (typeof HIGHLIGHT_COLORS)[number];

export const DEFAULT_HIGHLIGHT_COLOR: HighlightColor = "classic";

const KNOWN = new Set<string>(HIGHLIGHT_COLORS);

export function resolveHighlightColor(raw: string | null | undefined): HighlightColor {
  return raw && KNOWN.has(raw) ? (raw as HighlightColor) : DEFAULT_HIGHLIGHT_COLOR;
}
