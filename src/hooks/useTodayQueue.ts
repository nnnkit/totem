import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  Bookmark,
  BookmarkIntent,
  BookmarkQueueMetadata,
  ReadingProgress,
  TodayQueueBudgetMinutes,
  TodayQueueExposureAction,
  TodayQueueSnapshot,
} from "../types";
import {
  deleteQueueBookmarkMetadata,
  getAllQueueBookmarkMetadata,
  getQueueBookmarkMetadataByTweetId,
  getTodayQueueExposuresSince,
  getTodayQueueSnapshot,
  markReadingProgressUncompleted,
  recordTodayQueueExposures,
  sweepStaleTodayQueueSnapshots,
  upsertQueueBookmarkMetadata,
  upsertTodayQueueSnapshot,
} from "../db";
import {
  addTweetIdToTodayQueueSnapshot,
  buildTodayQueue,
  deriveActiveTodayQueueItems,
  deriveHandledTodayQueueItems,
  formatLocalDate,
  isTodayQueueSnapshotDone,
  makeQueueExposure,
  makeTodayQueueKey,
  shouldPersistTodayQueueSnapshot,
  toTodayQueueSnapshot,
  type TodayQueueHandledItem,
  type TodayQueueHandledReason,
  type TodayQueueItem,
} from "../lib/today-queue";
import { TODAY_QUEUE } from "../lib/constants/scoring";
import { getPinnedTweetIdsOrdered, subscribeToPinChanges } from "../lib/pins";
import { subscribeToReaderActivity } from "../lib/reader-activity";

type TodayQueueStatus = "idle" | "loading" | "ready";

interface UseTodayQueueInput {
  enabled: boolean;
  accountId: string | null;
  bookmarks: Bookmark[];
  readingProgress: ReadingProgress[];
  detailedTweetIds: ReadonlySet<string>;
  budgetMinutes: TodayQueueBudgetMinutes;
  restrictToCachedDetails: boolean;
}

interface TodayQueueState {
  status: TodayQueueStatus;
  localDate: string;
  snapshot: TodayQueueSnapshot | null;
  metadata: BookmarkQueueMetadata[];
}

export interface UseTodayQueueResult {
  status: TodayQueueStatus;
  localDate: string;
  snapshot: TodayQueueSnapshot | null;
  items: TodayQueueItem[];
  handledItems: TodayQueueHandledItem[];
  budgetMinutes: TodayQueueBudgetMinutes;
  activeCount: number;
  handledCount: number;
  totalCount: number;
  completedCount: number;
  isDone: boolean;
  refresh: () => void;
  addToTodayQueue: (tweetId: string) => Promise<void>;
  recordOpen: (tweetId: string) => Promise<void>;
  recordRead: (tweetId: string) => Promise<void>;
  recordPinned: (tweetId: string) => Promise<void>;
  snooze: (tweetId: string) => Promise<void>;
  setIntent: (tweetId: string, intent: BookmarkIntent) => Promise<void>;
  clearFeedback: (tweetId: string) => Promise<void>;
  undoHandled: (
    tweetId: string,
    reason: TodayQueueHandledReason,
  ) => Promise<void>;
}

const EMPTY_STATE: TodayQueueState = {
  status: "idle",
  localDate: "",
  snapshot: null,
  metadata: [],
};

export interface TodayQueueStats {
  totalCount: number;
  handledCount: number;
  completedCount: number;
}

export function computeTodayQueueStats({
  snapshot,
  handledItems,
  existingTweetIds,
}: {
  snapshot: TodayQueueSnapshot | null;
  handledItems: TodayQueueHandledItem[];
  existingTweetIds: ReadonlySet<string>;
}): TodayQueueStats {
  const deletedCount =
    snapshot?.tweetIds.filter((tweetId) => !existingTweetIds.has(tweetId))
      .length ?? 0;
  return {
    totalCount: snapshot?.tweetIds.length ?? 0,
    handledCount: handledItems.length + deletedCount,
    completedCount: handledItems.filter((item) => item.reason === "read")
      .length,
  };
}

function nextLocalDate(): string {
  return formatLocalDate(new Date(Date.now() + 24 * 60 * 60 * 1000));
}

// Module-scoped so the orphaned-record sweep runs at most once per page load
// rather than once per hook mount; a bumped scoring version would otherwise
// leave prior-version daily-set records lingering in local storage.
let staleSnapshotSweepStarted = false;

function isNeutralMetadata(row: BookmarkQueueMetadata): boolean {
  return row.intent === "unset" && !row.snoozedUntil;
}

