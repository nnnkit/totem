/**
 * Curated synonym map applied at QUERY time only.
 *
 * Why query-time, not index-time: editing this list never requires a
 * reindex. The cost is tiny — we duplicate the user's query a few times
 * with synonyms substituted, then run them in parallel and union.
 *
 * Doug Turnbull's *Why You Shouldn't Use Synonyms at Index Time*:
 *   https://opensourceconnections.com/blog/2017/11/21/solr-synonyms-mea-culpa/
 */

const SYNONYMS: Record<string, string[]> = {
  // Tech / programming
  js: ["javascript", "ecmascript"],
  javascript: ["js"],
  ts: ["typescript"],
  typescript: ["ts"],
  ai: ["ml", "artificial intelligence"],
  ml: ["ai", "machine learning"],
  llm: ["large language model"],
  db: ["database"],
  database: ["db"],
  gh: ["github"],
  github: ["gh"],
  oai: ["openai"],
  openai: ["oai"],
  k8s: ["kubernetes"],
  kubernetes: ["k8s"],
  ui: ["interface"],
  ux: ["experience"],
};

/** Cap the cartesian explosion when several words have synonyms. */
const MAX_EXPANSIONS = 8;

/**
 * Expand a raw query into alternative query strings (caller unions the
 * results). Always includes the original query verbatim as the first entry.
 *
 *   "js performance" → ["js performance", "javascript performance",
 *                       "ecmascript performance"]
 *
 * Operator tokens (containing `:`), quoted phrases, sigil tokens (@/#/$),
 * and control words (AND/OR/NOT) are never expanded.
 */
export function expandSynonymQueries(query: string): string[] {
  if (!query) return [query];

  const tokens = lexTopLevel(query);
  if (tokens.length === 0) return [query];

  // For each token, build the list of variants it can take.
  const perTokenVariants = tokens.map((tk) => {
    if (
      tk.type === "phrase" ||
      tk.type === "operator" ||
      tk.type === "control"
    ) {
      return [tk.text];
    }
    const lower = tk.text.toLowerCase();
    const sigil = lower.charCodeAt(0);
    if (sigil === 0x40 || sigil === 0x23 || sigil === 0x24) {
      return [tk.text];
    }
    const variants = SYNONYMS[lower];
    if (!variants || variants.length === 0) return [tk.text];
    return [tk.text, ...variants];
  });

  // Full cartesian, all tokens included. We cap the OUTPUT below — capping
  // mid-cartesian would drop later tokens entirely.
  let out: string[][] = [[]];
  for (const variants of perTokenVariants) {
    const next: string[][] = [];
    for (const acc of out) {
      for (const v of variants) {
        next.push([...acc, v]);
      }
    }
    out = next;
    // Defensive cap: if a single dimension blows past 200×, bail to the
    // verbatim form rather than spending memory on a runaway product.
    if (out.length > 200) {
      out = [tokens.map((tk) => tk.text)];
      break;
    }
  }

  const queries = out.map((toks) => toks.join(" "));

  // Ensure the verbatim original query is always first so it carries the
  // best score signal for users who typed exactly what they meant.
  const verbatim = query.trim();
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const q of [verbatim, ...queries]) {
    const k = q.trim();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    ordered.push(k);
    if (ordered.length >= MAX_EXPANSIONS) break;
  }
  return ordered;
}

// ---------- internal lexer (top-level only — preserves the parser's grammar) ----------

type LexTok =
  | { type: "word"; text: string }
  | { type: "phrase"; text: string }
  | { type: "operator"; text: string }
  | { type: "control"; text: string };

function lexTopLevel(input: string): LexTok[] {
  const toks: LexTok[] = [];
  let i = 0;
  const n = input.length;

  while (i < n) {
    const c = input[i];
    if (c === " " || c === "\t" || c === "\n") {
      i++;
      continue;
    }
    if (c === "(" || c === ")") {
      toks.push({ type: "control", text: c });
      i++;
      continue;
    }
    if (c === '"') {
      let j = i + 1;
      while (j < n && input[j] !== '"') j++;
      const text = input.slice(i, j < n ? j + 1 : j);
      toks.push({ type: "phrase", text });
      i = j < n ? j + 1 : j;
      continue;
    }

    let j = i;
    while (
      j < n &&
      input[j] !== " " &&
      input[j] !== "\t" &&
      input[j] !== "\n" &&
      input[j] !== "(" &&
      input[j] !== ")" &&
      input[j] !== '"'
    ) {
      j++;
    }
    const raw = input.slice(i, j);
    i = j;

    if (raw === "OR" || raw === "AND" || raw === "NOT") {
      toks.push({ type: "control", text: raw });
      continue;
    }

    if (raw.includes(":") && !raw.startsWith(":")) {
      toks.push({ type: "operator", text: raw });
      continue;
    }

    if (raw.length > 0) {
      toks.push({ type: "word", text: raw });
    }
  }

  return toks;
}
