import { useState, useEffect, useCallback, useRef } from "react";
import type { Bookmark, SyncStatus } from "../types";
import {
  checkReauthStatus,
  checkAuth,
  deleteBookmark,
  getBookmarkEvents,
  ackBookmarkEvents,
  fetchBookmarkPage,
} from "../api/core";
import {
  upsertBookmarks,
  getAllBookmarks,
  deleteBookmarksByTweetIds,
  cleanupOldTweetDetails,
  getDetailedTweetIds,
} from "../db";
import { FetchQueue } from "../lib/fetch-queue";
import { reconcileBookmarks } from "../lib/reconcile";
import { resolveBookmarkEventPlan } from "../lib/bookmark-event-plan";
import {
  CS_DB_CLEANUP_AT,
  CS_BOOKMARK_EVENTS,
  CS_LAST_SOFT_SYNC,
  CS_LAST_SYNC,
  CS_SOFT_SYNC_NEEDED,
  LS_MANUAL_SYNC_REQUIRED,
} from "../lib/storage-keys";
import {
  CREATE_EVENT_DELAY_MS,
  WEEK_MS,
  DETAIL_CACHE_RETENTION_MS,
  DB_INIT_TIMEOUT_MS,
  PAGE_FETCH_TIMEOUT_MS,
  REAUTH_MAX_ATTEMPTS,
  REAUTH_POLL_MS,
} from "../lib/constants";
import {
  createSyncMachineState,
  reduceSyncMachine,
  type SyncMode,
} from "./sync-state-machine";

interface UseBookmarksReturn {
  bookmarks: Bookmark[];
  syncStatus: SyncStatus;
  refresh: () => void;
  reset: () => void;
  unbookmark: (tweetId: string) => Promise<{ apiError?: string }>;
}

interface SyncOptions {
  mode?: SyncMode;
}

interface ActiveSyncController {
  abort: (markTimeout?: boolean) => void;
}

// ── Helpers ──────────────────────────────────────────────────

function syncAbortTimeout(bookmarkCount: number, mode: SyncMode): number {
  const base = mode === "full" ? 8 * 60 * 1000 : 3 * 60 * 1000;
  const extra = Math.floor(bookmarkCount / 1000) * 30_000;
  return Math.min(base + extra, 12 * 60 * 1000);
}

function compareSortIndexDesc(a: Bookmark, b: Bookmark): number {
  return b.sortIndex.localeCompare(a.sortIndex);
}

function isManualSyncRequired(): boolean {
  try {
    return localStorage.getItem(LS_MANUAL_SYNC_REQUIRED) === "1";
  } catch {
    return false;
  }
}

function clearManualSyncRequired(): void {
  try {
    localStorage.removeItem(LS_MANUAL_SYNC_REQUIRED);
  } catch {}
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutError: Error,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(timeoutError), timeoutMs);
      }),
    ]);
  } finally {
    if (timer !== null) clearTimeout(timer);
  }
}

// ── Hook ─────────────────────────────────────────────────────

