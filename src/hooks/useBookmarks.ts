import { useReducer, useState, useEffect, useCallback, useRef } from "react";
import type { Bookmark, SyncState } from "../types";
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
  CS_LAST_RECONCILE,
  CS_LAST_SYNC,
  CS_BOOKMARK_EVENTS,
  CS_LAST_SOFT_SYNC,
  CS_SOFT_SYNC_NEEDED,
} from "../lib/storage-keys";
import {
  CREATE_EVENT_DELAY_MS,
  WEEK_MS,
  DETAIL_CACHE_RETENTION_MS,
  RECONCILE_THROTTLE_MS,
  SOFT_SYNC_THROTTLE_MS,
  DB_INIT_TIMEOUT_MS,
  REAUTH_MAX_ATTEMPTS,
  REAUTH_POLL_MS,
} from "../lib/constants";

interface UseBookmarksReturn {
  bookmarks: Bookmark[];
  syncState: SyncState;
  dispatch: React.Dispatch<SyncAction>;
  refresh: () => void;
  unbookmark: (tweetId: string) => Promise<{ apiError?: string }>;
}

// ── Actions ──────────────────────────────────────────────────

type SyncAction =
  | { type: "DB_LOADED"; total: number; lastSyncAt: number }
  | { type: "DB_FAILED"; error: string }
  | { type: "HARD_SYNC_START"; isReconcile: boolean }
  | { type: "HARD_SYNC_PAGE"; total: number; pagesLoaded: number }
  | { type: "HARD_SYNC_DONE"; total: number }
  | { type: "HARD_SYNC_ERROR"; error: string }
  | { type: "SOFT_SYNC_START" }
  | { type: "SOFT_SYNC_DONE"; total: number }
  | { type: "SOFT_SYNC_FAIL" }
  | { type: "REAUTH_START" }
  | { type: "REAUTH_TICK"; attempt: number }
  | { type: "REAUTH_OK" }
  | { type: "REAUTH_FAIL" }
  | { type: "SYNC_SKIPPED" }
  | { type: "COUNT_CHANGED"; total: number }
  | { type: "RESET" };

// ── Reducer ──────────────────────────────────────────────────

function totalFrom(state: SyncState): number {
  return "total" in state ? state.total : 0;
}

function syncReducer(state: SyncState, action: SyncAction): SyncState {
  switch (action.type) {
    case "DB_LOADED":
      if (state.phase !== "booting") return state;
      return { phase: "ready", total: action.total, lastSyncAt: action.lastSyncAt };

    case "DB_FAILED":
      if (state.phase !== "booting") return state;
      // Transition to ready so auto-sync effect fires as fallback
      return { phase: "ready", total: 0, lastSyncAt: 0 };

    case "HARD_SYNC_START":
      if (state.phase !== "ready" && state.phase !== "synced" && state.phase !== "error") return state;
      return { phase: "hard_syncing", total: totalFrom(state), pagesLoaded: 0, isReconcile: action.isReconcile };

    case "HARD_SYNC_PAGE":
      if (state.phase !== "hard_syncing") return state;
      return { ...state, total: action.total, pagesLoaded: action.pagesLoaded };

    case "HARD_SYNC_DONE":
      if (state.phase !== "hard_syncing") return state;
      return { phase: "synced", total: action.total };

    case "HARD_SYNC_ERROR": {
      const isAuth = action.error === "AUTH_EXPIRED" || action.error === "NO_AUTH";
      if (isAuth) {
        return { phase: "reauthing", total: totalFrom(state), attempt: 0 };
      }
      return { phase: "error", total: totalFrom(state), error: action.error, isReconnecting: false };
    }

    case "SYNC_SKIPPED":
      if (state.phase !== "ready") return state;
      return { phase: "synced", total: totalFrom(state) };

    case "SOFT_SYNC_START":
      if (state.phase !== "synced" && state.phase !== "ready") return state;
      return { phase: "soft_syncing", total: totalFrom(state) };

    case "SOFT_SYNC_DONE":
      return { phase: "synced", total: action.total };

    case "SOFT_SYNC_FAIL":
      return { phase: "synced", total: totalFrom(state) };

    case "REAUTH_START":
      return { phase: "reauthing", total: totalFrom(state), attempt: 0 };

    case "REAUTH_TICK":
      if (state.phase !== "reauthing") return state;
      return { ...state, attempt: action.attempt };

    case "REAUTH_OK":
      if (state.phase !== "reauthing") return state;
      // Go back to ready so auto-sync effect re-fires
      return { phase: "ready", total: state.total, lastSyncAt: 0 };

    case "REAUTH_FAIL":
      if (state.phase !== "reauthing") return state;
      return { phase: "error", total: state.total, error: "AUTH_EXPIRED", isReconnecting: false };

    case "COUNT_CHANGED": {
      // Update total in any phase that carries it
      if (!("total" in state)) return state;
      return { ...state, total: action.total } as SyncState;
    }

    case "RESET":
      return { phase: "resetting" };

    default:
      return state;
  }
}

