import type { HighlightColor } from "../../types";

// ── Highlight colors ────────────────────────────────────────
export const HIGHLIGHT_COLORS: HighlightColor[] = ["yellow", "green", "blue", "pink", "purple"];

export const COLOR_VALUES: Record<HighlightColor, string> = {
  yellow: "rgb(250, 204, 21)",
  green: "rgb(170, 213, 118)",
  blue: "rgb(96, 165, 250)",
  pink: "rgb(244, 114, 182)",
  purple: "rgb(167, 139, 250)",
};

// ── Badge cutoff ────────────────────────────────────────────
export const NEW_BADGE_CUTOFF_MS = 24 * 60 * 60 * 1000;

// ── Text limits ─────────────────────────────────────────────
export const COMPACT_PREVIEW_MAX = 130;
export const TRUNCATE_LABEL_MAX = 48;
export const PICK_TITLE_MAX = 92;
export const PICK_EXCERPT_MAX = 210;

// ── Reading speed ───────────────────────────────────────────
export const READING_WPM = 180;
export const ARTICLE_READING_WPM = 200;
export const MIN_READING_MINUTES = 2;
