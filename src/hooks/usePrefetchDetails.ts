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

interface PrefetchLoopOptions {
  tweetIds: string[];
  fetchDetail: (tweetId: string) => Promise<unknown>;
  onSuccess: () => void;
  shouldStop: () => boolean;
  pauseBetween?: () => Promise<void>;
}

export async function runPrefetchLoop({
  tweetIds,
  fetchDetail,
  onSuccess,
  shouldStop,
  pauseBetween,
}: PrefetchLoopOptions): Promise<void> {
  for (let index = 0; index < tweetIds.length; index += 1) {
    if (shouldStop()) return;

    if (index > 0 && pauseBetween) {
      await pauseBetween();
      if (shouldStop()) return;
    }

    try {
      await fetchDetail(tweetIds[index]);
    } catch {
      continue;
    }

    if (shouldStop()) return;
    onSuccess();
  }
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

      const candidateIds = [...read, ...unread].map((bookmark) => bookmark.tweetId);

      await runPrefetchLoop({
        tweetIds: candidateIds,
        fetchDetail: fetchTweetDetail,
        onSuccess: () => setPrefetchedCount((c) => c + 1),
        shouldStop: () => cancelledRef.current,
        pauseBetween: () =>
          new Promise<void>((resolve) => {
            timerId = setTimeout(resolve, PREFETCH_INTERVAL_MS);
          }),
      });
    };

    run().catch(() => {});

    return () => {
      cancelledRef.current = true;
      if (timerId !== null) clearTimeout(timerId);
    };
  }, [isReady, bookmarks, readerOpen]);

  return { prefetchedCount };
}
