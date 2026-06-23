import { useEffect, useMemo, useState } from "react";
import { searchBookmarksDetailed } from "../lib/search";
import type { Bookmark } from "../types";
import type { BookmarkSignals } from "../lib/search";
import { SEARCH_DEBOUNCE_MS } from "../lib/constants/timing";
import { useAccountDb } from "../stores/selectors";
import { subscribeToReaderActivity } from "../lib/reader-activity";

export interface UseBookmarkSearchResult {
  query: string;
  setQuery: (q: string) => void;
  results: Bookmark[];
  /** Lowercased query terms suitable for highlighting in row renderers. */
  queryTerms: ReadonlySet<string>;
  isSearching: boolean;
  /** Single-term suggestion when the result list is sparse. */
  didYouMean?: string;
}

const EMPTY_SIGNALS: ReadonlyMap<string, BookmarkSignals> = new Map();

export function useBookmarkSearch(
  bookmarks: Bookmark[],
): UseBookmarkSearchResult {
  const db = useAccountDb();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [signals, setSignals] =
    useState<ReadonlyMap<string, BookmarkSignals>>(EMPTY_SIGNALS);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [query]);

  // Load reading-progress signals once on mount and refresh on reader
  // activity (so a freshly-opened bookmark moves up in subsequent ranks).
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      void db.getBookmarkSignals().then((next) => {
        if (!cancelled) setSignals(next);
      });
    };
    load();
    const unsub = subscribeToReaderActivity(() => load());
    return () => {
      cancelled = true;
      unsub();
    };
  }, [db]);

  const outcome = useMemo(
    () => searchBookmarksDetailed(bookmarks, debouncedQuery, signals),
    [bookmarks, debouncedQuery, signals],
  );

  const isSearching = query.trim().length > 0;

  return {
    query,
    setQuery,
    results: outcome.results,
    queryTerms: outcome.queryTerms,
    isSearching,
    didYouMean: outcome.didYouMean,
  };
}
