import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getAllBookmarks, upsertBookmarks } from "../db";
import { fetchBookmarkPage } from "../api/core";
import { CS_LAST_SYNC } from "../lib/storage-keys";
import type { Bookmark } from "../types";

export interface Stats {
  total: number;
  authors: number;
  articles: number;
  threads: number;
  posts: number;
}

interface PopupBookmarksResult {
  bookmarks: Bookmark[];
  stats: Stats;
  randomBookmark: Bookmark | null;
  shuffleSuggestion: () => void;
  syncing: boolean;
  sync: () => void;
  isLoading: boolean;
}

export function usePopupBookmarks(): PopupBookmarksResult {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const syncingRef = useRef(false);
  const [seed, setSeed] = useState(0);

  useEffect(() => {
    getAllBookmarks()
      .then(setBookmarks)
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const sync = useCallback(async () => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    setSyncing(true);
    try {
      const result = await fetchBookmarkPage();
      if (result.bookmarks.length > 0) {
        const existingIds = new Set(bookmarks.map((b) => b.tweetId));
        const newBookmarks = result.bookmarks.filter(
          (b) => !existingIds.has(b.tweetId),
        );
        if (newBookmarks.length > 0) {
          await upsertBookmarks(newBookmarks);
          const fresh = await getAllBookmarks();
          setBookmarks(fresh);
        }
        await chrome.storage.local.set({ [CS_LAST_SYNC]: Date.now() });
      }
    } catch {}
    syncingRef.current = false;
    setSyncing(false);
  }, [bookmarks]);

  const stats = useMemo<Stats>(() => {
    const uniqueAuthors = new Set<string>();
    let articles = 0;
    let threads = 0;
    let posts = 0;

    for (const b of bookmarks) {
      uniqueAuthors.add(b.author.screenName);
      if (b.tweetKind === "article") {
        articles++;
      } else if (b.tweetKind === "thread" || b.isThread) {
        threads++;
      } else {
        posts++;
      }
    }

    return { total: bookmarks.length, authors: uniqueAuthors.size, articles, threads, posts };
  }, [bookmarks]);

  const randomBookmark = useMemo<Bookmark | null>(() => {
    if (bookmarks.length === 0) return null;
    void seed;
    return bookmarks[Math.floor(Math.random() * bookmarks.length)];
  }, [bookmarks, seed]);

  const shuffleSuggestion = useCallback(() => {
    setSeed((s) => s + 1);
  }, []);

  return { bookmarks, stats, randomBookmark, shuffleSuggestion, syncing, sync, isLoading };
}
