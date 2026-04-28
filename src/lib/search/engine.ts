import MiniSearch, { type Options, type SearchResult } from "minisearch";
import type { Bookmark } from "../../types";
import { SEARCH_BOOSTS } from "../constants";
import { expandCompound, processTerm, tokenize } from "./tokenize";
import {
  toSearchableBookmark,
  type BookmarkSignals,
  type SearchableBookmark,
} from "./build-doc";

/**
 * Fields that are typically single compound tokens (handles, domains).
 * For these we additionally index sub-tokens so a query like `abram`
 * matches `dan_abramov`.
 */
const COMPOUND_FIELDS: ReadonlySet<string> = new Set([
  "screenName",
  "displayName",
  "domain",
  "hashtags",
  "mentions",
]);

const DAY_MS = 1000 * 60 * 60 * 24;
const RECENCY_HALF_LIFE_DAYS = 90;
const RECENCY_FLOOR = 0.1;

/** Extra fields stored on each indexed doc, used by `boostDocument`. */
const STORED_FIELDS = ["createdAt", "lastReadAt", "reopenCount"] as const;

const SEARCH_FIELDS = [
  "screenName",
  "displayName",
  "title",
  "excerpt",
  "description",
  "tweetText",
  "articleText",
  "cardDescription",
  "domain",
  "hashtags",
  "mentions",
  "quotedText",
  "retweetedText",
  "mediaAlt",
] as const;

const BOOST_MAP: Record<string, number> = {
  screenName: SEARCH_BOOSTS.screenName,
  displayName: SEARCH_BOOSTS.displayName,
  title: SEARCH_BOOSTS.title,
  description: SEARCH_BOOSTS.description,
  excerpt: SEARCH_BOOSTS.excerpt,
  tweetText: SEARCH_BOOSTS.tweetText,
  articleText: SEARCH_BOOSTS.articleText,
  cardDescription: SEARCH_BOOSTS.cardDescription,
  domain: SEARCH_BOOSTS.domain,
  hashtags: SEARCH_BOOSTS.hashtags,
  mentions: 2,
  quotedText: SEARCH_BOOSTS.quotedText,
  retweetedText: SEARCH_BOOSTS.retweetedText,
  mediaAlt: SEARCH_BOOSTS.mediaAlt,
};

function buildOptions(): Options<SearchableBookmark> {
  return {
    idField: "id",
    fields: [...SEARCH_FIELDS],
    storeFields: [...STORED_FIELDS],
    tokenize: (text, fieldName) => {
      const base = tokenize(text ?? "");
      if (fieldName && COMPOUND_FIELDS.has(fieldName)) {
        const out: string[] = [];
        for (const tk of base) {
          for (const sub of expandCompound(tk)) out.push(sub);
        }
        return out;
      }
      return base;
    },
    processTerm: (term) => processTerm(term ?? ""),
    searchOptions: {
      boost: BOOST_MAP,
      prefix: (term) => term.length >= 2,
      fuzzy: (term) => {
        if (term.length < 4) return false;
        const first = term.charCodeAt(0);
        // Disable typo tolerance for sigil tokens (handles, hashtags, cashtags)
        if (first === 0x40 || first === 0x23 || first === 0x24) return false;
        return 0.2;
      },
      combineWith: "AND",
      weights: { fuzzy: 0.5, prefix: 0.3 },
      boostDocument: (_id, _term, stored) => {
        const created = (stored?.createdAt as number | undefined) ?? Date.now();
        const lastRead = (stored?.lastReadAt as number | undefined) ?? 0;
        const anchor = Math.max(created, lastRead);
        const ageDays = Math.max(0, (Date.now() - anchor) / DAY_MS);
        const decay = Math.pow(0.5, ageDays / RECENCY_HALF_LIFE_DAYS);
        const recency = Math.max(RECENCY_FLOOR, decay);

        const reopens = (stored?.reopenCount as number | undefined) ?? 0;
        const click = 1 + Math.log1p(Math.max(0, reopens));
        return recency * click;
      },
    },
  };
}

export interface BookmarkSearchEngine {
  size(): number;
  search(query: string): SearchResult[];
  /** Free-text-only BM25 scoring; used by the operator executor. */
  searchText(text: string): Array<{ id: string; score: number }>;
  /** Suggest near-matches for a single term — used by "did you mean". */
  suggest(prefix: string, limit?: number): string[];
  add(bookmark: Bookmark, signals?: BookmarkSignals): void;
  replace(bookmark: Bookmark, signals?: BookmarkSignals): void;
  remove(id: string): void;
  reset(bookmarks: Bookmark[], signalsBy?: ReadonlyMap<string, BookmarkSignals>): void;
  /** Serialize the index to JSON for persistence. */
  toJSON(): string;
}

/**
 * Try to rehydrate the engine from a previously serialized JSON blob. Returns
 * a working engine on success, null on schema mismatch / parse error / corruption.
 */
export function tryLoadFromJSON(
  json: string,
): BookmarkSearchEngine | null {
  try {
    const idx = MiniSearch.loadJSON<SearchableBookmark>(json, buildOptions());
    return wrap(idx);
  } catch {
    return null;
  }
}

export function createBookmarkSearchEngine(
  initial: Bookmark[] = [],
  signalsBy?: ReadonlyMap<string, BookmarkSignals>,
): BookmarkSearchEngine {
  const idx = new MiniSearch<SearchableBookmark>(buildOptions());
  if (initial.length > 0) {
    idx.addAll(
      initial.map((b) => toSearchableBookmark(b, signalsBy?.get(b.tweetId))),
    );
  }
  return wrap(idx);
}

function wrap(idx: MiniSearch<SearchableBookmark>): BookmarkSearchEngine {
  return {
    size: () => idx.documentCount,

    search(query: string) {
      const trimmed = query.trim();
      if (!trimmed) return [];
      return idx.search(trimmed);
    },

    searchText(text: string) {
      const trimmed = text.trim();
      if (!trimmed) return [];
      return idx
        .search(trimmed)
        .map((r) => ({ id: String(r.id), score: r.score }));
    },

    suggest(prefix: string, limit = 5) {
      const trimmed = prefix.trim();
      if (!trimmed) return [];
      try {
        return idx
          .autoSuggest(trimmed, { fuzzy: 0.2, prefix: true })
          .slice(0, limit)
          .map((s) => s.suggestion);
      } catch {
        return [];
      }
    },

    add(bookmark, signals) {
      const doc = toSearchableBookmark(bookmark, signals);
      if (idx.has(doc.id)) {
        idx.replace(doc);
      } else {
        idx.add(doc);
      }
    },

    replace(bookmark, signals) {
      const doc = toSearchableBookmark(bookmark, signals);
      if (idx.has(doc.id)) {
        idx.replace(doc);
      } else {
        idx.add(doc);
      }
    },

    remove(id) {
      if (idx.has(id)) idx.discard(id);
    },

    reset(bookmarks, signalsBy) {
      idx.removeAll();
      idx.addAll(
        bookmarks.map((b) => toSearchableBookmark(b, signalsBy?.get(b.tweetId))),
      );
    },

    toJSON() {
      return JSON.stringify(idx);
    },
  };
}
