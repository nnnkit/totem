import type { Bookmark, BookmarkIntent } from "../types";

export interface ClassifyResult {
  intent: BookmarkIntent;
  confidence: number;
  source: "structural" | "keyword";
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

// --- Layer 2: keyword + signal scoring ---

interface KeywordRule {
  pattern: RegExp;
  intent: BookmarkIntent;
  weight: number;
}

const KEYWORD_RULES: KeywordRule[] = [
  // act_on patterns
  { pattern: /\bDM me\b/i, intent: "act_on", weight: 1.5 },
  { pattern: /\bsign up\b/i, intent: "act_on", weight: 1.0 },
  { pattern: /\bapply\s+(now|here|today)\b/i, intent: "act_on", weight: 1.2 },
  { pattern: /\bregister\s+(now|here|today)\b/i, intent: "act_on", weight: 1.0 },
  { pattern: /\bdeadline\b/i, intent: "act_on", weight: 1.0 },
  { pattern: /\blast\s+(day|chance)\b/i, intent: "act_on", weight: 1.0 },
  { pattern: /\blimited\s+(spots?|seats?|time)\b/i, intent: "act_on", weight: 1.0 },
  { pattern: /\bhiring\b/i, intent: "act_on", weight: 0.8 },
  { pattern: /\bopen\s+roles?\b/i, intent: "act_on", weight: 0.8 },
  { pattern: /\bjoin\s+(us|our)\b/i, intent: "act_on", weight: 0.6 },
  { pattern: /\blanuch(ing|ed)?\b/i, intent: "act_on", weight: 0.6 },
  { pattern: /\bwaitlist\b/i, intent: "act_on", weight: 0.8 },

  // reference patterns (cheat-sheet / resource language)
  { pattern: /\bcheat\s*sheet\b/i, intent: "reference", weight: 1.5 },
  { pattern: /\bresources?\b/i, intent: "reference", weight: 0.6 },
  { pattern: /\bhandbook\b/i, intent: "reference", weight: 1.0 },
  { pattern: /\breference\s+guide\b/i, intent: "reference", weight: 1.2 },
  { pattern: /\bcompilation\b/i, intent: "reference", weight: 0.8 },
  { pattern: /\blist\s+of\b/i, intent: "reference", weight: 0.6 },
  { pattern: /\bawesome[\s-]/i, intent: "reference", weight: 1.0 },
  { pattern: /\bcollection\s+of\b/i, intent: "reference", weight: 0.6 },
  { pattern: /\bbenchmark/i, intent: "reference", weight: 0.6 },
  { pattern: /\btoolkit\b/i, intent: "reference", weight: 0.6 },
  { pattern: /\bcomparison\b/i, intent: "reference", weight: 0.6 },

  // read_soon patterns (content language)
  { pattern: /\bdeep\s+dive\b/i, intent: "read_soon", weight: 1.0 },
  { pattern: /\bbreakdown\b/i, intent: "read_soon", weight: 0.6 },
  { pattern: /\bexplained\b/i, intent: "read_soon", weight: 0.6 },
  { pattern: /\blessons?\s+learned\b/i, intent: "read_soon", weight: 0.8 },
  { pattern: /\bmistakes?\s+(I|we)\b/i, intent: "read_soon", weight: 0.8 },
  { pattern: /\bunpopular\s+opinion\b/i, intent: "read_soon", weight: 0.6 },
  { pattern: /\bhot\s+take\b/i, intent: "read_soon", weight: 0.6 },
  { pattern: /\bhere'?s?\s+(what|how|why)\b/i, intent: "read_soon", weight: 0.5 },
  { pattern: /\bmust[\s-]read\b/i, intent: "read_soon", weight: 1.0 },
];

const L2_SCORE_THRESHOLD = 1.5;
const L2_MARGIN = 0.5;
const DAY_MS = 86_400_000;

function getTextForScoring(bookmark: Bookmark): string {
  const parts: string[] = [];
  if (bookmark.text) parts.push(bookmark.text);
  const cardTitle = bookmark.urls?.[0]?.card?.title;
  if (cardTitle) parts.push(cardTitle);
  return parts.join(" ");
}

export interface Layer2Context {
  hasHighlights?: boolean;
  now?: number;
}

export function classifyLayer2(
  bookmark: Bookmark,
  ctx: Layer2Context = {},
): ClassifyResult | null {
  const scores: Record<BookmarkIntent, number> = {
    read_soon: 0,
    reference: 0,
    act_on: 0,
    unsorted: 0,
  };

  const text = getTextForScoring(bookmark);

  for (const rule of KEYWORD_RULES) {
    if (rule.pattern.test(text)) {
      scores[rule.intent] += rule.weight;
    }
  }

  const now = ctx.now ?? Date.now();
  const ageMs = now - bookmark.createdAt;
  const ageDays = ageMs / DAY_MS;

  if (ageDays > 90) {
    scores.reference += 1;
    scores.read_soon -= 1;
  } else if (ageDays > 30) {
    scores.reference += 0.5;
  }

  if ((bookmark.metrics?.retweets ?? 0) > 500) {
    scores.reference += 0.5;
  }

  if (ctx.hasHighlights) {
    scores.reference += 1;
  }

  const intents: BookmarkIntent[] = ["read_soon", "reference", "act_on"];
  let best: BookmarkIntent = "unsorted";
  let bestScore = -Infinity;
  let secondScore = -Infinity;

  for (const intent of intents) {
    if (scores[intent] > bestScore) {
      secondScore = bestScore;
      bestScore = scores[intent];
      best = intent;
    } else if (scores[intent] > secondScore) {
      secondScore = scores[intent];
    }
  }

  if (bestScore < L2_SCORE_THRESHOLD) return null;
  if (bestScore - secondScore < L2_MARGIN) return null;

  const confidence = Math.min(0.6 + bestScore * 0.1, 0.95);
  return { intent: best, confidence, source: "keyword" };
}

export function classifyBatch(
  bookmarks: Bookmark[],
  highlightedTweetIds?: ReadonlySet<string>,
): Bookmark[] {
  const now = new Date().toISOString();
  const nowMs = Date.now();
  const updated: Bookmark[] = [];

  for (const bm of bookmarks) {
    if (bm.intentSource === "manual") continue;
    if ((bm.intent ?? "unsorted") !== "unsorted") continue;

    let result = classify(bm);

    if (!result || result.confidence < CONFIDENCE_THRESHOLD) {
      result = classifyLayer2(bm, {
        hasHighlights: highlightedTweetIds?.has(bm.tweetId),
        now: nowMs,
      });
    }

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
