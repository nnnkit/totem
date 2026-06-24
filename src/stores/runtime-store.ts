import { create } from "zustand";
import {
  checkAuth,
  getRuntimeSnapshot,
  startAuthCapture,
} from "../api/core/auth";
import {
  ackBookmarkEvents,
  deleteBookmark,
  fetchBookmarkPage,
  getBookmarkEvents,
} from "../api/core/bookmarks";
import { fetchTweetDetail } from "../api/core/posts";
import {
  completeSyncRun,
  reserveSyncRun,
  type SyncMode,
} from "../api/core/sync";
import {
  openAccountDb,
  setActiveAccountId,
  subscribeTweetDetailCache,
  type AccountDb,
} from "../db";
import { FetchQueue } from "../lib/fetch-queue";
import { resolveBookmarkEventPlan } from "../lib/bookmark-event-plan";
import { reconcileBookmarks } from "../lib/reconcile";
import {
  AUTH_QUICK_CHECK_MS,
  AUTH_RETRY_MS,
  AUTH_STALE_RECHECK_MS,
  AUTH_TIMEOUT_MS,
  CREATE_EVENT_DELAY_MS,
  DB_INIT_TIMEOUT_MS,
  DETAIL_CACHE_RETENTION_MS,
  PAGE_FETCH_TIMEOUT_MS,
  READER_DETAIL_TIMEOUT_MS,
  WEEK_MS,
} from "../lib/constants/timing";
import {
  SYNC_ABORT_TIMEOUT_FULL_MS,
  SYNC_ABORT_TIMEOUT_INCREMENTAL_MS,
  SYNC_ABORT_TIMEOUT_MAX_MS,
  SYNC_ABORT_TIMEOUT_PER_1K_MS,
} from "../lib/constants/sync-policy";
import { asSyncBlockedReason } from "../lib/sync-block-window";
import { CS_DB_CLEANUP_AT } from "../lib/storage-keys";
import type {
  ApiCapability,
  AuthPhase,
  AuthState as SessionAuthState,
  AuthStatus,
  Bookmark,
  RuntimeSnapshot,
  SessionState,
  SyncBlockedReason,
  SyncRequestResult,
  SyncStatus,
} from "../types";
import { createPrefetchController } from "./prefetch-controller";
import { deriveAuthTransition, type AuthPayload } from "./auth-transition";

export type RuntimeMode =
  | "initializing"
  | "connecting"
  | "offline_empty"
  | "offline_cached"
  | "online_ready";

export type SyncJobKind = "none" | "bootstrap" | "backfill";

export interface SyncUiState {
  status: SyncStatus;
  jobKind: SyncJobKind;
  isBlocking: boolean;
  isBackground: boolean;
  blockedReason: SyncBlockedReason | null;
}

export interface SyncButtonState {
  visible: boolean;
  disabled: boolean;
  syncing: boolean;
  title: string;
}

export type FooterState =
  | "loading"
  | "connecting"
  | "need_login"
  | "bookmark_card"
  | "syncing_bootstrap"
  | "sync_error"
  | "empty_can_sync"
  | "empty_synced_clean"
  | "empty_offline";

export interface ReaderAvailabilityState {
  offlineMode: boolean;
  canLogin: boolean;
}

interface ActiveSyncController {
  abort: (markTimeout?: boolean) => void;
}

interface ActiveSyncLease {
  accountId: string | null;
  leaseId: string;
  mode: SyncMode;
  trigger: "manual" | "auto";
  released: boolean;
}

interface SyncOptions {
  trigger?: "manual" | "auto";
  localCountHint?: number;
}

export interface RuntimeActions {
  boot: () => Promise<void>;
  dispose: () => void;
  checkAuth: () => Promise<void>;
  connectingTimeout: () => void;
  startLogin: () => Promise<void>;
  refresh: () => Promise<SyncRequestResult>;
  reloadLocalData: () => Promise<void>;
  handleBookmarkEvents: () => Promise<void>;
  prepareForReset: () => void;
  unbookmark: (tweetId: string) => Promise<{ apiError?: string }>;
  releaseLease: () => void;
  setReaderActive: (active: boolean) => void;
  detailCached: (tweetId: string) => void;
  loadReaderDetail: (tweetId: string) => ReturnType<typeof fetchTweetDetail>;
  applyRuntimeSnapshot: (snapshot: RuntimeSnapshot) => Promise<void>;
}

export interface RuntimeState {
  authPhase: AuthPhase;
  authState: SessionAuthState;
  sessionState: SessionState;
  capability: ApiCapability;
  activeAccountId: string | null;
  authRetryDelayMs: number | null;
  bookmarksLoaded: boolean;
  detailedIdsLoaded: boolean;
  bookmarks: Bookmark[];
  detailedTweetIds: Set<string>;
  syncStatus: SyncStatus;
  syncJobKind: SyncJobKind;
  syncBlockedReason: SyncBlockedReason | null;
  bootGeneration: number;
  syncGeneration: number;
  readerActive: boolean;
  prefetchStatus: "idle" | "running" | "paused";
  lastSyncAt: number;
  actions: RuntimeActions;
}

const EMPTY_SET = new Set<string>();

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutError: Error,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(timeoutError), timeoutMs);
    }),
  ]).finally(() => {
    if (timer !== null) clearTimeout(timer);
  }) as Promise<T>;
}