export function useTodayQueue({
  enabled,
  accountId,
  bookmarks,
  readingProgress,
  detailedTweetIds,
  budgetMinutes,
  restrictToCachedDetails,
}: UseTodayQueueInput): UseTodayQueueResult {
  const [state, setState] = useState<TodayQueueState>(EMPTY_STATE);
  // refresh() is called from effects and action handlers alike; a monotonic
  // sequence lets a newer run supersede an older in-flight one so the slower
  // response can't clobber state with stale data.
  const refreshSeqRef = useRef(0);

  const refresh = useCallback(() => {
    const requestId = ++refreshSeqRef.current;
    if (!enabled) {
      setState(EMPTY_STATE);
      return;
    }

    const isCurrent = () => refreshSeqRef.current === requestId;
    const run = async () => {
      setState((current) => ({
        ...current,
        status: current.status === "ready" ? "ready" : "loading",
      }));

      const now = Date.now();
      const localDate = formatLocalDate(new Date(now));
      const key = makeTodayQueueKey({ localDate, budgetMinutes });
      const [storedSnapshot, metadata, exposures] = await Promise.all([
        getTodayQueueSnapshot(key),
        getAllQueueBookmarkMetadata(),
        getTodayQueueExposuresSince(now - TODAY_QUEUE.exposureWindowMs),
      ]);

      if (bookmarks.length === 0) {
        if (isCurrent()) {
          setState({
            status: "ready",
            localDate,
            snapshot: null,
            metadata,
          });
        }
        return;
      }

      let snapshot =
        storedSnapshot && shouldPersistTodayQueueSnapshot(storedSnapshot)
          ? storedSnapshot
          : null;

      if (!snapshot) {
        const result = buildTodayQueue({
          accountId,
          localDate,
          budgetMinutes,
          now,
          bookmarks,
          readingProgress,
          metadata,
          exposures,
          pinnedTweetIds: getPinnedTweetIdsOrdered(),
          detailedTweetIds,
          restrictToCachedDetails,
        });
        snapshot = toTodayQueueSnapshot(result);
        if (shouldPersistTodayQueueSnapshot(snapshot)) {
          await upsertTodayQueueSnapshot(snapshot);
          await recordTodayQueueExposures(
            snapshot.tweetIds.map((tweetId) =>
              makeQueueExposure({
                tweetId,
                action: "queued",
                localDate,
                createdAt: result.generatedAt,
              }),
            ),
          );
        }
      }

      if (isCurrent()) {
        setState({
          status: "ready",
          localDate,
          snapshot,
          metadata,
        });
      }
    };

    run().catch(() => {
      if (isCurrent()) setState({ ...EMPTY_STATE, status: "ready" });
    });
  }, [
    accountId,
    bookmarks,
    budgetMinutes,
    detailedTweetIds,
    enabled,
    readingProgress,
    restrictToCachedDetails,
  ]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!enabled || staleSnapshotSweepStarted) return;
    staleSnapshotSweepStarted = true;
    void sweepStaleTodayQueueSnapshots().catch(() => {});
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const unsubscribeReader = subscribeToReaderActivity(refresh);
    const unsubscribePins = subscribeToPinChanges(refresh);
    return () => {
      unsubscribeReader();
      unsubscribePins();
    };
  }, [enabled, refresh]);

  // A new-tab page left open past midnight would otherwise keep showing
  // yesterday's queue until some other activity triggers a refresh.
  const localDate = state.localDate;
  useEffect(() => {
    if (!enabled || !localDate) return;
    const refreshOnDayChange = () => {
      if (document.visibilityState !== "visible") return;
      if (formatLocalDate() !== localDate) refresh();
    };
    document.addEventListener("visibilitychange", refreshOnDayChange);
    window.addEventListener("focus", refreshOnDayChange);
    return () => {
      document.removeEventListener("visibilitychange", refreshOnDayChange);
      window.removeEventListener("focus", refreshOnDayChange);
    };
  }, [enabled, localDate, refresh]);

  const items = useMemo(
    () =>
      deriveActiveTodayQueueItems({
        snapshot: state.snapshot,
        bookmarks,
        readingProgress,
        metadata: state.metadata,
        detailedTweetIds,
        restrictToCachedDetails,
        localDate: state.localDate || formatLocalDate(),
      }),
    [
      bookmarks,
      detailedTweetIds,
      readingProgress,
      restrictToCachedDetails,
      state.localDate,
      state.metadata,
      state.snapshot,
    ],
  );

  const handledItems = useMemo(
    () =>
      deriveHandledTodayQueueItems({
        snapshot: state.snapshot,
        bookmarks,
        readingProgress,
        metadata: state.metadata,
        detailedTweetIds,
        restrictToCachedDetails,
        localDate: state.localDate || formatLocalDate(),
      }),
    [
      bookmarks,
      detailedTweetIds,
      readingProgress,
      restrictToCachedDetails,
      state.localDate,
      state.metadata,
      state.snapshot,
    ],
  );

  // Progress counts come from the unrestricted handled set so the "n of m"
  // indicator stays consistent with totalCount (which counts the whole
  // snapshot) even when offline mode hides uncached items from the list.
  const completionHandledItems = useMemo(
    () =>
      deriveHandledTodayQueueItems({
        snapshot: state.snapshot,
        bookmarks,
        readingProgress,
        metadata: state.metadata,
        restrictToCachedDetails: false,
        localDate: state.localDate || formatLocalDate(),
      }),
    [
      bookmarks,
      readingProgress,
      state.localDate,
      state.metadata,
      state.snapshot,
    ],
  );
  const existingTweetIds = useMemo(
    () => new Set(bookmarks.map((bookmark) => bookmark.tweetId)),
    [bookmarks],
  );
  const activeCount = items.length;
  const { totalCount, handledCount, completedCount } = computeTodayQueueStats({
    snapshot: state.snapshot,
    handledItems: completionHandledItems,
    existingTweetIds,
  });

  const recordAction = useCallback(
    async (tweetId: string, action: TodayQueueExposureAction) => {
      await recordTodayQueueExposures([
        makeQueueExposure({
          tweetId,
          action,
          localDate: state.localDate || formatLocalDate(),
        }),
      ]);
      refresh();
    },
    [refresh, state.localDate],
  );

  const writeMetadata = useCallback(
    async (
      tweetId: string,
      patch: Pick<BookmarkQueueMetadata, "intent" | "snoozedUntil">,
      action: TodayQueueExposureAction,
    ) => {
      const existing = await getQueueBookmarkMetadataByTweetId(tweetId);
      const next: BookmarkQueueMetadata = {
        tweetId,
        intent: patch.intent ?? existing?.intent ?? "unset",
        snoozedUntil: patch.snoozedUntil ?? existing?.snoozedUntil ?? null,
        updatedAt: Date.now(),
      };
      if (isNeutralMetadata(next)) {
        await deleteQueueBookmarkMetadata(tweetId);
      } else {
        await upsertQueueBookmarkMetadata(next);
      }
      await recordAction(tweetId, action);
    },
    [recordAction],
  );

  const setIntent = useCallback(
    async (tweetId: string, intent: BookmarkIntent) => {
      const action =
        intent === "reference" || intent === "act" ? intent : "opened";
      await writeMetadata(tweetId, { intent, snoozedUntil: null }, action);
    },
    [writeMetadata],
  );

  const clearFeedback = useCallback(async (tweetId: string) => {
    await deleteQueueBookmarkMetadata(tweetId);
    refresh();
  }, [refresh]);

  const undoHandled = useCallback(
    async (tweetId: string, reason: TodayQueueHandledReason) => {
      if (reason === "read") {
        await markReadingProgressUncompleted(tweetId);
      } else {
        await deleteQueueBookmarkMetadata(tweetId);
      }
      refresh();
    },
    [refresh],
  );

  const snooze = useCallback(
    async (tweetId: string) => {
      await writeMetadata(
        tweetId,
        { intent: "unset", snoozedUntil: nextLocalDate() },
        "snoozed",
      );
    },
    [writeMetadata],
  );

  const addToTodayQueue = useCallback(
    async (tweetId: string) => {
      const localDate = state.localDate || formatLocalDate();
      const key = makeTodayQueueKey({ localDate, budgetMinutes });
      const storedSnapshot = await getTodayQueueSnapshot(key);
      const currentSnapshot =
        storedSnapshot ?? (state.snapshot?.key === key ? state.snapshot : null);
      const createdAt = Date.now();
      const snapshot = addTweetIdToTodayQueueSnapshot({
        snapshot: currentSnapshot,
        tweetId,
        key,
        localDate,
        budgetMinutes,
        generatedAt: createdAt,
      });

      await deleteQueueBookmarkMetadata(tweetId);
      await upsertTodayQueueSnapshot(snapshot);
      await recordTodayQueueExposures([
        makeQueueExposure({
          tweetId,
          action: "added",
          localDate,
          createdAt,
        }),
      ]);
      refresh();
    },
    [budgetMinutes, refresh, state.localDate, state.snapshot],
  );

  return {
    status: state.status,
    localDate: state.localDate,
    snapshot: state.snapshot,
    items,
    handledItems,
    budgetMinutes,
    activeCount,
    handledCount,
    totalCount,
    completedCount,
    isDone: state.status === "ready" &&
      isTodayQueueSnapshotDone({
        snapshot: state.snapshot,
        handledItems: completionHandledItems,
        existingTweetIds,
      }),
    refresh,
    addToTodayQueue,
    recordOpen: (tweetId) => recordAction(tweetId, "opened"),
    recordRead: (tweetId) => recordAction(tweetId, "read"),
    recordPinned: (tweetId) => recordAction(tweetId, "pinned"),
    snooze,
    setIntent,
    clearFeedback,
    undoHandled,
  };
}
