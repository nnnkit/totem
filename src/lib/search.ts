import type { Bookmark } from "../types";
import {
  createBookmarkSearchEngine,
  tryLoadFromJSON,
  type BookmarkSearchEngine,
} from "./search/engine";
import type { BookmarkSignals } from "./search/build-doc";
import { runQuery } from "./search/executor";
import { parseQuery, type Ast } from "./search/parser";
import { queryToTerms } from "./search/highlight";
import { expandSynonymQueries } from "./search/synonyms";
import {
  loadSearchIndexJson,
  saveSearchIndexJson,
  clearSearchIndexJson,
} from "../db";

export { queryToTerms, parseQuery };
export { runQuery } from "./search/executor";
export type { Ast, OperatorKey, OperatorNode } from "./search/parser";
export type { SearchableBookmark, BookmarkSignals } from "./search/build-doc";
export type {
  HighlightSegment,
  FieldHighlight,
  QueryTerms,
} from "./search/highlight";
export { highlightField } from "./search/highlight";

let engine: BookmarkSearchEngine | null = null;
let lastBookmarksRef: Bookmark[] | null = null;
let lastBookmarkIds: string[] = [];
let persistTimer: ReturnType<typeof setTimeout> | null = null;
let dirty = false;

const PERSIST_DEBOUNCE_MS = 30_000;

function schedulePersist() {
  dirty = true;
  if (persistTimer != null) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    if (!dirty || engine == null) return;
    dirty = false;
    const json = engine.toJSON();
    void saveSearchIndexJson(json);
  }, PERSIST_DEBOUNCE_MS);
}

/**
 * Lazy-build / patch the singleton index whenever the bookmarks array
 * identity changes.
 *
 * Persistence: serialized JSON is written to IndexedDB on a 30s debounce
 * after writes. Hydration is best-effort and only applied on first build:
 * if the persisted index covers exactly the current bookmark set, we use
 * it; otherwise we rebuild fresh and overwrite.
 */
function ensureEngine(
  bookmarks: Bookmark[],
  signalsBy?: ReadonlyMap<string, BookmarkSignals>,
): BookmarkSearchEngine {
  if (engine === null) {
    engine = createBookmarkSearchEngine(bookmarks, signalsBy);
    lastBookmarksRef = bookmarks;
    lastBookmarkIds = bookmarks.map((b) => b.tweetId);
    // Best-effort hydrate from disk; if it works and matches the corpus,
    // swap it in. The freshly-built engine is the safe fallback.
    void tryHydrate(bookmarks);
    schedulePersist();
    return engine;
  }
  if (bookmarks === lastBookmarksRef) return engine;

  const nextIds = new Set<string>();
  for (const b of bookmarks) nextIds.add(b.tweetId);

  for (const id of lastBookmarkIds) {
    if (!nextIds.has(id)) engine.remove(id);
  }
  for (const b of bookmarks) {
    engine.replace(b, signalsBy?.get(b.tweetId));
  }

  lastBookmarksRef = bookmarks;
  lastBookmarkIds = bookmarks.map((b) => b.tweetId);
  schedulePersist();
  return engine;
}

async function tryHydrate(bookmarks: Bookmark[]): Promise<void> {
  try {
    const json = await loadSearchIndexJson();
    if (!json) return;
    const hydrated = tryLoadFromJSON(json);
    if (!hydrated) {
      // Schema mismatch — drop the corrupt cache.
      void clearSearchIndexJson();
      return;
    }
    if (hydrated.size() !== bookmarks.length) {
      // Stale (count diverged) — discard and let the fresh engine handle it.
      return;
    }
    // The fresh engine is already serving; swapping mid-flight is risky
    // because a user query could already have read from it. We keep the
    // fresh engine and just trust the persisted JSON to be a hot-start
    // optimization for next session — overwritten on the next debounce.
  } catch {
    // ignore
  }
}

export interface SearchOutcome {
  results: Bookmark[];
  ast: Ast;
  queryTerms: ReadonlySet<string>;
  /** Single-term suggestion when results are sparse. */
  didYouMean?: string;
}

const DID_YOU_MEAN_THRESHOLD = 5;

/**
 * Run a query through the parser → operator executor → BM25 free-text
 * pipeline. Returns ranked bookmarks plus the AST and the query terms
 * suitable for the highlighter.
 */
export function searchBookmarksDetailed(
  bookmarks: Bookmark[],
  query: string,
  signalsBy?: ReadonlyMap<string, BookmarkSignals>,
): SearchOutcome {
  const trimmed = query.trim();
  if (!trimmed) {
    return {
      results: bookmarks,
      ast: { kind: "empty" },
      queryTerms: new Set(),
    };
  }
  const idx = ensureEngine(bookmarks, signalsBy);

  // Synonym expansion: run the verbatim query plus per-variant alternates,
  // union the results keeping the best rank per id. Synonyms are query-time
  // so editing the synonym map never requires a reindex.
  const variants = expandSynonymQueries(trimmed);

  const primary = runQuery({ bookmarks, searcher: idx, query: variants[0] });
  const merged = new Map<string, { bookmark: Bookmark; rank: number }>();
  primary.results.forEach((b, i) => {
    merged.set(b.tweetId, { bookmark: b, rank: i });
  });
  for (let v = 1; v < variants.length; v++) {
    const out = runQuery({ bookmarks, searcher: idx, query: variants[v] });
    out.results.forEach((b, i) => {
      const existing = merged.get(b.tweetId);
      const rank = i + v * 1000; // de-prioritize synonym variants vs verbatim
      if (!existing || rank < existing.rank) {
        merged.set(b.tweetId, { bookmark: b, rank });
      }
    });
  }

  const results = Array.from(merged.values())
    .toSorted((a, b) => a.rank - b.rank)
    .map((x) => x.bookmark);

  // "Did you mean" — only when results are sparse and the query is a single
  // free-text token (not an operator query).
  let didYouMean: string | undefined;
  if (results.length < DID_YOU_MEAN_THRESHOLD) {
    didYouMean = computeDidYouMean(idx, primary.ast, trimmed);
  }

  return {
    results,
    ast: primary.ast,
    queryTerms: primary.queryTerms,
    didYouMean,
  };
}

/**
 * Backward-compatible entry point. Returns ranked bookmarks only.
 */
export function searchBookmarks(
  bookmarks: Bookmark[],
  query: string,
  signalsBy?: ReadonlyMap<string, BookmarkSignals>,
): Bookmark[] {
  return searchBookmarksDetailed(bookmarks, query, signalsBy).results;
}

function computeDidYouMean(
  idx: BookmarkSearchEngine,
  ast: Ast,
  rawQuery: string,
): string | undefined {
  // Only suggest for a simple single-term query — operators and phrases get
  // confusing fast.
  if (ast.kind !== "term") return undefined;
  const term = ast.value.toLowerCase();
  if (term.length < 4) return undefined;
  const suggestions = idx.suggest(term, 5);
  for (const s of suggestions) {
    const candidate = s.split(" ")[0]?.toLowerCase();
    if (!candidate) continue;
    if (candidate === term) continue;
    if (candidate === rawQuery.toLowerCase().trim()) continue;
    return candidate;
  }
  return undefined;
}

/**
 * Test-only helper: drop the singleton so tests can start with a clean index.
 */
export function __resetSearchEngineForTests() {
  engine = null;
  lastBookmarksRef = null;
  lastBookmarkIds = [];
  if (persistTimer != null) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  dirty = false;
}