function normalizeAuthPayloadFromSnapshot(snapshot: RuntimeSnapshot): AuthPayload {
  const bookmarksApi = snapshot.capability?.bookmarksApi ?? "unknown";
  const detailApi = snapshot.capability?.detailApi ?? "unknown";

  return {
    hasUser: snapshot.sessionState !== "logged_out" && Boolean(snapshot.accountContextId),
    hasAuth: snapshot.sessionState === "logged_in",
    authState:
      snapshot.sessionState === "logged_out"
        ? "logged_out"
        : snapshot.sessionState === "logged_in"
          ? "authenticated"
          : "stale",
    sessionState: snapshot.sessionState,
    userId: snapshot.sessionState !== "logged_out" ? snapshot.accountContextId : null,
    accountContextId: snapshot.accountContextId,
    bookmarksApi,
    detailApi,
    lastSyncAt: snapshot.cacheSummary?.lastSyncAt ?? 0,
  };
}

function normalizeAuthPayloadFromStatus(status: AuthStatus): AuthPayload {
  const authState = status.authState ?? (status.hasAuth ? "authenticated" : "logged_out");
  const sessionState = status.sessionState ??
    (authState === "logged_out"
      ? "logged_out"
      : status.hasAuth
        ? "logged_in"
        : "unknown");
  const bookmarksApi = status.capability?.bookmarksApi ??
    (status.hasAuth ? "ready" : "unknown");
  const detailApi = status.capability?.detailApi ?? "unknown";

  return {
    hasUser: status.hasUser,
    hasAuth: status.hasAuth,
    authState,
    sessionState,
    userId: typeof status.userId === "string" && status.userId ? status.userId : null,
    accountContextId:
      typeof status.accountContextId === "string" && status.accountContextId
        ? status.accountContextId
        : null,
    bookmarksApi,
    detailApi,
    lastSyncAt: 0,
  };
}

function compareSortIndexDesc(a: Bookmark, b: Bookmark): number {
  return b.sortIndex.localeCompare(a.sortIndex);
}

function syncAbortTimeout(bookmarkCount: number, mode: SyncMode): number {
  const base = mode === "full"
    ? SYNC_ABORT_TIMEOUT_FULL_MS
    : SYNC_ABORT_TIMEOUT_INCREMENTAL_MS;
  const extra = Math.floor(bookmarkCount / 1000) * SYNC_ABORT_TIMEOUT_PER_1K_MS;
  return Math.min(base + extra, SYNC_ABORT_TIMEOUT_MAX_MS);
}

function syncFailureCodeFromMessage(message: string): string | undefined {
  if (
    message === "RATE_LIMITED" ||
    message.startsWith("RATE_LIMITED:") ||
    message.includes("API_ERROR_429")
  ) {
    return "RATE_LIMITED";
  }
  return undefined;
}

function syncFailureStatus(message: string): SyncStatus {
  if (message === "AUTH_EXPIRED" || message === "NO_AUTH") {
    return "reauthing";
  }
  return "error";
}

function hasReadableCache(state: Pick<RuntimeState, "bookmarks" | "detailedTweetIds">): boolean {
  if (state.bookmarks.length === 0) return false;
  return state.bookmarks.some((bookmark) => state.detailedTweetIds.has(bookmark.tweetId));
}

function normalizeRuntimeState(state: RuntimeState): RuntimeState {
  let next = state;

  if (next.syncStatus !== "syncing" && next.syncJobKind !== "none") {
    next = { ...next, syncJobKind: "none" };
  }

  if (next.syncStatus === "syncing" && next.syncJobKind === "none") {
    next = {
      ...next,
      syncJobKind: next.bookmarks.length > 0 ? "backfill" : "bootstrap",
    };
  }

  if (next.syncJobKind === "bootstrap" && next.bookmarks.length > 0) {
    next = { ...next, syncJobKind: "backfill" };
  }

  if (next.sessionState === "logged_out" && next.authPhase === "ready") {
    next = { ...next, authPhase: "need_login" };
  }

  return next;
}

function describeBlockedReason(reason: SyncBlockedReason | null): string | undefined {
  switch (reason) {
    case "in_flight":
      return "A sync is already running.";
    case "cooldown":
      return "You can resync only once every few minutes.";
    case "rate_limited":
      return "Sync is temporarily paused. Try again in a few minutes.";
    case "no_account":
      return "Account context is not available yet.";
    case "not_ready":
      return "Sync is not ready yet.";
    default:
      return undefined;
  }
}

function deriveRuntimeMode(state: RuntimeState): RuntimeMode {
  if (!state.bookmarksLoaded || !state.detailedIdsLoaded || state.authPhase === "loading") {
    return "initializing";
  }

  if (state.authPhase === "connecting") {
    return "connecting";
  }

  if (state.authPhase === "need_login" || state.syncStatus === "reauthing") {
    return hasReadableCache(state) ? "offline_cached" : "offline_empty";
  }

  return "online_ready";
}

function shouldRestrictToCachedDetails(state: RuntimeState): boolean {
  return state.authPhase === "need_login" ||
    state.authPhase === "connecting" ||
    state.syncStatus === "reauthing";
}

function shouldAutoSync(state: RuntimeState): boolean {
  return state.authPhase === "ready" && state.syncStatus === "idle";
}

function createInitialState(actions: RuntimeActions): RuntimeState {
  return {
    authPhase: "loading",
    authState: "stale",
    sessionState: "unknown",
    capability: {
      bookmarksApi: "unknown",
      detailApi: "unknown",
    },
    activeAccountId: null,
    authRetryDelayMs: null,
    bookmarksLoaded: false,
    detailedIdsLoaded: false,
    bookmarks: [],
    detailedTweetIds: EMPTY_SET,
    syncStatus: "loading",
    syncJobKind: "none",
    syncBlockedReason: null,
    bootGeneration: 0,
    syncGeneration: 0,
    readerActive: false,
    prefetchStatus: "idle",
    lastSyncAt: 0,
    actions,
  };
}

