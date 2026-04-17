import type { Bookmark, BookmarkIntent } from "../types";

export interface ClassifyResult {
  intent: BookmarkIntent;
  confidence: number;
  source: "structural";
}

const REFERENCE_URL_PATTERNS: RegExp[] = [
  /github\.com(?:\/|$)/i,
  /arxiv\.org/i,
  /readthedocs\.(io|org)/i,
  /\bdocs\./i,
  /\bdeveloper\./i,
  /\bapi\./i,
  /\/docs(?:\/|$)/i,
  /\/api(?:\/|$)/i,
  /npmjs\.com/i,
  /pypi\.org/i,
  /crates\.io/i,
  /pkg\.go\.dev/i,
  /mdn\.mozilla\.org/i,
  /stackoverflow\.com/i,
];

const READ_SOON_URL_PATTERNS: RegExp[] = [
  /youtube\.com/i,
  /youtu\.be/i,
  /medium\.com/i,
  /substack\.com/i,
  /\bblog\./i,
  /\/blog(?:\/|$)/i,
];

const THREAD_OPENER = /^(?:1[/.)]\s|🧵)/;

const CONFIDENCE_THRESHOLD = 0.8;

function matchUrl(
  urls: Bookmark["urls"],
  patterns: RegExp[],
): boolean {
  for (const u of urls) {
    const href = u.expandedUrl || u.url;
    if (!href) continue;
    for (const p of patterns) {
      if (p.test(href)) return true;
    }
  }
  return false;
}

export function classify(bookmark: Bookmark): ClassifyResult | null {
  const urls = bookmark.urls ?? [];

  if (matchUrl(urls, REFERENCE_URL_PATTERNS)) {
    return { intent: "reference", confidence: 0.9, source: "structural" };
  }

  if (matchUrl(urls, READ_SOON_URL_PATTERNS)) {
    return { intent: "read_soon", confidence: 0.85, source: "structural" };
  }

  if (bookmark.tweetKind === "article") {
    return { intent: "read_soon", confidence: 0.9, source: "structural" };
  }

  if (bookmark.isThread) {
    return { intent: "read_soon", confidence: 0.85, source: "structural" };
  }

  const text = (bookmark.text ?? "").trim();

  if (THREAD_OPENER.test(text)) {
    return { intent: "read_soon", confidence: 0.85, source: "structural" };
  }

  if (!bookmark.hasLink && text.length > 0 && text.length < 180) {
    return { intent: "read_soon", confidence: 0.8, source: "structural" };
  }

  return null;
}

export function classifyBatch(bookmarks: Bookmark[]): Bookmark[] {
  const now = new Date().toISOString();
  const updated: Bookmark[] = [];

  for (const bm of bookmarks) {
    if (bm.intentSource === "manual") continue;
    if ((bm.intent ?? "unsorted") !== "unsorted") continue;

    const result = classify(bm);
    if (result && result.confidence >= CONFIDENCE_THRESHOLD) {
      updated.push({
        ...bm,
        intent: result.intent,
        intentSource: result.source,
        intentConfidence: result.confidence,
        intentAssignedAt: now,
      });
    }
  }

  return updated;
}
