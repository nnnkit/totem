import { expandCompound, tokenizeWithOffsets, type TokenSpan } from "./tokenize";

/**
 * Output is intentionally structured (no HTML strings).
 * Renderers map segments to React nodes; React handles all text-escaping.
 */
export interface HighlightSegment {
  text: string;
  isMatch: boolean;
}

export interface FieldHighlight {
  segments: HighlightSegment[];
  /** Number of distinct query terms that matched in this field. */
  matchedTermCount: number;
}

/** Set of tokens the user is searching for, lowercased. */
export type QueryTerms = ReadonlySet<string>;

/**
 * Build a highlight view of `raw` constrained to the best window of
 * `windowTokens` tokens. Returns null when nothing matches.
 *
 * The window is chosen to contain the maximum number of distinct matched
 * terms; ties broken toward the earliest hit. Truncated edges are marked
 * with leading/trailing ellipsis.
 */
export function highlightField(
  raw: string,
  terms: QueryTerms,
  windowTokens: number,
): FieldHighlight | null {
  if (!raw || terms.size === 0) return null;
  const tokens = tokenizeWithOffsets(raw);
  if (tokens.length === 0) return null;

  const hitIndices: number[] = [];
  const hitTermsByIndex: Map<number, string> = new Map();

  for (let i = 0; i < tokens.length; i++) {
    const tk = tokens[i];
    const matched = matchToken(tk.token, terms);
    if (matched) {
      hitIndices.push(i);
      hitTermsByIndex.set(i, matched);
    }
  }
  if (hitIndices.length === 0) return null;

  const window = pickWindow(tokens, hitIndices, windowTokens);
  const segments = sliceWindow(raw, tokens, window, hitIndices);
  const distinctTerms = new Set<string>();
  for (const idx of hitIndices) {
    if (idx >= window.startTokenIdx && idx <= window.endTokenIdx) {
      const term = hitTermsByIndex.get(idx);
      if (term) distinctTerms.add(term);
    }
  }
  return { segments, matchedTermCount: distinctTerms.size };
}

/**
 * Return the matched query term if `tokenLower` matches anything in `terms`.
 * Match modes (in order):
 *  - exact: terms.has(token)
 *  - prefix: term that is a prefix of token (mirrors MiniSearch prefix mode)
 *  - compound: term that prefixes a sub-word of a compound token (e.g. query
 *    `abram` matches `dan_abramov` because the sub-word `abramov` starts with
 *    it). Mirrors the index-side compound expansion in engine.ts.
 */
function matchToken(tokenLower: string, terms: QueryTerms): string | null {
  if (terms.has(tokenLower)) return tokenLower;
  for (const term of terms) {
    if (term.length >= 2 && tokenLower.startsWith(term)) return term;
  }
  // Compound check: only if the token has a separator or camelCase.
  if (
    tokenLower.includes("_") ||
    tokenLower.includes("-") ||
    tokenLower.includes(".") ||
    /[A-Z]|\d/.test(tokenLower)
  ) {
    const subs = expandCompound(tokenLower);
    for (const term of terms) {
      if (term.length < 2) continue;
      for (const sub of subs) {
        if (sub === tokenLower) continue; // already checked above
        if (sub === term) return term;
        if (sub.startsWith(term)) return term;
      }
    }
  }
  return null;
}

interface Window {
  startTokenIdx: number;
  endTokenIdx: number;
}

/**
 * Pick the contiguous span of `windowTokens` consecutive tokens that contains
 * the most distinct matched terms.
 */
function pickWindow(
  tokens: TokenSpan[],
  hitIndices: number[],
  windowTokens: number,
): Window {
  if (tokens.length <= windowTokens) {
    return { startTokenIdx: 0, endTokenIdx: tokens.length - 1 };
  }

  let bestStart = Math.max(0, hitIndices[0] - Math.floor(windowTokens / 2));
  let bestScore = -1;

  // Sliding window over candidate starts. Anchor at each hit so we don't scan
  // every position — the optimum always begins at most windowTokens before a hit.
  const seenStart = new Set<number>();
  for (const hit of hitIndices) {
    const start = Math.max(0, hit - windowTokens + 1);
    if (seenStart.has(start)) continue;
    seenStart.add(start);
    const end = Math.min(tokens.length - 1, start + windowTokens - 1);
    const score = countDistinctHits(hitIndices, start, end);
    if (score > bestScore) {
      bestScore = score;
      bestStart = start;
    }
  }

  // Also try anchoring exactly at each hit (window starts at the hit).
  for (const hit of hitIndices) {
    const start = hit;
    if (seenStart.has(start)) continue;
    seenStart.add(start);
    const end = Math.min(tokens.length - 1, start + windowTokens - 1);
    const score = countDistinctHits(hitIndices, start, end);
    if (score > bestScore) {
      bestScore = score;
      bestStart = start;
    }
  }

  return {
    startTokenIdx: bestStart,
    endTokenIdx: Math.min(tokens.length - 1, bestStart + windowTokens - 1),
  };
}

function countDistinctHits(
  hitIndices: number[],
  start: number,
  end: number,
): number {
  let count = 0;
  for (const i of hitIndices) {
    if (i >= start && i <= end) count++;
  }
  return count;
}

function sliceWindow(
  raw: string,
  tokens: TokenSpan[],
  window: Window,
  hitIndices: number[],
): HighlightSegment[] {
  const hits = new Set(hitIndices);
  const segments: HighlightSegment[] = [];
  const startToken = tokens[window.startTokenIdx];
  const endToken = tokens[window.endTokenIdx];

  // Leading ellipsis if the window doesn't start at the beginning.
  if (window.startTokenIdx > 0) {
    segments.push({ text: "… ", isMatch: false });
  }

  let cursor = startToken.start;
  for (let i = window.startTokenIdx; i <= window.endTokenIdx; i++) {
    const tk = tokens[i];
    if (tk.start > cursor) {
      segments.push({ text: raw.slice(cursor, tk.start), isMatch: false });
    }
    segments.push({ text: tk.original, isMatch: hits.has(i) });
    cursor = tk.end;
  }
  if (cursor < endToken.end) {
    segments.push({ text: raw.slice(cursor, endToken.end), isMatch: false });
  }

  if (window.endTokenIdx < tokens.length - 1) {
    segments.push({ text: " …", isMatch: false });
  }

  return mergeAdjacentNonMatch(segments);
}

function mergeAdjacentNonMatch(
  segments: HighlightSegment[],
): HighlightSegment[] {
  const out: HighlightSegment[] = [];
  for (const s of segments) {
    const last = out[out.length - 1];
    if (last && !last.isMatch && !s.isMatch) {
      last.text += s.text;
    } else {
      out.push({ ...s });
    }
  }
  return out;
}

/**
 * Convenience: run the user's raw query string through the same tokenizer
 * the index uses, returning the lowercased terms suitable for highlighting.
 */
export function queryToTerms(query: string): Set<string> {
  const terms = new Set<string>();
  if (!query) return terms;
  const trimmed = query.trim();
  if (!trimmed) return terms;
  // Reuse the index tokenizer so handle/hash/cashtag forms align with the index.
  const tokens = tokenizeWithOffsets(trimmed);
  for (const tk of tokens) {
    terms.add(tk.token);
    const first = tk.token.charCodeAt(0);
    if (first === 0x40 || first === 0x23 || first === 0x24) {
      // Also add bare-word variant so "@elon" highlights "elon" inside text.
      terms.add(tk.token.slice(1));
    }
  }
  return terms;
}