export function createRuntimeStore() {
  let activeSyncController: ActiveSyncController | null = null;
  let activeLease: ActiveSyncLease | null = null;
  // Account-bound DB handle; swapped in lockstep with setActiveAccountId
  // (which stays until every db consumer is migrated to a handle).
  let accountDb: AccountDb = openAccountDb(null);
  let processingBookmarkEvents = false;
  let authRequestId = 0;
  let cleanupStarted = false;
  let unsubscribeDetailCache: (() => void) | null = null;
  // Scheduled auto-retry for when an auto-sync was blocked by auto_backoff.
  // The SW returns retryAfterMs telling us when the window clears; we set
  // a single timer to fire another auto-sync then. Without this, a blocked
  // seed-incomplete sync would never retry until the user reloaded — and
  // if the user reloads inside the backoff window, they just block again.
  let scheduledAutoRetryTimer: ReturnType<typeof setTimeout> | null = null;

  const useRuntimeStoreBase = create<RuntimeState>((set, get) => {
    const setRuntimeState = (
      updater: Partial<RuntimeState> | ((state: RuntimeState) => Partial<RuntimeState>),
    ) => {
      set((state) => {
        const patch = typeof updater === "function" ? updater(state) : updater;
        const patchEntries = Object.entries(patch) as Array<
          [keyof RuntimeState, RuntimeState[keyof RuntimeState]]
        >;

        if (patchEntries.length === 0) {
          return state;
        }

        let hasDirectChange = false;
        for (const [key, value] of patchEntries) {
          if (!Object.is(state[key], value)) {
            hasDirectChange = true;
            break;
          }
        }

        if (!hasDirectChange) {
          return state;
        }

        const normalized = normalizeRuntimeState({ ...state, ...patch });
        const normalizedEntries = Object.entries(normalized) as Array<
          [keyof RuntimeState, RuntimeState[keyof RuntimeState]]
        >;
        for (const [key, value] of normalizedEntries) {
          if (!Object.is(state[key], value)) {
            return normalized;
          }
        }

        return state;
      });
    };

    const releaseActiveLease = async (
      status: "success" | "failure" | "timeout" | "skipped",
      errorCode?: string,
    ): Promise<void> => {
      const lease = activeLease;
      if (!lease || lease.released) return;

      lease.released = true;
      try {
        await completeSyncRun({
          accountId: lease.accountId,
          leaseId: lease.leaseId,
          mode: lease.mode,
          status,
          trigger: lease.trigger,
          errorCode,
        });
        if (activeLease === lease) {
          activeLease = null;
        }
      } catch {
        lease.released = false;
      }
    };

    const stopSync = (markTimeout = false) => {
      activeSyncController?.abort(markTimeout);
    };

    const clearSyncForGeneration = (syncGeneration: number) => {
      if (get().syncGeneration !== syncGeneration) return;
      setRuntimeState({
        syncStatus: "idle",
        syncJobKind: "none",
      });
    };

    const maybeRunDbCleanup = () => {
      if (cleanupStarted) return;
      cleanupStarted = true;

      (async () => {
        try {
          const stored = await chrome.storage.local.get([CS_DB_CLEANUP_AT]);
          const lastCleanup = Number(stored[CS_DB_CLEANUP_AT] || 0);
          if (Date.now() - lastCleanup < WEEK_MS) return;

          await Promise.all([
            accountDb.cleanupOldTweetDetails(DETAIL_CACHE_RETENTION_MS),
            chrome.storage.local.set({ [CS_DB_CLEANUP_AT]: Date.now() }),
          ]);
        } catch {}
      })().catch(() => {});
    };

    const clearScheduledAutoRetry = () => {
      if (scheduledAutoRetryTimer !== null) {
        clearTimeout(scheduledAutoRetryTimer);
        scheduledAutoRetryTimer = null;
      }
    };

    const scheduleAutoRetry = (delayMs: number) => {
      clearScheduledAutoRetry();
      // Small buffer so we arrive just after the SW's window clears.
      const effective = Math.max(1_000, delayMs + 500);
      // [TOTEM-DIAG] Scheduled retry — answers: "after a blocked auto-sync,
      // did the runtime schedule a follow-up?"
      console.debug("[TOTEM-DIAG] scheduleAutoRetry", { delayMs: effective });
      scheduledAutoRetryTimer = setTimeout(() => {
        scheduledAutoRetryTimer = null;
        const state = get();
        const willFire =
          state.syncStatus !== "syncing" && shouldAutoSync(state);
        // [TOTEM-DIAG] Retry fired — answers: "did the scheduled timer
        // actually run, and did it trigger another sync attempt?"
        console.debug("[TOTEM-DIAG] scheduleAutoRetry.fired", {
          willFire,
          syncStatus: state.syncStatus,
          authPhase: state.authPhase,
        });
        if (!willFire) return;
        void sync({ trigger: "auto" }).catch(() => {});
      }, effective);
    };

    const maybeStartAutomaticSync = () => {
      const state = get();
      // A retry is already scheduled — the SW returned a timed block
      // (fresh_cache / auto_backoff) and we're waiting out that window.
      // Re-entering now would just hit the same block and add noise to
      // both the SW log and any UI that reflects `syncStatus` transitions
      // (FINDINGS §5).
      const retryPending = scheduledAutoRetryTimer !== null;
      console.debug("[TOTEM-DIAG] maybeStartAutomaticSync", {
        syncStatus: state.syncStatus,
        authPhase: state.authPhase,
        bookmarksLoaded: state.bookmarksLoaded,
        bookmarkCount: state.bookmarks.length,
        retryPending,
        shouldFire:
          !retryPending &&
          state.syncStatus !== "syncing" &&
          shouldAutoSync(state),
      });
      if (retryPending) return;
      if (state.syncStatus === "syncing") return;

      if (shouldAutoSync(state)) {
        void sync({ trigger: "auto" }).catch(() => {});
      }
    };

    const hydrateCurrentAccount = (
      bootGeneration: number,
      allowAutoSync: boolean,
    ): Promise<void> => {
      const accountId = get().activeAccountId;
      setActiveAccountId(accountId);
      accountDb = openAccountDb(accountId);
      if (get().bootGeneration !== bootGeneration) return Promise.resolve();

      return Promise.allSettled([
        withTimeout(
          accountDb.getAllBookmarks(),
          DB_INIT_TIMEOUT_MS,
          new Error("DB_INIT_TIMEOUT"),
        ),
        withTimeout(
          accountDb.getDetailedTweetIds(),
          DB_INIT_TIMEOUT_MS,
          new Error("DETAIL_DB_INIT_TIMEOUT"),
        ),
      ]).then(([bookmarksResult, detailedIdsResult]) => {
        if (get().bootGeneration !== bootGeneration) return;

        const bookmarks =
          bookmarksResult.status === "fulfilled" ? bookmarksResult.value : [];
        const detailedTweetIds =
          detailedIdsResult.status === "fulfilled" ? detailedIdsResult.value : new Set<string>();

        setRuntimeState((state) => ({
          bookmarks,
          detailedTweetIds,
          bookmarksLoaded: true,
          detailedIdsLoaded: true,
          syncStatus: state.syncStatus === "syncing" ? state.syncStatus : "idle",
        }));

        if (allowAutoSync) {
          maybeStartAutomaticSync();
        }

        if (get().authPhase === "ready") {
          void get().actions.handleBookmarkEvents().catch(() => {});
        }

        prefetchController.reconcile();
      });
    };

    const loadAuthPayload = async (): Promise<AuthPayload> => {
      try {
        const snapshot = await withTimeout(
          getRuntimeSnapshot(),
          AUTH_TIMEOUT_MS,
          new Error("AUTH_TIMEOUT"),
        );
        return normalizeAuthPayloadFromSnapshot(snapshot);
      } catch {
        const status = await withTimeout(
          checkAuth({}),
          AUTH_TIMEOUT_MS,
          new Error("AUTH_TIMEOUT"),
        );
        return normalizeAuthPayloadFromStatus(status);
      }
    };

    const applyAuthPayload = async (
      payload: AuthPayload,
      options: {
        allowHydration: boolean;
        allowAutoSync: boolean;
      },
    ): Promise<void> => {
      const { patch, effects } = deriveAuthTransition(get(), payload, options);
      setRuntimeState(patch);

      for (const effect of effects) {
        switch (effect.kind) {
          case "releaseActiveWork":
            stopSync();
            void releaseActiveLease("skipped");
            break;
          case "clearScheduledAutoRetry":
            clearScheduledAutoRetry();
            break;
          case "startAuthCapture":
            void startAuthCapture({ interactive: effect.interactive }).catch(
              () => {},
            );
            break;
          case "hydrate":
            // Terminal: hydrateCurrentAccount runs its own post-hydrate
            // auto-sync + prefetch reconcile, so no further effects follow.
            await hydrateCurrentAccount(
              effect.bootGeneration,
              effect.allowAutoSync,
            );
            return;
          case "maybeAutoSync":
            maybeStartAutomaticSync();
            break;
          case "reconcilePrefetch":
            prefetchController.reconcile();
            break;
        }
      }
    };

    const runAuthCheck = (): Promise<void> => {
      const requestId = authRequestId + 1;
      authRequestId = requestId;

      if (requestId !== authRequestId) return Promise.resolve();

      return loadAuthPayload()
        .then(async (payload) => {
          if (requestId !== authRequestId) return;
          await applyAuthPayload(payload, {
            allowHydration: true,
            allowAutoSync: true,
          });
        })
        .catch(() => {
          if (requestId !== authRequestId) return;
          setRuntimeState((state) => {
            if (state.authPhase === "ready") {
              return {
                authState: "stale",
                authRetryDelayMs: AUTH_RETRY_MS,
              };
            }

            return {
              authState: state.authState === "authenticated" ? "stale" : state.authState,
              authPhase: "connecting",
              authRetryDelayMs: AUTH_RETRY_MS,
            };
          });
        });
    };

    const sync = async (options: SyncOptions = {}): Promise<SyncRequestResult> => {
      const state = get();
      const accountId = state.activeAccountId;
      const trigger = options.trigger ?? "manual";
      const startingLocalCount = state.bookmarks.length;
      const localCount =
        typeof options.localCountHint === "number" && Number.isFinite(options.localCountHint)
          ? options.localCountHint
          : startingLocalCount;

      const policy = await reserveSyncRun({
        accountId,
        trigger,
        localCount,
      }).catch(() => null);

      if (!policy) {
        if (trigger === "manual") {
          setRuntimeState({ syncBlockedReason: "not_ready" });
          return { accepted: false, reason: "not_ready" };
        }
        return { accepted: false, reason: "runtime_error" };
      }

      if (!policy.allow || !policy.mode || !policy.leaseId) {
        const blockedReason = asSyncBlockedReason(policy.reason);
        if (trigger === "manual") {
          setRuntimeState({
            syncBlockedReason: blockedReason || "not_ready",
          });
        }
        // Schedule an auto-retry when an auto-triggered sync got blocked
        // by a time-bounded reason (auto_backoff, fresh_cache). This is
        // the "auto-resume" path that used to exist pre-refactor — without
        // it, a blocked seed-incomplete sync never retries unless the user
        // reloads at exactly the right time. We don't auto-retry on
        // in_flight (another sync is already running), cooldown (manual
        // just succeeded; user didn't ask for more), rate_limited (that
        // has its own backoff tracking), or not_ready / no_account.
        const retryAfterMs = policy.retryAfterMs;
        const shouldAutoRetry =
          trigger === "auto" &&
          (policy.reason === "auto_backoff" ||
            policy.reason === "fresh_cache") &&
          typeof retryAfterMs === "number" &&
          retryAfterMs > 0;
        if (shouldAutoRetry) {
          scheduleAutoRetry(retryAfterMs as number);
        }
        return {
          accepted: false,
          reason: blockedReason || policy.reason || "blocked",
          retryAfterMs: policy.retryAfterMs,
        };
      }

      // A reservation was granted — no need for a pending scheduled retry.
      clearScheduledAutoRetry();

      const current = get();
      if (current.authPhase !== "ready") {
        await completeSyncRun({
          accountId: policy.accountKey || accountId,
          leaseId: policy.leaseId,
          mode: policy.mode,
          status: "skipped",
          trigger,
        }).catch(() => {});

        if (trigger === "manual") {
          setRuntimeState({ syncBlockedReason: "not_ready" });
        }
        return { accepted: false, reason: "not_ready" };
      }

      const syncGeneration = current.syncGeneration + 1;
      const mode = policy.mode;
      const jobKind: SyncJobKind = current.bookmarks.length > 0 ? "backfill" : "bootstrap";
      setRuntimeState({
        syncGeneration,
        syncStatus: "syncing",
        syncJobKind: jobKind,
        syncBlockedReason: null,
      });

      const queue = new FetchQueue();
      const abortState = { aborted: false, isTimeout: false };
      const timeout = syncAbortTimeout(current.bookmarks.length, mode);
      const abortSync = (markTimeout = false) => {
        if (abortState.aborted) return;
        abortState.aborted = true;
        abortState.isTimeout = markTimeout;
        queue.abort();
      };

      activeSyncController = { abort: abortSync };
      activeLease = {
        accountId: policy.accountKey || accountId,
        leaseId: policy.leaseId,
        mode,
        trigger,
        released: false,
      };

      let completionStatus: "success" | "failure" | "timeout" = "failure";
      let completionErrorCode: string | undefined;
      const syncTimer = setTimeout(() => {
        abortSync(true);
      }, timeout);

      const onPage = async (pageNew: Bookmark[]) => {
        if (abortState.aborted || get().syncGeneration !== syncGeneration) return;

        const currentBookmarks = get().bookmarks;
        const currentIds = new Set(currentBookmarks.map((bookmark) => bookmark.tweetId));
        const deduped = pageNew.filter((bookmark) => !currentIds.has(bookmark.tweetId));
        if (deduped.length === 0) return;

        const updated = [...currentBookmarks, ...deduped].toSorted(compareSortIndexDesc);

        // Persist before the in-memory update so a failed IndexedDB write
        // propagates and the sync reports failure, instead of leaving the store
        // ahead of the DB (a false-success split-brain).
        await accountDb.upsertBookmarks(deduped);

        setRuntimeState({
          bookmarks: updated,
          syncJobKind: updated.length > 0 ? "backfill" : get().syncJobKind,
        });

        prefetchController.reconcile();
      };

      const runReconcilePass = async (runOptions: {
        continueOnNoNewItems?: boolean;
        maxPages?: number;
        maxBookmarks?: number;
      }) => {
        return reconcileBookmarks({
          localIds: new Set(get().bookmarks.map((bookmark) => bookmark.tweetId)),
          fetchPage: (cursor) =>
            queue.enqueue(() =>
              withTimeout(
                fetchBookmarkPage(cursor),
                PAGE_FETCH_TIMEOUT_MS,
                new Error("PAGE_FETCH_TIMEOUT"),
              ),
            ),
          fullReconcile: mode === "full",
          maxPages: runOptions.maxPages,
          maxBookmarks: runOptions.maxBookmarks,
          continueOnNoNewItems: runOptions.continueOnNoNewItems,
          onPage,
        });
      };

      try {
        const firstPass = await runReconcilePass({});

        let reconcileResult = firstPass;
        if (
          trigger === "manual" &&
          reconcileResult.needsRecovery &&
          !abortState.aborted &&
          get().syncGeneration === syncGeneration
        ) {
          reconcileResult = await runReconcilePass({
            continueOnNoNewItems: true,
          });
        }

        if (!abortState.aborted && get().syncGeneration === syncGeneration) {
          const fullSyncCompleted = mode !== "full" ||
            reconcileResult.terminationReason === "complete";

          // [TOTEM-DIAG] Reconcile result — answers: "did we stop early, and
          // if so, why?" Key fields: terminationReason (complete / cursor_missing
          // / duplicate_stop / page_cap), pagesRequested, newBookmarks count.
          console.debug("[TOTEM-DIAG] reconcile.result", {
            mode,
            terminationReason: reconcileResult.terminationReason,
            pagesRequested: reconcileResult.pagesRequested,
            newBookmarksCount: reconcileResult.newBookmarks.length,
            lastCursor: reconcileResult.lastCursor,
            needsRecovery: reconcileResult.needsRecovery,
            capReached: reconcileResult.capReached,
            staleIds: reconcileResult.staleIds.length,
            localBookmarksNow: get().bookmarks.length,
            fullSyncCompleted,
          });

          if (!fullSyncCompleted) {
            completionErrorCode = "INCOMPLETE_FULL_SYNC";
            setRuntimeState({
              syncStatus: "error",
              syncJobKind: "none",
              syncBlockedReason: null,
            });
          } else {
            if (mode === "full" && reconcileResult.staleIds.length > 0) {
              await accountDb.deleteBookmarksByTweetIds(reconcileResult.staleIds, {
                purgeHighlights: false,
              });
              const staleIds = new Set(reconcileResult.staleIds);
              setRuntimeState((state) => ({
                bookmarks: state.bookmarks.filter((bookmark) => !staleIds.has(bookmark.tweetId)),
              }));
            }

            // CS_LAST_SYNC / CS_LAST_SOFT_SYNC / CS_SOFT_SYNC_NEEDED are
            // written by the SW's COMPLETE_SYNC handler based on the
            // reported completion status. One writer per persisted fact.
            setRuntimeState({
              syncStatus: "idle",
              syncJobKind: "none",
              syncBlockedReason: null,
              lastSyncAt: Date.now(),
            });
            completionStatus = "success";
          }
        }
      } catch (error) {
        if (!abortState.aborted && get().syncGeneration === syncGeneration) {
          const message = error instanceof Error ? error.message : "SYNC_ERROR";
          completionErrorCode = syncFailureCodeFromMessage(message);
          const nextStatus = syncFailureStatus(message);
          setRuntimeState({
            syncStatus: nextStatus,
            syncJobKind: "none",
          });
          if (nextStatus === "reauthing") {
            void runAuthCheck().catch(() => {});
          }
        }
      } finally {
        clearTimeout(syncTimer);
        if (activeSyncController?.abort === abortSync) {
          activeSyncController = null;
        }

        if (abortState.isTimeout && get().syncGeneration === syncGeneration) {
          // CS_LAST_SYNC is written by the SW's COMPLETE_SYNC handler when
          // status === "timeout". No runtime-side mirror write.
          clearSyncForGeneration(syncGeneration);
          completionStatus = "timeout";
        }

        await releaseActiveLease(completionStatus, completionErrorCode);
      }

      prefetchController.reconcile();
      return { accepted: true };
    };

    const prefetchController = createPrefetchController({
      getSnapshot: () => {
        const state = get();
        return {
          bookmarks: state.bookmarks,
          detailedTweetIds: state.detailedTweetIds,
          readerActive: state.readerActive,
          onlineReady: deriveRuntimeMode(state) === "online_ready",
        };
      },
      fetchDetail: async (tweetId) => {
        await get().actions.loadReaderDetail(tweetId);
      },
      getCompletedTweetIds: () => accountDb.getCompletedTweetIds(),
      onSuccess: (tweetId) => {
        get().actions.detailCached(tweetId);
      },
      onStatusChange: (status) => {
        setRuntimeState({ prefetchStatus: status });
      },
    });

    const actions: RuntimeActions = {
      boot: async () => {
        const bootGeneration = get().bootGeneration + 1;
        authRequestId += 1;
        setRuntimeState({
          bootGeneration,
          authPhase: "loading",
          authRetryDelayMs: null,
          bookmarksLoaded: false,
          detailedIdsLoaded: false,
          syncStatus: "loading",
          syncJobKind: "none",
          syncBlockedReason: null,
        });

        maybeRunDbCleanup();

        if (get().bootGeneration !== bootGeneration) return;
        await loadAuthPayload()
          .then(async (payload) => {
            if (get().bootGeneration !== bootGeneration) return;
            await applyAuthPayload(payload, {
              allowHydration: true,
              allowAutoSync: true,
            });
          })
          .catch(() => {
            if (get().bootGeneration !== bootGeneration) return;

            setRuntimeState({
              authPhase: "connecting",
              authRetryDelayMs: AUTH_RETRY_MS,
              bookmarksLoaded: true,
              detailedIdsLoaded: true,
              syncStatus: "idle",
            });
          });
      },

      dispose: () => {
        unsubscribeDetailCache?.();
        unsubscribeDetailCache = null;
        prefetchController.stop();
        stopSync();
        clearScheduledAutoRetry();
        authRequestId += 1;
        setRuntimeState((state) => ({
          bootGeneration: state.bootGeneration + 1,
          syncGeneration: state.syncGeneration + 1,
          readerActive: false,
          authRetryDelayMs: null,
        }));
        void releaseActiveLease("skipped");
      },

      checkAuth: async () => {
        await runAuthCheck();
      },

      connectingTimeout: () => {
        setRuntimeState((state) => {
          if (state.authPhase !== "connecting") return {};
          return {
            authPhase: "need_login",
            sessionState: "unknown",
            authRetryDelayMs: AUTH_STALE_RECHECK_MS,
          };
        });
      },

      startLogin: async () => {
        setRuntimeState({
          authPhase: "connecting",
          sessionState: "unknown",
          authRetryDelayMs: AUTH_QUICK_CHECK_MS,
        });
        void startAuthCapture({ interactive: true, force: true }).catch(() => {});
        await runAuthCheck();
      },

      refresh: async () => sync({ trigger: "manual" }),

      reloadLocalData: async () => {
        // Bump the generation so a concurrent reload/hydration supersedes this
        // one, but keep bookmarksLoaded/detailedIdsLoaded true: the data is
        // already on screen and only gets swapped when the re-read resolves.
        // Flipping them false would drop the UI into a full-screen loading
        // spinner for the duration of the read (e.g. right after an import).
        const bootGeneration = get().bootGeneration + 1;
        setRuntimeState({ bootGeneration });

        const accountId = get().activeAccountId;
        setActiveAccountId(accountId);
        accountDb = openAccountDb(accountId);
        const [bookmarksResult, detailedIdsResult] = await Promise.allSettled([
          withTimeout(
            accountDb.getAllBookmarks(),
            DB_INIT_TIMEOUT_MS,
            new Error("DB_INIT_TIMEOUT"),
          ),
          withTimeout(
            accountDb.getDetailedTweetIds(),
            DB_INIT_TIMEOUT_MS,
            new Error("DETAIL_DB_INIT_TIMEOUT"),
          ),
        ]);

        if (get().bootGeneration !== bootGeneration) return;

        const bookmarks =
          bookmarksResult.status === "fulfilled" ? bookmarksResult.value : [];
        const detailedTweetIds =
          detailedIdsResult.status === "fulfilled" ? detailedIdsResult.value : new Set<string>();

        setRuntimeState((state) => ({
          bookmarks,
          detailedTweetIds,
          bookmarksLoaded: true,
          detailedIdsLoaded: true,
          syncStatus: state.syncStatus === "syncing" ? state.syncStatus : "idle",
        }));
        prefetchController.reconcile();
      },

      /**
       * Apply a RuntimeSnapshot pushed from the service worker.
       *
       * Used by the `chrome.storage.onChanged` subscription in RuntimeProvider:
       * when the SW persists a new snapshot to `CS_RUNTIME_STATE_V2`, the
       * runtime picks up SW-mirrored facts (capability, session, account)
       * without re-RPC'ing or re-hydrating IDB. This is the reactive
       * invalidation channel that replaces "wait for the next heartbeat".
       */
      applyRuntimeSnapshot: async (snapshot: RuntimeSnapshot) => {
        const payload = normalizeAuthPayloadFromSnapshot(snapshot);
        await applyAuthPayload(payload, {
          allowHydration: false,
          allowAutoSync: false,
        });
      },

      handleBookmarkEvents: async () => {
        if (processingBookmarkEvents) return;
        if (get().authPhase !== "ready") return;

        processingBookmarkEvents = true;
        try {
          const events = await getBookmarkEvents();
          if (events.length === 0) return;

          const plan = resolveBookmarkEventPlan(events);
          const deleteEventIds: string[] = [];
          const createEventIds: string[] = [];
          for (const event of events) {
            if (event.type === "DeleteBookmark") deleteEventIds.push(event.id);
            if (event.type === "CreateBookmark") createEventIds.push(event.id);
          }

          if (plan.idsToDelete.length > 0) {
            const toDelete = new Set(plan.idsToDelete);
            setRuntimeState((state) => ({
              bookmarks: state.bookmarks.filter((bookmark) => !toDelete.has(bookmark.tweetId)),
            }));

            await accountDb.deleteBookmarksByTweetIds(plan.idsToDelete, {
              purgeHighlights: false,
            });
          }

          if (deleteEventIds.length > 0) {
            await ackBookmarkEvents(deleteEventIds);
          }

          let createFetchSucceeded = true;
          if (plan.needsPageFetch) {
            try {
              await new Promise((resolve) => setTimeout(resolve, CREATE_EVENT_DELAY_MS));
              const page = await fetchBookmarkPage(undefined, 20);
              const currentIds = new Set(get().bookmarks.map((bookmark) => bookmark.tweetId));
              const deduped = page.bookmarks.filter((bookmark) => !currentIds.has(bookmark.tweetId));
              if (deduped.length > 0) {
                // Persist before the in-memory update; on failure the catch below
                // marks the fetch failed so the create events stay un-acked for
                // retry and the store is not left ahead of the DB.
                await accountDb.upsertBookmarks(deduped);
                const updated = [...get().bookmarks, ...deduped].toSorted(compareSortIndexDesc);
                setRuntimeState({ bookmarks: updated });
                prefetchController.reconcile();
              }
              // CS_LAST_SOFT_SYNC is the SW's record of a completed sync run
              // and is not written here. Bookmark-event-driven page refreshes
              // are a different flow (no reservation, no orchestrator state)
              // and must not mirror the SW's key.
            } catch {
              createFetchSucceeded = false;
            }
          }

          if (createEventIds.length > 0 && createFetchSucceeded) {
            await ackBookmarkEvents(createEventIds);
          }
        } finally {
          processingBookmarkEvents = false;
        }
      },

      prepareForReset: () => {
        prefetchController.stop();
        stopSync();
        void releaseActiveLease("skipped");
        clearScheduledAutoRetry();
        authRequestId += 1;
        setRuntimeState((state) => ({
          syncGeneration: state.syncGeneration + 1,
          syncStatus: "idle",
          syncJobKind: "none",
          syncBlockedReason: null,
          bookmarks: [],
          detailedTweetIds: new Set<string>(),
          bookmarksLoaded: true,
          detailedIdsLoaded: true,
        }));
      },

      unbookmark: async (tweetId: string) => {
        if (!tweetId) return {};

        setRuntimeState((state) => ({
          bookmarks: state.bookmarks.filter((bookmark) => bookmark.tweetId !== tweetId),
        }));

        await accountDb.deleteBookmarksByTweetIds([tweetId], {
          purgeHighlights: false,
        });

        try {
          await deleteBookmark(tweetId);
        } catch (error) {
          return { apiError: error instanceof Error ? error.message : "Unknown error" };
        }

        prefetchController.reconcile();
        return {};
      },

      releaseLease: () => {
        stopSync();
        void releaseActiveLease("skipped");
      },

      setReaderActive: (active) => {
        if (get().readerActive === active) {
          return;
        }
        setRuntimeState({ readerActive: active });
        if (active) {
          prefetchController.reconcile();
          return;
        }
        prefetchController.reconcile();
      },

      detailCached: (tweetId) => {
        if (!tweetId) return;
        setRuntimeState((state) => {
          if (state.detailedTweetIds.has(tweetId)) return {};
          const next = new Set(state.detailedTweetIds);
          next.add(tweetId);
          return { detailedTweetIds: next };
        });
      },

      loadReaderDetail: async (tweetId: string) => {
        const detail = await withTimeout(
          fetchTweetDetail(tweetId),
          READER_DETAIL_TIMEOUT_MS,
          new Error("DETAIL_TIMEOUT"),
        );
        get().actions.detailCached(tweetId);
        prefetchController.reconcile();
        return detail;
      },
    };

    unsubscribeDetailCache = subscribeTweetDetailCache((tweetId) => {
      get().actions.detailCached(tweetId);
      prefetchController.reconcile();
    });

    return createInitialState(actions);
  });

  return useRuntimeStoreBase;
}

