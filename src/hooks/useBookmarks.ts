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
import { CS_DB_CLEANUP_AT, CS_LAST_RECONCILE, CS_LAST_SYNC, CS_BOOKMARK_EVENTS } from "../lib/storage-keys";
import {
  WEEK_MS,
  DETAIL_CACHE_RETENTION_MS,
  RECONCILE_THROTTLE_MS,
  DB_INIT_TIMEOUT_MS,
  REAUTH_MAX_ATTEMPTS,
  REAUTH_POLL_MS,
} from "../lib/constants";

interface UseBookmarksReturn {
  bookmarks: Bookmark[];
  syncState: SyncState;
  refresh: () => void;
  unbookmark: (tweetId: string) => Promise<void>;
}

const IDLE_SAFETY_TIMEOUT_MS = 10_000;
const SYNC_ABORT_TIMEOUT_MS = 3 * 60 * 1000;

function compareSortIndexDesc(a: Bookmark, b: Bookmark): number {
  return b.sortIndex.localeCompare(a.sortIndex);
}

export function useBookmarks(isReady: boolean): UseBookmarksReturn {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [syncState, setSyncState] = useState<SyncState>({
    phase: "idle",
    total: 0,
  });
  const syncingRef = useRef(false);
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

  // Safety net: never stay on the loading spinner forever.
  // If syncState is still "idle" 10s after auth is ready, force to "done"
  // so the user sees the main UI (with empty state + sync button) instead of a blank screen.
  useEffect(() => {
    if (!isReady || syncState.phase !== "idle") return;
    const timer = setTimeout(() => {
      setSyncState((prev) =>
        prev.phase === "idle"
          ? { phase: "done", total: bookmarksRef.current.length }
          : prev,
      );
    }, IDLE_SAFETY_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [isReady, syncState.phase]);

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
      .then((stored) => {
        if (cancelled) return;
        if (stored.length > 0) {
          setBookmarks(stored);
          setSyncState({ phase: "done", total: stored.length });
        } else {
          syncNewBookmarks({ fullReconcile: true });
          // If sync didn't start (another already in progress), exit "idle"
          // so the loading spinner doesn't persist.
          setSyncState((prev) =>
            prev.phase === "idle" ? { phase: "done", total: 0 } : prev,
          );
        }
      })
      .catch(() => {
        if (cancelled) return;
        // Fail open so UI is usable even when IndexedDB bootstrap stalls.
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
  }, [isReady]);

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
                syncingRef.current = false;
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

  const syncNewBookmarks = useCallback(
    async (opts?: { fullReconcile?: boolean }) => {
      if (syncingRef.current) return;
      syncingRef.current = true;

      const queue = new FetchQueue();
      fetchQueueRef.current = queue;

      // Safety: abort sync if it takes too long (network hang, API stall)
      const syncTimer = setTimeout(() => queue.abort(), SYNC_ABORT_TIMEOUT_MS);

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
            const updated = [...bookmarksRef.current, ...pageNew].toSorted(
              compareSortIndexDesc,
            );
            bookmarksRef.current = updated;
            setBookmarks(updated);
            setSyncState({ phase: "syncing", total: updated.length });

            try {
              await upsertBookmarks(pageNew);
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
          setSyncState({ phase: "done", total: bookmarksRef.current.length });
        }
      } catch (err) {
        if (!queue.isAborted) {
          handleSyncError(err, syncNewBookmarks);
        }
      } finally {
        clearTimeout(syncTimer);
        syncingRef.current = false;
        fetchQueueRef.current = null;
        // Safety: guarantee we never stay stuck in "syncing" after this function exits.
        // Success path sets "done", error path sets "error" — this catches abort & edge cases.
        setSyncState((prev) =>
          prev.phase === "syncing"
            ? { phase: "done", total: bookmarksRef.current.length }
            : prev,
        );
      }
    },
    [handleSyncError],
  );

  const refresh = useCallback(() => {
    syncNewBookmarks({ fullReconcile: true });
  }, [syncNewBookmarks]);

  const applyBookmarkEvents = useCallback(async () => {
    if (processingBookmarkEventsRef.current) return;
    processingBookmarkEventsRef.current = true;

    try {
      const events = await getBookmarkEvents();
      if (events.length === 0) return;

      const ackIds: string[] = [];
      const deleteEvents = events.filter((event) => event.type === "DeleteBookmark");
      const createEvents = events.filter((event) => event.type === "CreateBookmark");

      const deletedIds = Array.from(
        new Set(deleteEvents.map((event) => event.tweetId).filter(Boolean)),
      );

      if (deletedIds.length > 0) {
        const toDelete = new Set(deletedIds);
        const current = bookmarksRef.current;
        const filtered = current.filter((bookmark) => !toDelete.has(bookmark.tweetId));

        if (filtered.length !== current.length) {
          bookmarksRef.current = filtered;
          setBookmarks(filtered);
        }

        await deleteBookmarksByTweetIds(deletedIds);
        setSyncState((prev) => ({
          ...prev,
          phase: prev.phase === "idle" ? "done" : prev.phase,
          total: filtered.length,
        }));
        ackIds.push(...deleteEvents.map((event) => event.id));
      } else if (deleteEvents.length > 0) {
        await syncNewBookmarks();
        ackIds.push(...deleteEvents.map((event) => event.id));
      }

      if (createEvents.length > 0) {
        await syncNewBookmarks();
        ackIds.push(...createEvents.map((event) => event.id));
      }

      if (ackIds.length > 0) {
        await ackBookmarkEvents(Array.from(new Set(ackIds)));
      }
    } finally {
      processingBookmarkEventsRef.current = false;
    }
  }, [syncNewBookmarks]);

  const unbookmark = useCallback(async (tweetId: string) => {
    if (!tweetId) return;

    const current = bookmarksRef.current;
    const removed = current.find((bookmark) => bookmark.tweetId === tweetId) || null;
    const filtered = current.filter((bookmark) => bookmark.tweetId !== tweetId);

    if (filtered.length !== current.length) {
      bookmarksRef.current = filtered;
      setBookmarks(filtered);
    }

    await deleteBookmarksByTweetIds([tweetId]);

    try {
      await deleteBookmark(tweetId);
      setSyncState((prev) => ({
        ...prev,
        phase: prev.phase === "idle" ? "done" : prev.phase,
        total: Math.max(0, prev.total - (removed ? 1 : 0)),
      }));
    } catch (error) {
      if (removed) {
        const removedBookmark = removed;
        await upsertBookmarks([removedBookmark]);
        const currentAfterError = bookmarksRef.current;
        if (!currentAfterError.some((bookmark) => bookmark.tweetId === tweetId)) {
          const restored = [removedBookmark, ...currentAfterError].toSorted(
            compareSortIndexDesc,
          );
          bookmarksRef.current = restored;
          setBookmarks(restored);
        }
      }
      throw error;
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
    };

    chrome.storage.onChanged.addListener(onStorageChange);
    applyBookmarkEvents().catch(() => {});

    return () => {
      chrome.storage.onChanged.removeListener(onStorageChange);
    };
  }, [isReady, applyBookmarkEvents]);

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

export function useDetailedTweetIds(): Set<string> {
  const [ids, setIds] = useState<Set<string>>(EMPTY_SET);

  useEffect(() => {
    getDetailedTweetIds().then(setIds).catch(() => {});
  }, []);

  return ids;
}
