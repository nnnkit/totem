import { useState, useEffect, useCallback, useRef } from "react";
import type {
  Bookmark,
  SyncBlockedReason,
  SyncRequestResult,
  SyncStatus,
} from "../types";
import {
  deleteBookmark,
  getBookmarkEvents,
  ackBookmarkEvents,
  fetchBookmarkPage,
  reserveSyncRun,
  completeSyncRun,
} from "../api/core";
import {
  setActiveAccountId,
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
  CS_SYNC_AUTO_ENABLED,
  LS_MANUAL_SYNC_REQUIRED,
} from "../lib/storage-keys";
import {
  WEEK_MS,
  DETAIL_CACHE_RETENTION_MS,
  DB_INIT_TIMEOUT_MS,
  PAGE_FETCH_TIMEOUT_MS,
} from "../lib/constants";
import {
  createSyncMachineState,
  reduceSyncMachine,
  type SyncMode,
} from "./sync-state-machine";

interface UseBookmarksReturn {
  bookmarks: Bookmark[];
  syncStatus: SyncStatus;
  syncBlockedReason: SyncBlockedReason | null;
  refresh: () => Promise<SyncRequestResult>;
  reset: () => void;
  unbookmark: (tweetId: string) => Promise<{ apiError?: string }>;
}

interface SyncOptions {
  mode?: SyncMode;
  trigger?: "manual" | "auto";
  localCountHint?: number;
}

interface ActiveSyncController {
  abort: (markTimeout?: boolean) => void;
}

const FALLBACK_SESSION_ACCOUNT_ID = "__session__";
const DEFAULT_SYNC_AUTO_ENABLED = true;
const SYNC_BLOCKED_REASONS = new Set<SyncBlockedReason>([
  "in_flight",
  "cooldown",
  "no_account",
  "not_ready",
]);

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