export const useRuntimeStoreBase = createRuntimeStore();

export const runtimeStore = {
  getState: () => useRuntimeStoreBase.getState(),
  setState: useRuntimeStoreBase.setState,
  subscribe: useRuntimeStoreBase.subscribe,
};

export function selectRuntimeMode(state: RuntimeState): RuntimeMode {
  return deriveRuntimeMode(state);
}

export function selectDisplayBookmarks(state: RuntimeState): Bookmark[] {
  if (!shouldRestrictToCachedDetails(state)) {
    return state.bookmarks;
  }

  return state.bookmarks.filter((bookmark) => state.detailedTweetIds.has(bookmark.tweetId));
}

export function selectShouldRestrictToCachedDetails(state: RuntimeState): boolean {
  return shouldRestrictToCachedDetails(state);
}

export function selectSyncUiState(state: RuntimeState): SyncUiState {
  const visibleBookmarks = selectDisplayBookmarks(state);
  const hasVisibleContent = visibleBookmarks.length > 0;
  const isBlocking = state.syncStatus === "syncing" &&
    state.syncJobKind === "bootstrap" &&
    !hasVisibleContent;
  const isBackground = state.syncStatus === "syncing" &&
    state.syncJobKind === "backfill";

  return {
    status: state.syncStatus,
    jobKind: state.syncJobKind,
    isBlocking,
    isBackground,
    blockedReason: state.syncBlockedReason,
  };
}

