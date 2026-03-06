import { getCompletedTweetIds } from "../db";
import {
  OFFLINE_PREFETCH_POOL,
  OFFLINE_PREFETCH_UNREAD_MAX,
  PREFETCH_INTERVAL_MS,
} from "../lib/constants";
import type { Bookmark } from "../types";

export interface PrefetchSnapshot {
  bookmarks: Bookmark[];
  detailedTweetIds: ReadonlySet<string>;
  readerActive: boolean;
  onlineReady: boolean;
}

interface PrefetchLoopOptions {
  tweetIds: string[];
  fetchDetail: (tweetId: string) => Promise<void>;
  onSuccess: (tweetId: string) => void;
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
      if (!shouldStop()) {
        onSuccess(tweetIds[index]);
      }
    } catch {
      continue;
    }
  }
}

function pickPrefetchCandidates(
  bookmarks: Bookmark[],
  detailedTweetIds: ReadonlySet<string>,
  completedIds: ReadonlySet<string>,
): string[] {
  const pool = bookmarks
    .slice(0, OFFLINE_PREFETCH_POOL)
    .filter((bookmark) => !detailedTweetIds.has(bookmark.tweetId));

  const read: Bookmark[] = [];
  const unread: Bookmark[] = [];

  for (const bookmark of pool) {
    if (completedIds.has(bookmark.tweetId)) {
      read.push(bookmark);
      continue;
    }

    if (unread.length < OFFLINE_PREFETCH_UNREAD_MAX) {
      unread.push(bookmark);
    }
  }

  return [...read, ...unread].map((bookmark) => bookmark.tweetId);
}

export interface PrefetchController {
  reconcile: () => void;
  stop: () => void;
}

interface CreatePrefetchControllerOptions {
  getSnapshot: () => PrefetchSnapshot;
  fetchDetail: (tweetId: string) => Promise<void>;
  onSuccess: (tweetId: string) => void;
  onStatusChange?: (status: "idle" | "running" | "paused") => void;
}

export function createPrefetchController({
  getSnapshot,
  fetchDetail,
  onSuccess,
  onStatusChange,
}: CreatePrefetchControllerOptions): PrefetchController {
  let running = false;
  let stopped = false;
  let timerId: ReturnType<typeof setTimeout> | null = null;
  let runToken = 0;

  const clearTimer = () => {
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }
  };

  const shouldRun = (): boolean => {
    const snapshot = getSnapshot();
    return snapshot.onlineReady && !snapshot.readerActive && snapshot.bookmarks.length > 0;
  };

  const pauseBetween = () =>
    new Promise<void>((resolve) => {
      timerId = setTimeout(() => {
        timerId = null;
        resolve();
      }, PREFETCH_INTERVAL_MS);
    });

  const stop = () => {
    stopped = true;
    runToken += 1;
    clearTimer();
    running = false;
    onStatusChange?.("idle");
  };

  const reconcile = () => {
    if (!shouldRun()) {
      if (running) {
        clearTimer();
        onStatusChange?.("paused");
      } else {
        onStatusChange?.("idle");
      }
      return;
    }

    if (running) return;

    const token = runToken + 1;
    runToken = token;
    stopped = false;
    running = true;
    onStatusChange?.("running");

    (async () => {
      try {
        const snapshot = getSnapshot();
        const completedIds = await getCompletedTweetIds().catch(() => new Set<string>());
        if (stopped || token !== runToken) return;

        const candidateIds = pickPrefetchCandidates(
          snapshot.bookmarks,
          snapshot.detailedTweetIds,
          completedIds,
        );

        if (candidateIds.length === 0) {
          return;
        }

        await runPrefetchLoop({
          tweetIds: candidateIds,
          fetchDetail,
          onSuccess,
          shouldStop: () => stopped || token !== runToken || !shouldRun(),
          pauseBetween,
        });
      } finally {
        if (token === runToken) {
          running = false;
          onStatusChange?.(shouldRun() ? "idle" : "paused");
        }
      }
    })().catch(() => {
      if (token === runToken) {
        running = false;
        onStatusChange?.(shouldRun() ? "idle" : "paused");
      }
    });
  };

  return { reconcile, stop };
}