async function isAutoSyncEnabled(): Promise<boolean> {
  try {
    const stored = await chrome.storage.local.get([CS_SYNC_AUTO_ENABLED]);
    const value = stored[CS_SYNC_AUTO_ENABLED];
    if (typeof value === "boolean") {
      return value;
    }
  } catch {}
  return DEFAULT_SYNC_AUTO_ENABLED;
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

export function useBookmarks(
  isReady: boolean,
  activeAccountId: string | null,
): UseBookmarksReturn {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("loading");
  const [syncBlockedReason, setSyncBlockedReason] = useState<SyncBlockedReason | null>(null);
  const bookmarksRef = useRef<Bookmark[]>([]);
  const activeSyncRef = useRef<ActiveSyncController | null>(null);
  const processingBookmarkEventsRef = useRef(false);
  const syncMachineRef = useRef(createSyncMachineState("loading"));
  const activeAccountRef = useRef<string | null>(null);
  const accountContextInitializedRef = useRef(false);

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

  const sync = useCallback(async (options: SyncOptions = {}): Promise<SyncRequestResult> => {
    const accountId = activeAccountId || FALLBACK_SESSION_ACCOUNT_ID;

    const trigger = options.trigger ?? "manual";
    const requestedMode =
      options.mode ?? (trigger === "manual" ? "full" : undefined);
    const localCount =
      typeof options.localCountHint === "number" &&
      Number.isFinite(options.localCountHint)
        ? options.localCountHint
        : bookmarksRef.current.length;

    const policy = await reserveSyncRun({
      accountId,
      trigger,
      localCount,
      requestedMode,
    }).catch(() => null);

    if (!policy) {
      if (trigger === "manual") {
        setSyncBlockedReason("not_ready");
        return { accepted: false, reason: "not_ready" };
      }
      return { accepted: false, reason: "runtime_error" };
    }

    if (!policy?.allow || !policy.mode || !policy.leaseId) {
      const blockedReason = SYNC_BLOCKED_REASONS.has(policy.reason as SyncBlockedReason)
        ? (policy.reason as SyncBlockedReason)
        : null;
      if (trigger === "manual") {
        setSyncBlockedReason(blockedReason || "not_ready");
      }
      return {
        accepted: false,
        reason: blockedReason || policy.reason || "blocked",
      };
    }

    const mode = policy.mode;
    const leaseId = policy.leaseId;
    setSyncBlockedReason(null);
    const started = applySyncEvent({ type: "SYNC_REQUEST", isReady, mode });
    if (!started.syncing || started.syncStatus !== "syncing") {
      await completeSyncRun({
        accountId,
        leaseId,
        mode,
        status: "skipped",
        trigger,
      }).catch(() => {});
      if (trigger === "manual") {
        setSyncBlockedReason("not_ready");
      }
      return { accepted: false, reason: "not_ready" };
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
    let completionStatus: "success" | "failure" | "timeout" = "failure";
    const syncTimer = setTimeout(() => {
      abortSync(true);
    }, timeout);

    try {
      const existingIds = new Set(bookmarksRef.current.map((b) => b.tweetId));

      const reconcileResult = await reconcileBookmarks({
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
        if (mode === "full" && reconcileResult.staleIds.length > 0) {
          await deleteBookmarksByTweetIds(reconcileResult.staleIds);
          const staleIds = new Set(reconcileResult.staleIds);
          const filtered = bookmarksRef.current.filter((b) => !staleIds.has(b.tweetId));
          if (filtered.length !== bookmarksRef.current.length) {
            bookmarksRef.current = filtered;
            setBookmarks(filtered);
          }
        }

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
        setSyncBlockedReason(null);
        completionStatus = "success";
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
        completionStatus = "timeout";
      }
      await completeSyncRun({
        accountId,
        leaseId,
        mode,
        status: completionStatus,
        trigger,
      }).catch(() => {});
    }
    return { accepted: true };
  }, [activeAccountId, applySyncEvent, isReady]);

  // ── Effect: account context switch ──

  useEffect(() => {
    const nextAccountId = activeAccountId || null;
    setActiveAccountId(nextAccountId);

    if (!accountContextInitializedRef.current) {
      accountContextInitializedRef.current = true;
      activeAccountRef.current = nextAccountId;
      return;
    }

    if (activeAccountRef.current === nextAccountId) return;
    const prevAccountId = activeAccountRef.current;
    activeAccountRef.current = nextAccountId;

    const isHydration = prevAccountId === null && nextAccountId !== null;
    const isRealAccountSwitch =
      prevAccountId !== null &&
      nextAccountId !== null &&
      prevAccountId !== nextAccountId;

    if (isHydration || !isRealAccountSwitch) {
      return;
    }

    activeSyncRef.current?.abort();
    processingBookmarkEventsRef.current = false;
    applySyncEvent({ type: "RESET" });
    setSyncBlockedReason(null);
    bookmarksRef.current = [];
    setBookmarks([]);

    chrome.storage.local
      .remove([
        CS_BOOKMARK_EVENTS,
        CS_SOFT_SYNC_NEEDED,
      ])
      .catch(() => {});
  }, [activeAccountId, applySyncEvent]);

  // ── Effect: bookmark mutation events (service worker) ──

  const applyBookmarkEvents = useCallback(async () => {
    if (isManualSyncRequired()) return;
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

      // Manual-sync-only mode: never fetch bookmark pages from event processing.
      // Create events are acknowledged and picked up on next user-triggered full sync.
      if (plan.needsPageFetch || createEventIds.length > 0) {
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

  // ── Effect 1: Init local cache (manual-first, no implicit network sync) ──

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

        if (isReady) {
          const autoEnabled = await isAutoSyncEnabled();
          if (autoEnabled) {
            sync({
              trigger: "auto",
              localCountHint: stored.length,
            }).catch(() => {});
          }
        }

        if (!isReady) {
          if (!syncMachineRef.current.syncing) {
            applySyncEvent({ type: "MARK_IDLE" });
          }
          return;
        }

        if (!syncMachineRef.current.syncing) {
          applySyncEvent({ type: "MARK_IDLE" });
        }
      })
      .catch(() => {
        if (cancelled || runId !== syncMachineRef.current.initRunId) return;
        if (!syncMachineRef.current.syncing) {
          applySyncEvent({ type: "MARK_IDLE" });
        }
      })
      .finally(() => {
        if (timeoutId !== null) clearTimeout(timeoutId);
      });

    return () => {
      cancelled = true;
      if (timeoutId !== null) clearTimeout(timeoutId);
    };
  }, [applySyncEvent, isReady, activeAccountId, sync]);

  // ── Effect 2: Reauth status normalization (manual recovery only) ──

  useEffect(() => {
    if (syncStatus !== "reauthing") return;
    applySyncEvent({ type: "MARK_ERROR" });
  }, [applySyncEvent, syncStatus]);

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
    };

    chrome.storage.onChanged.addListener(onStorageChange);
    applyBookmarkEvents().catch(() => {});

    return () => {
      chrome.storage.onChanged.removeListener(onStorageChange);
    };
  }, [isReady, applyBookmarkEvents]);

  // ── refresh (manual trigger) ──

  const refresh = useCallback(async (): Promise<SyncRequestResult> => {
    return sync({ trigger: "manual", mode: "full" });
  }, [sync]);

  // ── reset ──

  const reset = useCallback(() => {
    applySyncEvent({ type: "RESET" });
    activeSyncRef.current?.abort();
    setSyncBlockedReason(null);
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

  return { bookmarks, syncStatus, syncBlockedReason, refresh, reset, unbookmark };
}

const EMPTY_SET = new Set<string>();

export function useDetailedTweetIds(refreshKey: unknown = 0): { ids: Set<string>; loaded: boolean } {
  const [ids, setIds] = useState<Set<string>>(EMPTY_SET);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getDetailedTweetIds()
      .then((result) => { setIds(result); setLoaded(true); })
      .catch(() => { setLoaded(true); });
  }, [refreshKey]);

  return { ids, loaded };
}
