import {
  OFFLINE_PREFETCH_POOL,
  OFFLINE_PREFETCH_UNREAD_MAX,
} from "../lib/constants/ui";
import { PREFETCH_INTERVAL_MS } from "../lib/constants/timing";
import type { Bookmark } from "../types";

export interface PrefetchSnapshot {
  bookmarks: Bookmark[];
  detailedTweetIds: ReadonlySet<string>;
  readerActive: boolean;
  onlineReady: boolean;
  todayQueueTweetIds: ReadonlySet<string>;
}

interface PrefetchLoopOptions {
  tweetIds: string[];
  fetchDetail: (tweetId: string) => Promise<void>;
  onSuccess: (tweetId: string) => void;
  shouldStop: () => boolean;
  pauseBetween?: (tweetId: string) => Promise<void>;
}

export async function runPrefetchLoop({
  tweetIds,
  fetchDetail,
  onSuccess,
  shouldStop,
  pauseBetween,
}: PrefetchLoopOptions): Promise<void> {
  const runAt = (index: number): Promise<void> => {
    if (shouldStop()) return Promise.resolve();
    if (index >= tweetIds.length) return Promise.resolve();

    const pause = index > 0 && pauseBetween ? pauseBetween(tweetIds[index]) : Promise.resolve();
    return pause.then(() => {
      if (shouldStop()) return undefined;

      return fetchDetail(tweetIds[index])
        .then(() => {
          if (!shouldStop()) onSuccess(tweetIds[index]);
        })
        .catch(() => undefined)
        .then(() => runAt(index + 1));
    });
  };

  return runAt(0);
}

function pickPrefetchCandidates(
  bookmarks: Bookmark[],
  detailedTweetIds: ReadonlySet<string>,
  completedIds: ReadonlySet<string>,
  todayQueueTweetIds: ReadonlySet<string>,
): string[] {
  // Today's queue items come from the full list — they may live beyond OFFLINE_PREFETCH_POOL.
  const todayUncached = bookmarks.filter(
    (b) => todayQueueTweetIds.has(b.tweetId) && !detailedTweetIds.has(b.tweetId),
  );

  // General items use the capped pool, excluding today's items already handled above.
  const generalPool = bookmarks
    .slice(0, OFFLINE_PREFETCH_POOL)
    .filter((b) => !todayQueueTweetIds.has(b.tweetId) && !detailedTweetIds.has(b.tweetId));

  const generalRead: Bookmark[] = [];
  const generalUnread: Bookmark[] = [];

  for (const bookmark of generalPool) {
    if (completedIds.has(bookmark.tweetId)) {
      generalRead.push(bookmark);
      continue;
    }
    if (generalUnread.length < OFFLINE_PREFETCH_UNREAD_MAX) {
      generalUnread.push(bookmark);
    }
  }

  return [
    ...todayUncached.map((b) => b.tweetId),
    ...[...generalRead, ...generalUnread].map((b) => b.tweetId),
  ];
}

export interface PrefetchController {
  reconcile: () => void;
  stop: () => void;
}

interface CreatePrefetchControllerOptions {
  getSnapshot: () => PrefetchSnapshot;
  fetchDetail: (tweetId: string) => Promise<void>;
  getCompletedTweetIds: () => Promise<Set<string>>;
  onSuccess: (tweetId: string) => void;
  onStatusChange?: (status: "idle" | "running" | "paused") => void;
}

export function createPrefetchController({
  getSnapshot,
  fetchDetail,
  getCompletedTweetIds,
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

  const pauseBetween = (tweetId: string) => {
    if (getSnapshot().todayQueueTweetIds.has(tweetId)) return Promise.resolve();
    return new Promise<void>((resolve) => {
      timerId = setTimeout(() => {
        timerId = null;
        resolve();
      }, PREFETCH_INTERVAL_MS);
    });
  };

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
        if (stopped || token !== runToken) return;
        const completedIds = await getCompletedTweetIds().catch(() => new Set<string>());

        const candidateIds = pickPrefetchCandidates(
          snapshot.bookmarks,
          snapshot.detailedTweetIds,
          completedIds,
          snapshot.todayQueueTweetIds,
        );

        if (candidateIds.length === 0) return;

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