export function useBookmarks(isReady: boolean): UseBookmarksReturn {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("loading");
  const bookmarksRef = useRef<Bookmark[]>([]);
  const activeSyncRef = useRef<ActiveSyncController | null>(null);
  const processingBookmarkEventsRef = useRef(false);
  const syncMachineRef = useRef(createSyncMachineState("loading"));

  useEffect(() => {
    bookmarksRef.current = bookmarks;
  }, [bookmarks]);

  const applySyncEvent = useCallback(
    (
      event: Parameters<typeof reduceSyncMachine>[1],
    ): ReturnType<typeof reduceSyncMachine> => {
      const next = reduceSyncMachine(syncMachineRef.current, event);
      syncMachineRef.current = next;
      setSyncStatus(next.syncStatus);
      return next;
    },
    [],
  );

  // ── Core: sync() ──────────────────────────────────────────

  const sync = useCallback(async (options: SyncOptions = {}) => {
    const mode = options.mode ?? "incremental";
    const started = applySyncEvent({ type: "SYNC_REQUEST", isReady, mode });
    if (!started.syncing || started.syncStatus !== "syncing") {
      return;
    }

    const queue = new FetchQueue();
    const abortController = { aborted: false, isTimeout: false };
    const timeout = syncAbortTimeout(bookmarksRef.current.length, mode);
    const abortSync = (markTimeout = false) => {
      if (abortController.aborted) return;
      if (markTimeout) abortController.isTimeout = true;
      abortController.aborted = true;
      queue.abort();
    };
    activeSyncRef.current = { abort: abortSync };
    const syncTimer = setTimeout(() => {
      abortSync(true);
    }, timeout);

    try {
      const existingIds = new Set(bookmarksRef.current.map((b) => b.tweetId));

      await reconcileBookmarks({
        localIds: existingIds,
        fetchPage: (cursor) =>
          queue.enqueue(() =>
            withTimeout(
              fetchBookmarkPage(cursor),
              PAGE_FETCH_TIMEOUT_MS,
              new Error("PAGE_FETCH_TIMEOUT"),
            ),
          ),
        fullReconcile: mode === "full",
        onPage: async (pageNew) => {
          if (abortController.aborted) return;
          const currentIds = new Set(bookmarksRef.current.map((b) => b.tweetId));
          const deduped = pageNew.filter((b) => !currentIds.has(b.tweetId));
          if (deduped.length === 0) return;

          const updated = [...bookmarksRef.current, ...deduped].toSorted(compareSortIndexDesc);
          bookmarksRef.current = updated;
          setBookmarks(updated);

          try {
            await upsertBookmarks(deduped);
          } catch {
            // DB write can fail if IndexedDB was cleared externally.
          }
        },
      });

      if (!abortController.aborted) {
        const now = Date.now();
        if (mode === "incremental") {
          await chrome.storage.local.set({
            [CS_LAST_SYNC]: now,
            [CS_LAST_SOFT_SYNC]: now,
          });
        } else {
          await chrome.storage.local.set({ [CS_LAST_SYNC]: now });
        }
        await chrome.storage.local.remove(CS_SOFT_SYNC_NEEDED);
        if (mode === "full") {
          clearManualSyncRequired();
        }
        applySyncEvent({ type: "SYNC_SUCCESS" });
      }
    } catch (err) {
      if (!abortController.aborted) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        applySyncEvent({ type: "SYNC_FAILURE", message: msg });
      }
    } finally {
      clearTimeout(syncTimer);
      if (activeSyncRef.current?.abort === abortSync) {
        activeSyncRef.current = null;
      }
      // Timeout — save progress and go idle (never stuck)
      if (abortController.isTimeout) {
        try {
          await chrome.storage.local.set({ [CS_LAST_SYNC]: Date.now() });
        } catch {}
        applySyncEvent({ type: "SYNC_TIMEOUT" });
      }
    }
  }, [applySyncEvent, isReady]);

  // ── Effect: bookmark mutation events (service worker) ──

  const applyBookmarkEvents = useCallback(async () => {
    if (processingBookmarkEventsRef.current) return;
    processingBookmarkEventsRef.current = true;

    try {
      const events = await getBookmarkEvents();
      if (events.length === 0) return;

      const plan = resolveBookmarkEventPlan(events);
      const deleteEventIds = events
        .filter((e) => e.type === "DeleteBookmark")
        .map((e) => e.id);
      const createEventIds = events
        .filter((e) => e.type === "CreateBookmark")
        .map((e) => e.id);

      if (plan.idsToDelete.length > 0) {
        const toDelete = new Set(plan.idsToDelete);
        const current = bookmarksRef.current;
        const filtered = current.filter((bookmark) => !toDelete.has(bookmark.tweetId));

        if (filtered.length !== current.length) {
          bookmarksRef.current = filtered;
          setBookmarks(filtered);
        }

        await deleteBookmarksByTweetIds(plan.idsToDelete);
      }

      if (deleteEventIds.length > 0) {
        await ackBookmarkEvents(deleteEventIds);
      }

      if (plan.needsPageFetch) {
        await new Promise((resolve) => setTimeout(resolve, CREATE_EVENT_DELAY_MS));

        try {
          const page = await withTimeout(
            fetchBookmarkPage(undefined, 20),
            PAGE_FETCH_TIMEOUT_MS,
            new Error("PAGE_FETCH_TIMEOUT"),
          );
          const currentIds = new Set(bookmarksRef.current.map((bookmark) => bookmark.tweetId));
          const newBookmarks = page.bookmarks.filter((bookmark) => !currentIds.has(bookmark.tweetId));

          if (newBookmarks.length > 0) {
            const updated = [...newBookmarks, ...bookmarksRef.current].toSorted(compareSortIndexDesc);
            bookmarksRef.current = updated;
            setBookmarks(updated);

            try {
              await upsertBookmarks(newBookmarks);
            } catch {}
          }

          if (createEventIds.length > 0) {
            await ackBookmarkEvents(createEventIds);
          }
        } catch {
          // Keep create events unacked so they are retried.
        }
      } else if (createEventIds.length > 0) {
        await ackBookmarkEvents(createEventIds);
      }
    } finally {
      processingBookmarkEventsRef.current = false;
    }
  }, []);

  // ── Effect: DB cleanup (runs once) ──

  useEffect(() => {
    const runCleanup = async () => {
      try {
        const stored = await chrome.storage.local.get([CS_DB_CLEANUP_AT]);
        const lastCleanup = Number(stored[CS_DB_CLEANUP_AT] || 0);
        if (Date.now() - lastCleanup < WEEK_MS) return;

        await Promise.all([
          cleanupOldTweetDetails(DETAIL_CACHE_RETENTION_MS),
          chrome.storage.local.set({ [CS_DB_CLEANUP_AT]: Date.now() }),
        ]);
      } catch {}
    };

    runCleanup().catch(() => {});
  }, []);

  // ── Effect 1: Init local cache only (manual sync model) ──

  useEffect(() => {
    if (isManualSyncRequired()) {
      applySyncEvent({ type: "RESET" });
      bookmarksRef.current = [];
      setBookmarks([]);
      return;
    }

    const runId = applySyncEvent({ type: "INIT_INVALIDATE" }).initRunId;
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    Promise.race([
      getAllBookmarks(),
      new Promise<Bookmark[]>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error("DB_INIT_TIMEOUT")), DB_INIT_TIMEOUT_MS);
      }),
    ])
      .then(async (stored) => {
        if (cancelled || runId !== syncMachineRef.current.initRunId) return;
        if (stored.length > 0) {
          setBookmarks(stored);
          bookmarksRef.current = stored;
        }

        if (!isReady) {
          applySyncEvent({ type: "MARK_IDLE" });
          return;
        }

        applySyncEvent({ type: "MARK_IDLE" });
      })
      .catch(() => {
        if (cancelled || runId !== syncMachineRef.current.initRunId) return;
        applySyncEvent({ type: "MARK_IDLE" });
      })
      .finally(() => {
        if (timeoutId !== null) clearTimeout(timeoutId);
      });

    return () => {
      cancelled = true;
      if (timeoutId !== null) clearTimeout(timeoutId);
    };
  }, [applySyncEvent, isReady]);

  // ── Effect 2: Reauth (when syncStatus === "reauthing") ──

  useEffect(() => {
    if (syncStatus !== "reauthing" || !isReady) return;

    let attempts = 0;
    const intervalId = setInterval(async () => {
      attempts++;

      try {
        const status = await checkReauthStatus();
        if (!status.inProgress) {
          const auth = await checkAuth();
          if (auth.hasAuth && auth.hasQueryId) {
            clearInterval(intervalId);
            sync({ mode: syncMachineRef.current.lastSyncMode });
            return;
          }
        }
      } catch {}

      if (attempts >= REAUTH_MAX_ATTEMPTS) {
        clearInterval(intervalId);
        applySyncEvent({ type: "MARK_ERROR" });
      }
    }, REAUTH_POLL_MS);

    return () => clearInterval(intervalId);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- only trigger on status entry
  }, [applySyncEvent, syncStatus, isReady]);

  // ── Effect 3: service-worker signals ──

  useEffect(() => {
    if (!isReady) return;

    const onStorageChange = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string,
    ) => {
      if (areaName !== "local") return;
      if (changes[CS_BOOKMARK_EVENTS]) {
        applyBookmarkEvents().catch(() => {});
      }
      if (changes[CS_SOFT_SYNC_NEEDED]?.newValue) {
        sync().catch(() => {});
      }
    };

    chrome.storage.onChanged.addListener(onStorageChange);
    applyBookmarkEvents().catch(() => {});

    return () => {
      chrome.storage.onChanged.removeListener(onStorageChange);
    };
  }, [isReady, applyBookmarkEvents, sync]);

  // ── refresh (manual trigger) ──

  const refresh = useCallback(() => {
    sync({ mode: "full" });
  }, [sync]);

  // ── reset ──

  const reset = useCallback(() => {
    applySyncEvent({ type: "RESET" });
    activeSyncRef.current?.abort();
    bookmarksRef.current = [];
    setBookmarks([]);
  }, [applySyncEvent]);

  // ── unbookmark ──

  const unbookmark = useCallback(async (tweetId: string): Promise<{ apiError?: string }> => {
    if (!tweetId) return {};

    const current = bookmarksRef.current;
    const filtered = current.filter((bookmark) => bookmark.tweetId !== tweetId);

    if (filtered.length !== current.length) {
      bookmarksRef.current = filtered;
      setBookmarks(filtered);
    }

    await deleteBookmarksByTweetIds([tweetId]);

    try {
      await deleteBookmark(tweetId);
    } catch (error) {
      return { apiError: error instanceof Error ? error.message : "Unknown error" };
    }

    return {};
  }, []);

  return { bookmarks, syncStatus, refresh, reset, unbookmark };
}

const EMPTY_SET = new Set<string>();

export function useDetailedTweetIds(refreshKey = 0): { ids: Set<string>; loaded: boolean } {
  const [ids, setIds] = useState<Set<string>>(EMPTY_SET);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getDetailedTweetIds()
      .then((result) => { setIds(result); setLoaded(true); })
      .catch(() => { setLoaded(true); });
  }, [refreshKey]);

  return { ids, loaded };
}
