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
  CS_LAST_SYNC,
  CS_BOOKMARK_EVENTS,
  CS_SOFT_SYNC_NEEDED,
} from "../lib/storage-keys";
import {
  CREATE_EVENT_DELAY_MS,
  WEEK_MS,
  DETAIL_CACHE_RETENTION_MS,
  RECONCILE_THROTTLE_MS,
  DB_INIT_TIMEOUT_MS,
  REAUTH_MAX_ATTEMPTS,
  REAUTH_POLL_MS,
} from "../lib/constants";

interface UseBookmarksReturn {
  bookmarks: Bookmark[];
  syncStatus: SyncStatus;
  refresh: () => void;
  reset: () => void;
  unbookmark: (tweetId: string) => Promise<{ apiError?: string }>;
}

// ── Helpers ──────────────────────────────────────────────────

function syncAbortTimeout(bookmarkCount: number): number {
  const base = 3 * 60 * 1000;
  const extra = Math.floor(bookmarkCount / 1000) * 30_000;
  return Math.min(base + extra, 10 * 60 * 1000);
}

function compareSortIndexDesc(a: Bookmark, b: Bookmark): number {
  return b.sortIndex.localeCompare(a.sortIndex);
}

function isStale(lastSyncAt: number): boolean {
  return Date.now() - lastSyncAt > RECONCILE_THROTTLE_MS;
}

// ── Hook ─────────────────────────────────────────────────────

export function useBookmarks(isReady: boolean): UseBookmarksReturn {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("loading");
  const bookmarksRef = useRef<Bookmark[]>([]);
  const syncingRef = useRef(false);
  const processingBookmarkEventsRef = useRef(false);

  useEffect(() => {
    bookmarksRef.current = bookmarks;
  }, [bookmarks]);

  // ── Core: sync() ──────────────────────────────────────────

  const sync = useCallback(async () => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    setSyncStatus("syncing");

    const queue = new FetchQueue();
    const abortController = { aborted: false, isTimeout: false };
    const timeout = syncAbortTimeout(bookmarksRef.current.length);
    const syncTimer = setTimeout(() => {
      abortController.isTimeout = true;
      abortController.aborted = true;
      queue.abort();
    }, timeout);

    try {
      const existingIds = new Set(bookmarksRef.current.map((b) => b.tweetId));

      await reconcileBookmarks({
        localIds: existingIds,
        fetchPage: (cursor) => queue.enqueue(() => fetchBookmarkPage(cursor)),
        fullReconcile: false,
        onPage: async (pageNew) => {
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
        await chrome.storage.local.set({ [CS_LAST_SYNC]: Date.now() });
        setSyncStatus("idle");
      }
    } catch (err) {
      if (!abortController.aborted) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        if (msg === "AUTH_EXPIRED" || msg === "NO_AUTH") {
          setSyncStatus("reauthing");
        } else {
          setSyncStatus("error");
        }
      }
    } finally {
      clearTimeout(syncTimer);
      // Timeout — save progress and go idle (never stuck)
      if (abortController.isTimeout) {
        try {
          await chrome.storage.local.set({ [CS_LAST_SYNC]: Date.now() });
        } catch {}
        setSyncStatus("idle");
      }
      syncingRef.current = false;
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

  // ── Effect 1: Init (once, when auth ready) ──

  useEffect(() => {
    if (!isReady) return;
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

        if (stored.length === 0 || isStale(lastSyncAt)) {
          sync();
        } else {
          setSyncStatus("idle");
        }
      })
      .catch(() => {
        if (cancelled) return;
        // DB failed — try syncing from API as fallback
        sync();
      })
      .finally(() => {
        if (timeoutId !== null) clearTimeout(timeoutId);
      });

    return () => {
      cancelled = true;
      if (timeoutId !== null) clearTimeout(timeoutId);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- sync is stable, only run on isReady
  }, [isReady]);

  // ── Effect 2: Reauth (when syncStatus === "reauthing") ──

  useEffect(() => {
    if (syncStatus !== "reauthing") return;

    let attempts = 0;
    const intervalId = setInterval(async () => {
      attempts++;

      try {
        const status = await checkReauthStatus();
        if (!status.inProgress) {
          const auth = await checkAuth();
          if (auth.hasAuth && auth.hasQueryId) {
            clearInterval(intervalId);
            sync();
            return;
          }
        }
      } catch {}

      if (attempts >= REAUTH_MAX_ATTEMPTS) {
        clearInterval(intervalId);
        setSyncStatus("error");
      }
    }, REAUTH_POLL_MS);

    return () => clearInterval(intervalId);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- only trigger on status entry
  }, [syncStatus]);

  // ── Effect 3: Events listener (service worker mutations) ──

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
        sync();
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
    sync();
  }, [sync]);

  // ── reset ──

  const reset = useCallback(() => {
    // Caller handles the actual data reset + page reload
  }, []);

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