// ── Helpers ──────────────────────────────────────────────────

function hardSyncAbortTimeout(bookmarkCount: number): number {
  const base = 3 * 60 * 1000;
  const extra = Math.floor(bookmarkCount / 1000) * 30_000;
  return Math.min(base + extra, 10 * 60 * 1000);
}

function compareSortIndexDesc(a: Bookmark, b: Bookmark): number {
  return b.sortIndex.localeCompare(a.sortIndex);
}

// ── Hook ─────────────────────────────────────────────────────

export function useBookmarks(isReady: boolean): UseBookmarksReturn {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [syncState, dispatch] = useReducer(syncReducer, { phase: "booting" });
  const bookmarksRef = useRef<Bookmark[]>([]);
  const processingBookmarkEventsRef = useRef(false);

  useEffect(() => {
    bookmarksRef.current = bookmarks;
  }, [bookmarks]);

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

  // ── Effect 1: DB Load (runs once on mount) ──
  useEffect(() => {
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    Promise.race([
      getAllBookmarks(),
      new Promise<Bookmark[]>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error("DB_INIT_TIMEOUT")), DB_INIT_TIMEOUT_MS);
      }),
    ])
      .then(async (stored) => {
        if (cancelled) return;
        if (stored.length > 0) {
          setBookmarks(stored);
          bookmarksRef.current = stored;
        }
        const meta = await chrome.storage.local.get([CS_LAST_SYNC]);
        const lastSyncAt = Number(meta[CS_LAST_SYNC] || 0);
        dispatch({ type: "DB_LOADED", total: stored.length, lastSyncAt });
      })
      .catch(() => {
        if (cancelled) return;
        dispatch({ type: "DB_FAILED", error: "DB_INIT_TIMEOUT" });
      })
      .finally(() => {
        if (timeoutId !== null) clearTimeout(timeoutId);
      });

    return () => {
      cancelled = true;
      if (timeoutId !== null) clearTimeout(timeoutId);
    };
  }, []);

  // ── Effect 2: Auto-sync (reacts to phase === "ready" + isReady) ──
  useEffect(() => {
    if (syncState.phase !== "ready" || !isReady) return;

    const autoSync = async () => {
      if (syncState.total === 0) {
        // Fresh user or empty DB — always hard sync
        dispatch({ type: "HARD_SYNC_START", isReconcile: false });
        return;
      }

      // Has bookmarks — check if reconcile is needed
      const stored = await chrome.storage.local.get([CS_LAST_RECONCILE]);
      const lastReconcile = Number(stored[CS_LAST_RECONCILE] || 0);
      if (Date.now() - lastReconcile > RECONCILE_THROTTLE_MS) {
        dispatch({ type: "HARD_SYNC_START", isReconcile: true });
      } else {
        // Recent enough — skip sync
        dispatch({ type: "SYNC_SKIPPED" });
      }
    };

    autoSync().catch(() => {});
  }, [syncState.phase, isReady]);

  // ── Effect 3: Hard sync loop ──
  const runningRef = useRef(false);

  useEffect(() => {
    if (syncState.phase !== "hard_syncing") return;
    if (runningRef.current) return;
    runningRef.current = true;

    const queue = new FetchQueue();
    const abortController = { aborted: false };
    const timeout = hardSyncAbortTimeout(bookmarksRef.current.length);
    const syncTimer = setTimeout(() => {
      abortController.aborted = true;
      queue.abort();
    }, timeout);

    const isReconcile = syncState.isReconcile;
    let pagesLoaded = 0;

    const run = async () => {
      let doReconcile = isReconcile;
      if (doReconcile) {
        const stored = await chrome.storage.local.get([CS_LAST_RECONCILE]);
        const lastReconcile = Number(stored[CS_LAST_RECONCILE] || 0);
        if (Date.now() - lastReconcile < RECONCILE_THROTTLE_MS) {
          doReconcile = false;
        }
      }

      try {
        const existingIds = new Set(bookmarksRef.current.map((b) => b.tweetId));

        const result = await reconcileBookmarks({
          localIds: existingIds,
          fetchPage: (cursor) =>
            queue.enqueue(() => fetchBookmarkPage(cursor)),
          fullReconcile: doReconcile,
          onPage: async (pageNew) => {
            const currentIds = new Set(bookmarksRef.current.map((b) => b.tweetId));
            const deduped = pageNew.filter((b) => !currentIds.has(b.tweetId));
            pagesLoaded++;

            if (deduped.length === 0) {
              dispatch({ type: "HARD_SYNC_PAGE", total: bookmarksRef.current.length, pagesLoaded });
              return;
            }

            const updated = [...bookmarksRef.current, ...deduped].toSorted(compareSortIndexDesc);
            bookmarksRef.current = updated;
            setBookmarks(updated);
            dispatch({ type: "HARD_SYNC_PAGE", total: updated.length, pagesLoaded });

            try {
              await upsertBookmarks(deduped);
            } catch {
              // DB write can fail if IndexedDB was cleared externally.
            }
          },
        });

        if (!abortController.aborted) {
          if (doReconcile && result.staleIds.length > 0) {
            await deleteBookmarksByTweetIds(result.staleIds);
            const staleSet = new Set(result.staleIds);
            const filtered = bookmarksRef.current.filter((b) => !staleSet.has(b.tweetId));
            bookmarksRef.current = filtered;
            setBookmarks(filtered);
          }

          if (doReconcile) {
            await chrome.storage.local.set({ [CS_LAST_RECONCILE]: Date.now() });
          }

          await chrome.storage.local.set({ [CS_LAST_SYNC]: Date.now() });
          dispatch({ type: "HARD_SYNC_DONE", total: bookmarksRef.current.length });
        }
      } catch (err) {
        if (!abortController.aborted) {
          const msg = err instanceof Error ? err.message : "Unknown error";
          dispatch({ type: "HARD_SYNC_ERROR", error: msg });
        }
      } finally {
        clearTimeout(syncTimer);
        runningRef.current = false;
      }
    };

    run().catch(() => {
      runningRef.current = false;
    });

    return () => {
      abortController.aborted = true;
      queue.abort();
      clearTimeout(syncTimer);
      runningRef.current = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- runningRef guard prevents re-launch; we only trigger on phase entry
  }, [syncState.phase]);

  // ── Effect 4: Reauth poll ──
  useEffect(() => {
    if (syncState.phase !== "reauthing") return;

    let attempts = 0;
    const intervalId = setInterval(async () => {
      attempts++;
      dispatch({ type: "REAUTH_TICK", attempt: attempts });

      try {
        const status = await checkReauthStatus();
        if (!status.inProgress) {
          const auth = await checkAuth();
          if (auth.hasAuth && auth.hasQueryId) {
            clearInterval(intervalId);
            dispatch({ type: "REAUTH_OK" });
            return;
          }
        }
      } catch {}

      if (attempts >= REAUTH_MAX_ATTEMPTS) {
        clearInterval(intervalId);
        dispatch({ type: "REAUTH_FAIL" });
      }
    }, REAUTH_POLL_MS);

    return () => clearInterval(intervalId);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- only trigger on phase entry
  }, [syncState.phase]);

  // ── Effect 5: Bookmark events ──
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

      // ── Execute deletes ──
      if (plan.idsToDelete.length > 0) {
        const toDelete = new Set(plan.idsToDelete);
        const current = bookmarksRef.current;
        const filtered = current.filter((b) => !toDelete.has(b.tweetId));

        if (filtered.length !== current.length) {
          bookmarksRef.current = filtered;
          setBookmarks(filtered);
        }

        await deleteBookmarksByTweetIds(plan.idsToDelete);
        dispatch({ type: "COUNT_CHANGED", total: filtered.length });
      }

      // Ack delete events immediately
      if (deleteEventIds.length > 0) {
        await ackBookmarkEvents(deleteEventIds);
      }

      // ── Execute creates: fetch 1 small page and add what's missing ──
      if (plan.needsPageFetch) {
        await new Promise((r) => setTimeout(r, CREATE_EVENT_DELAY_MS));

        try {
          const page = await fetchBookmarkPage(undefined, 20);
          const currentIds = new Set(bookmarksRef.current.map((b) => b.tweetId));
          const newBookmarks = page.bookmarks.filter((b) => !currentIds.has(b.tweetId));

          if (newBookmarks.length > 0) {
            const updated = [...newBookmarks, ...bookmarksRef.current].toSorted(compareSortIndexDesc);
            bookmarksRef.current = updated;
            setBookmarks(updated);
            dispatch({ type: "COUNT_CHANGED", total: updated.length });
            try {
              await upsertBookmarks(newBookmarks);
            } catch {}
          }

          if (createEventIds.length > 0) {
            await ackBookmarkEvents(createEventIds);
          }
        } catch {
          // Page fetch failed — don't ack create events so they're retried
        }
      } else if (createEventIds.length > 0) {
        await ackBookmarkEvents(createEventIds);
      }
    } finally {
      processingBookmarkEventsRef.current = false;
    }
  }, []);

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
        runSoftSync().catch(() => {});
      }
    };

    chrome.storage.onChanged.addListener(onStorageChange);
    applyBookmarkEvents().catch(() => {});

    return () => {
      chrome.storage.onChanged.removeListener(onStorageChange);
    };
  }, [isReady, applyBookmarkEvents]);

  // ── Effect 6: Soft sync ──
  const runSoftSync = useCallback(async () => {
    if (syncState.phase === "hard_syncing" || syncState.phase === "soft_syncing") return;

    const stored = await chrome.storage.local.get([CS_LAST_SOFT_SYNC]);
    const lastSync = Number(stored[CS_LAST_SOFT_SYNC] || 0);
    if (Date.now() - lastSync < SOFT_SYNC_THROTTLE_MS) return;

    dispatch({ type: "SOFT_SYNC_START" });

    try {
      const existingIds = new Set(bookmarksRef.current.map((b) => b.tweetId));

      await reconcileBookmarks({
        localIds: existingIds,
        fetchPage: (cursor) => fetchBookmarkPage(cursor, 20),
        fullReconcile: false,
        onPage: async (pageNew) => {
          const currentIds = new Set(bookmarksRef.current.map((b) => b.tweetId));
          const deduped = pageNew.filter((b) => !currentIds.has(b.tweetId));
          if (deduped.length === 0) return;
          const updated = [...bookmarksRef.current, ...deduped].toSorted(compareSortIndexDesc);
          bookmarksRef.current = updated;
          setBookmarks(updated);
        },
      });

      await chrome.storage.local.set({ [CS_LAST_SOFT_SYNC]: Date.now() });
      await chrome.storage.local.remove(CS_SOFT_SYNC_NEEDED);
      dispatch({ type: "SOFT_SYNC_DONE", total: bookmarksRef.current.length });
    } catch {
      dispatch({ type: "SOFT_SYNC_FAIL" });
    }
  }, [syncState.phase]);

  // ── Refresh (manual trigger) ──
  const refresh = useCallback(async () => {
    const stored = await chrome.storage.local.get([CS_LAST_RECONCILE]);
    const lastReconcile = Number(stored[CS_LAST_RECONCILE] || 0);
    if (Date.now() - lastReconcile > RECONCILE_THROTTLE_MS) {
      dispatch({ type: "HARD_SYNC_START", isReconcile: true });
    } else {
      runSoftSync();
    }
  }, [runSoftSync]);

  // ── Unbookmark ──
  const unbookmark = useCallback(async (tweetId: string): Promise<{ apiError?: string }> => {
    if (!tweetId) return {};

    const current = bookmarksRef.current;
    const removed = current.find((bookmark) => bookmark.tweetId === tweetId) || null;
    const filtered = current.filter((bookmark) => bookmark.tweetId !== tweetId);

    if (filtered.length !== current.length) {
      bookmarksRef.current = filtered;
      setBookmarks(filtered);
    }

    await deleteBookmarksByTweetIds([tweetId]);
    dispatch({ type: "COUNT_CHANGED", total: Math.max(0, ("total" in syncState ? syncState.total : 0) - (removed ? 1 : 0)) });

    try {
      await deleteBookmark(tweetId);
    } catch (error) {
      return { apiError: error instanceof Error ? error.message : "Unknown error" };
    }

    return {};
  }, [syncState]);

  return { bookmarks, syncState, dispatch, refresh, unbookmark };
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
