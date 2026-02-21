import { useEffect, useMemo, useState } from "react";
import { searchBookmarks } from "../lib/search";
import type { Bookmark } from "../types";

export function useBookmarkSearch(bookmarks: Bookmark[]) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query), 150);
    return () => clearTimeout(id);
  }, [query]);

  const results = useMemo(
    () => searchBookmarks(bookmarks, debouncedQuery),
    [bookmarks, debouncedQuery],
  );

  const isSearching = query.trim().length > 0;

  return { query, setQuery, results, isSearching };
}
