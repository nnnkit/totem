export function compactText(value: string): string {
  return value.replace(/[^\S\n]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

export function expandText(
  text: string,
  urls: { url: string; expanded_url: string }[],
): string {
  for (const url of urls) {
    if (url.url && url.expanded_url) {
      text = text.split(url.url).join(url.expanded_url);
    }
  }

  // Strip remaining t.co media URLs that cannot be expanded from entities.
  return text.replace(/https?:\/\/t\.co\/\S+/g, "").trim();
}

export function profileImageUrl(value: unknown): string {
  const url = typeof value === "string" ? value : "";
  return url.replace("_normal", "_bigger");
}

export function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

import { COMPACT_PREVIEW_MAX, TRUNCATE_LABEL_MAX } from "./constants";

export function compactPreview(text: string, maxChars = COMPACT_PREVIEW_MAX): string {
  const value = text.replace(/\s+/g, " ").trim();
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars).trimEnd()}...`;
}

export function truncateLabel(text: string, maxLen = TRUNCATE_LABEL_MAX): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= maxLen) return clean;
  return `${clean.slice(0, maxLen).trimEnd()}\u2026`;
}

export function formatCompactNumber(n: number): string {
  return new Intl.NumberFormat("en", { notation: "compact" }).format(n);
}
