/**
 * Tokenizer that preserves Twitter-shaped tokens (@handles, #tags, $cashtags),
 * URLs, and emoji as single tokens, and word-splits everything else.
 *
 * `processTerm` produces both the sigil-prefixed and bare-word variants for
 * @/#/$ tokens, so a stored "@elonmusk" is found by either "elon" (prefix
 * match on the bare form) or "@elonmusk" (literal).
 */

export const TOKEN_RE = /(?:[@#$][\p{L}\p{N}_]+|https?:\/\/\S+|[\p{L}\p{N}_]+)/gu;

export function tokenize(input: string): string[] {
  if (!input) return [];
  return Array.from(input.matchAll(TOKEN_RE), (m) => m[0]);
}

export function processTerm(term: string): string | string[] {
  const t = term.toLowerCase();
  if (t.length === 0) return t;
  const first = t.charCodeAt(0);
  // 0x40 = '@', 0x23 = '#', 0x24 = '$'
  if (first === 0x40 || first === 0x23 || first === 0x24) {
    return [t, t.slice(1)];
  }
  return t;
}

/**
 * Match offsets in a raw string. Returned spans are non-overlapping and sorted.
 */
export interface TokenSpan {
  /** Lowercased token. */
  token: string;
  /** Original token (case preserved) for rendering. */
  original: string;
  /** Inclusive start offset in the source string. */
  start: number;
  /** Exclusive end offset in the source string. */
  end: number;
}

export function tokenizeWithOffsets(input: string): TokenSpan[] {
  if (!input) return [];
  const out: TokenSpan[] = [];
  for (const m of input.matchAll(TOKEN_RE)) {
    if (m.index == null) continue;
    out.push({
      token: m[0].toLowerCase(),
      original: m[0],
      start: m.index,
      end: m.index + m[0].length,
    });
  }
  return out;
}

/**
 * Split a compound token (handle, domain, camelCase identifier) into its
 * sub-words. The full token is always included as the first element so
 * exact-token matches still work.
 *
 * Examples:
 *   "dan_abramov"    → ["dan_abramov", "dan", "abramov"]
 *   "elonMusk"       → ["elonmusk", "elon", "musk"]
 *   "github.com"     → ["github.com", "github", "com"]
 *   "open-ai"        → ["open-ai", "open", "ai"]
 *   "user123abc"     → ["user123abc", "user", "123", "abc"]
 *   "@dan_abramov"   → ["@dan_abramov", "dan", "abramov"]  (sigil dropped on subwords)
 */
export function expandCompound(token: string): string[] {
  if (!token) return [];
  const lower = token.toLowerCase();
  const out = new Set<string>();
  out.add(lower);

  // Strip a leading sigil before splitting; subwords are bare.
  const sigil = lower.charCodeAt(0);
  const stripped =
    sigil === 0x40 || sigil === 0x23 || sigil === 0x24
      ? lower.slice(1)
      : lower;

  // Split on common separators AND camelCase / digit boundaries (operate on
  // the original cased token for camelCase detection, then lowercase parts).
  const cased =
    sigil === 0x40 || sigil === 0x23 || sigil === 0x24
      ? token.slice(1)
      : token;

  // Insert spaces at boundaries: lower→Upper, letter↔digit.
  const withBoundaries = cased
    .replace(/([a-zÀ-ſ])([A-Z])/g, "$1 $2")
    .replace(/([A-Za-z])(\d)/g, "$1 $2")
    .replace(/(\d)([A-Za-z])/g, "$1 $2");

  for (const part of withBoundaries.split(/[_\-.\s]+/)) {
    if (part.length >= 2) {
      out.add(part.toLowerCase());
    }
  }

  // If splitting produced nothing extra (e.g. 'foo' has no boundaries),
  // also try the stripped form so handles still get the bare-word variant.
  if (stripped !== lower) out.add(stripped);

  return Array.from(out);
}