export function selectSyncButtonState(state: RuntimeState): SyncButtonState {
  const mode = deriveRuntimeMode(state);
  const syncUiState = selectSyncUiState(state);
  const blockedReason = describeBlockedReason(state.syncBlockedReason);
  const visible = mode === "online_ready";
  const disabled = syncUiState.isBlocking ||
    syncUiState.isBackground ||
    mode !== "online_ready";

  let title = blockedReason || "Sync bookmarks";
  if (syncUiState.isBackground) {
    title = "Updating bookmarks...";
  } else if (syncUiState.isBlocking) {
    title = "Syncing bookmarks...";
  }

  return {
    visible: visible && !syncUiState.isBlocking,
    disabled,
    syncing: syncUiState.isBackground,
    title,
  };
}

export function selectFooterState(
  state: RuntimeState,
  hasCurrentItem: boolean,
  isResetting = false,
): FooterState {
  const mode = deriveRuntimeMode(state);
  const syncUiState = selectSyncUiState(state);

  if (isResetting) return "loading";
  if (mode === "initializing") return "loading";
  if (mode === "connecting" && !hasCurrentItem) return "connecting";
  if (mode === "offline_empty") return "need_login";
  if (hasCurrentItem) return "bookmark_card";
  if (syncUiState.isBlocking) return "syncing_bootstrap";
  if (state.syncStatus === "error" || state.syncStatus === "reauthing") return "sync_error";
  if (mode === "offline_cached") return "empty_offline";
  if (state.lastSyncAt > 0 && state.bookmarks.length === 0) return "empty_synced_clean";
  return "empty_can_sync";
}

export function selectReaderAvailabilityState(state: RuntimeState): ReaderAvailabilityState {
  const mode = deriveRuntimeMode(state);
  return {
    offlineMode: mode === "offline_cached" || mode === "offline_empty",
    canLogin: mode === "offline_cached" ||
      mode === "offline_empty" ||
      state.syncStatus === "reauthing",
  };
}

export function selectIsOffline(state: RuntimeState): boolean {
  const mode = deriveRuntimeMode(state);
  return mode === "offline_cached" || mode === "offline_empty";
}

export function selectSyncRetryDelay(state: RuntimeState): number | null {
  return state.authRetryDelayMs;
}

export function selectAuthPhase(state: RuntimeState): AuthPhase {
  return state.authPhase;
}

export function selectActiveAccountId(state: RuntimeState): string | null {
  return state.activeAccountId;
}

export function selectDetailedTweetIds(state: RuntimeState): Set<string> {
  return state.detailedTweetIds;
}

export function selectBookmarks(state: RuntimeState): Bookmark[] {
  return state.bookmarks;
}
