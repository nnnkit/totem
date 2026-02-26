import { useState, useEffect, useCallback, useRef } from "react";
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
  LS_HAS_BOOKMARKS,
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
  refresh: () => void;
  unbookmark: (tweetId: string) => Promise<{ apiError?: string }>;
}

function hardSyncAbortTimeout(bookmarkCount: number): number {
  const base = 3 * 60 * 1000;
  const extra = Math.floor(bookmarkCount / 1000) * 30_000;
  return Math.min(base + extra, 10 * 60 * 1000);
}

function compareSortIndexDesc(a: Bookmark, b: Bookmark): number {
  return b.sortIndex.localeCompare(a.sortIndex);
}

export function useBookmarks(isReady: boolean, loadCacheOnly = false): UseBookmarksReturn {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [syncState, setSyncState] = useState<SyncState>({
    phase: "idle",
    total: 0,
  });
  const hardSyncingRef = useRef(false);
  const softSyncingRef = useRef(false);
  const processingBookmarkEventsRef = useRef(false);
  const bookmarksRef = useRef<Bookmark[]>([]);
  const reauthPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fetchQueueRef = useRef<FetchQueue | null>(null);

  useEffect(() => {
    bookmarksRef.current = bookmarks;
  }, [bookmarks]);

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

  const handleSyncError = useCallback(
    (err: unknown, retryFn: () => void) => {
      const msg = err instanceof Error ? err.message : "Unknown error";

      if (msg === "AUTH_EXPIRED" || msg === "NO_AUTH") {
        setSyncState({
          phase: "error",
          total: bookmarksRef.current.length,
          error: "reconnecting",
        });

        if (reauthPollRef.current !== null) {
          clearInterval(reauthPollRef.current);
        }

        let attempts = 0;
        reauthPollRef.current = setInterval(async () => {
          attempts++;
          try {
            const status = await checkReauthStatus();
            if (!status.inProgress) {
              const auth = await checkAuth();
              if (auth.hasAuth && auth.hasQueryId) {
                clearInterval(reauthPollRef.current!);
                reauthPollRef.current = null;
                hardSyncingRef.current = false;
                retryFn();
                return;
              }
            }
          } catch {}
          if (attempts >= REAUTH_MAX_ATTEMPTS) {
            clearInterval(reauthPollRef.current!);
            reauthPollRef.current = null;
            setSyncState({
              phase: "error",
              total: bookmarksRef.current.length,
              error: msg,
            });
          }
        }, REAUTH_POLL_MS);
      } else {
        setSyncState({
          phase: "error",
          total: bookmarksRef.current.length,
          error: msg,
        });
      }
    },
    [],
  );

  const runHardSync = useCallback(
    async (opts?: { fullReconcile?: boolean }) => {
      if (hardSyncingRef.current) return;
      hardSyncingRef.current = true;

      const queue = new FetchQueue();
      fetchQueueRef.current = queue;

      const timeout = hardSyncAbortTimeout(bookmarksRef.current.length);
      const syncTimer = setTimeout(() => queue.abort(), timeout);

      setSyncState((prev) => ({
        phase: "syncing",
        total: prev.total || bookmarksRef.current.length,
      }));

      let doReconcile = opts?.fullReconcile === true;
      if (doReconcile) {
        const stored = await chrome.storage.local.get([CS_LAST_RECONCILE]);
        const lastReconcile = Number(stored[CS_LAST_RECONCILE] || 0);
        if (Date.now() - lastReconcile < RECONCILE_THROTTLE_MS) {
          doReconcile = false;
        }
      }

      try {
        const existingIds = new Set(
          bookmarksRef.current.map((b) => b.tweetId),
        );

        const result = await reconcileBookmarks({
          localIds: existingIds,
          fetchPage: (cursor) =>
            queue.enqueue(() => fetchBookmarkPage(cursor)),
          fullReconcile: doReconcile,
          onPage: async (pageNew) => {
            const currentIds = new Set(bookmarksRef.current.map((b) => b.tweetId));
            const deduped = pageNew.filter((b) => !currentIds.has(b.tweetId));
            if (deduped.length === 0) {
              setSyncState({ phase: "syncing", total: bookmarksRef.current.length });
              return;
            }
            const updated = [...bookmarksRef.current, ...deduped].toSorted(
              compareSortIndexDesc,
            );
            bookmarksRef.current = updated;
            setBookmarks(updated);
            setSyncState({ phase: "syncing", total: updated.length });

            try {
              await upsertBookmarks(deduped);
            } catch {
              // DB write can fail if IndexedDB was cleared externally.
              // State is already updated so bookmarks are visible this session.
            }
          },
        });

        if (!queue.isAborted) {
          if (doReconcile && result.staleIds.length > 0) {
            await deleteBookmarksByTweetIds(result.staleIds);
            const staleSet = new Set(result.staleIds);
            const filtered = bookmarksRef.current.filter(
              (b) => !staleSet.has(b.tweetId),
            );
            bookmarksRef.current = filtered;
            setBookmarks(filtered);
          }

          if (doReconcile) {
            await chrome.storage.local.set({
              [CS_LAST_RECONCILE]: Date.now(),
            });
          }

          await chrome.storage.local.set({ [CS_LAST_SYNC]: Date.now() });
          localStorage.setItem(LS_HAS_BOOKMARKS, bookmarksRef.current.length > 0 ? "1" : "");
          setSyncState({ phase: "done", total: bookmarksRef.current.length });
        }
      } catch (err) {
        if (!queue.isAborted) {
          handleSyncError(err, runHardSync);
        }
      } finally {
        clearTimeout(syncTimer);
        hardSyncingRef.current = false;
        fetchQueueRef.current = null;
        setSyncState((prev) =>
          prev.phase === "syncing"
            ? { phase: "done", total: bookmarksRef.current.length }
            : prev,
        );
      }
    },
    [handleSyncError],
  );

  const runSoftSync = useCallback(async () => {
    if (hardSyncingRef.current || softSyncingRef.current) return;

    const stored = await chrome.storage.local.get([CS_LAST_SOFT_SYNC]);
    const lastSync = Number(stored[CS_LAST_SOFT_SYNC] || 0);
    if (Date.now() - lastSync < SOFT_SYNC_THROTTLE_MS) return;

    softSyncingRef.current = true;

    try {
      const existingIds = new Set(
        bookmarksRef.current.map((b) => b.tweetId),
      );

      await reconcileBookmarks({
        localIds: existingIds,
        fetchPage: (cursor) => fetchBookmarkPage(cursor, 20),
        fullReconcile: false,
        onPage: async (pageNew) => {
          const currentIds = new Set(bookmarksRef.current.map((b) => b.tweetId));
          const deduped = pageNew.filter((b) => !currentIds.has(b.tweetId));
          if (deduped.length === 0) return;
          const updated = [...bookmarksRef.current, ...deduped].toSorted(
            compareSortIndexDesc,
          );
          bookmarksRef.current = updated;
          setBookmarks(updated);
          setSyncState((prev) => ({ ...prev, total: updated.length }));

          try {
            await upsertBookmarks(deduped);
          } catch {}
        },
      });

      await chrome.storage.local.set({ [CS_LAST_SOFT_SYNC]: Date.now() });
      await chrome.storage.local.remove(CS_SOFT_SYNC_NEEDED);
    } catch {
      // Swallow errors — hard sync catches up later
    } finally {
      softSyncingRef.current = false;
    }
  }, []);

  const refresh = useCallback(async () => {
    const stored = await chrome.storage.local.get([CS_LAST_RECONCILE]);
    const lastReconcile = Number(stored[CS_LAST_RECONCILE] || 0);
    if (Date.now() - lastReconcile > RECONCILE_THROTTLE_MS) {
      runHardSync({ fullReconcile: true });
    } else {
      runSoftSync();
    }
  }, [runHardSync, runSoftSync]);

  useEffect(() => {
    if (!isReady && !loadCacheOnly) return;
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
        localStorage.setItem(LS_HAS_BOOKMARKS, stored.length > 0 ? "1" : "");
        if (stored.length > 0) {
          setBookmarks(stored);
          setSyncState({ phase: "done", total: stored.length });
          if (isReady) {
            const meta = await chrome.storage.local.get([CS_LAST_RECONCILE]);
            const lastReconcile = Number(meta[CS_LAST_RECONCILE] || 0);
            if (Date.now() - lastReconcile > RECONCILE_THROTTLE_MS) {
              runHardSync({ fullReconcile: true });
            }
          }
        } else {
          if (isReady) {
            const meta = await chrome.storage.local.get([CS_LAST_SYNC]);
            if (!Number(meta[CS_LAST_SYNC])) {
              runHardSync();
            } else {
              setSyncState({ phase: "done", total: 0 });
            }
          } else {
            setSyncState({ phase: "done", total: 0 });
          }
        }
      })
      .catch(() => {
        if (cancelled) return;
        setSyncState({ phase: "done", total: bookmarksRef.current.length });
      })
      .finally(() => {
        if (timeoutId !== null) {
          clearTimeout(timeoutId);
        }
      });

    return () => {
      cancelled = true;
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
    };
  }, [isReady, loadCacheOnly, runHardSync]);

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
        setSyncState((prev) => ({
          ...prev,
          phase: prev.phase === "idle" ? "done" : prev.phase,
          total: filtered.length,
        }));
      }

      // Ack delete events immediately — they don't depend on a page fetch.
      if (deleteEventIds.length > 0) {
        await ackBookmarkEvents(deleteEventIds);
      }

      // ── Execute creates: fetch 1 small page and add what's missing ──
      if (plan.needsPageFetch) {
        // Wait for x.com's backend to replicate the write before reading.
        // onCompleted fires as soon as the CreateBookmark response arrives,
        // but the Bookmarks list endpoint may read from a different replica.
        await new Promise((r) => setTimeout(r, CREATE_EVENT_DELAY_MS));

        try {
          const page = await fetchBookmarkPage(undefined, 20);
          const currentIds = new Set(bookmarksRef.current.map((b) => b.tweetId));
          const newBookmarks = page.bookmarks.filter(
            (b) => !currentIds.has(b.tweetId),
          );

          if (newBookmarks.length > 0) {
            const updated = [...newBookmarks, ...bookmarksRef.current].toSorted(
              compareSortIndexDesc,
            );
            bookmarksRef.current = updated;
            setBookmarks(updated);
            setSyncState((prev) => ({
              ...prev,
              phase: prev.phase === "idle" ? "done" : prev.phase,
              total: updated.length,
            }));
            try {
              await upsertBookmarks(newBookmarks);
            } catch {
              // DB write failed — state is already updated for this session
            }
          }

          // Ack create events only after a successful page fetch.
          if (createEventIds.length > 0) {
            await ackBookmarkEvents(createEventIds);
          }
        } catch {
          // Page fetch failed — don't ack create events so they're retried
          // on the next storage change or manual sync.
        }
      } else if (createEventIds.length > 0) {
        // No page fetch needed but create events exist (shouldn't happen
        // with current logic) — ack to prevent pileup.
        await ackBookmarkEvents(createEventIds);
      }
    } finally {
      processingBookmarkEventsRef.current = false;
    }
  }, []);

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

    setSyncState((prev) => ({
      ...prev,
      phase: prev.phase === "idle" ? "done" : prev.phase,
      total: Math.max(0, prev.total - (removed ? 1 : 0)),
    }));

    try {
      await deleteBookmark(tweetId);
    } catch (error) {
      return { apiError: error instanceof Error ? error.message : "Unknown error" };
    }

    return {};
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
  }, [isReady, applyBookmarkEvents, runSoftSync]);

  useEffect(() => {
    return () => {
      if (reauthPollRef.current !== null) {
        clearInterval(reauthPollRef.current);
      }
      if (fetchQueueRef.current) {
        fetchQueueRef.current.abort();
      }
    };
  }, []);

  return { bookmarks, syncState, refresh, unbookmark };
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
