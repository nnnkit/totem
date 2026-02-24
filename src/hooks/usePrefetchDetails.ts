import { useEffect, useRef, useState } from "react";
import { fetchTweetDetail } from "../api/core";
import { getCompletedTweetIds, getDetailedTweetIds } from "../db";
import {
  OFFLINE_PREFETCH_POOL,
  OFFLINE_PREFETCH_UNREAD_MAX,
  PREFETCH_INTERVAL_MS,
} from "../lib/constants";
import type { Bookmark } from "../types";

interface UsePrefetchDetailsReturn {
  prefetchedCount: number;
}

export function usePrefetchDetails(
  bookmarks: Bookmark[],
  isReady: boolean,
  readerOpen: boolean,
): UsePrefetchDetailsReturn {
  const [prefetchedCount, setPrefetchedCount] = useState(0);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (!isReady || bookmarks.length === 0 || readerOpen) return;

    cancelledRef.current = false;

    let timerId: ReturnType<typeof setTimeout> | null = null;

    const run = async () => {
      const [detailedIds, completedIds] = await Promise.all([
        getDetailedTweetIds(),
        getCompletedTweetIds(),
      ]);

      const pool = bookmarks
        .slice(0, OFFLINE_PREFETCH_POOL)
        .filter((b) => !detailedIds.has(b.tweetId));

      const read: Bookmark[] = [];
      const unread: Bookmark[] = [];
      for (const b of pool) {
        if (completedIds.has(b.tweetId)) read.push(b);
        else if (unread.length < OFFLINE_PREFETCH_UNREAD_MAX) unread.push(b);
      }

      const candidates = [...read, ...unread];

      const loop = async (index: number) => {
        if (cancelledRef.current || index >= candidates.length) return;

        try {
          await fetchTweetDetail(candidates[index].tweetId);
        } catch {
          return;
        }

        if (cancelledRef.current) return;
        setPrefetchedCount((c) => c + 1);

        if (index + 1 < candidates.length) {
          timerId = setTimeout(() => loop(index + 1), PREFETCH_INTERVAL_MS);
        }
      };

      await loop(0);
    };

    run().catch(() => {});

    return () => {
      cancelledRef.current = true;
      if (timerId !== null) clearTimeout(timerId);
    };
  }, [isReady, bookmarks, readerOpen]);

  return { prefetchedCount };
}
