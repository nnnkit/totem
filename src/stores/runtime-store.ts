import { create } from "zustand";
import {
  checkAuth,
  getRuntimeSnapshot,
} from "../api/core/auth";
import {
  ackBookmarkEvents,
  createBookmark,
  deleteBookmark,
  fetchBookmarkPage,
  getBookmarkEvents,
  queueBookmarkMutation,
} from "../api/core/bookmarks";
import { fetchTweetDetail } from "../api/core/posts";
import {
  completeSyncRun,
  reserveSyncRun,
  type SyncMode,
} from "../api/core/sync";
import {
  cleanupOldTweetDetails,
  deleteBookmarksByTweetIds,
  getAllBookmarks,
  getDetailedTweetIds,
  setActiveAccountId,
  upsertBookmarks,
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
  SYNC_ABORT_TIMEOUT_FULL_MS,
  SYNC_ABORT_TIMEOUT_INCREMENTAL_MS,
  SYNC_ABORT_TIMEOUT_MAX_MS,
  SYNC_ABORT_TIMEOUT_PER_1K_MS,
  SYNC_MAX_BOOKMARKS_PER_JOB,
  SYNC_MAX_PAGES_PER_JOB,
  WEEK_MS,
} from "../lib/constants";
import {
  CS_DB_CLEANUP_AT,
  CS_LAST_SOFT_SYNC,
  CS_LAST_SYNC,
  CS_SOFT_SYNC_NEEDED,
  LS_BOOT_SYNC_POLICY,
  LS_MANUAL_SYNC_REQUIRED,
} from "../lib/storage-keys";
import type {
  ApiCapability,
  ApiCapabilityState,
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

export type RuntimeMode =
  | "initializing"
  | "connecting"
  | "offline_empty"
  | "offline_cached"
  | "online_blocked"
  | "online_ready";

export type BootSyncPolicy = "auto" | "manual_only_until_seeded";
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
  | "preparing_sync"
  | "need_login"
  | "bookmark_card"
  | "syncing_bootstrap"
  | "sync_error"
  | "empty_can_sync"
  | "empty_offline";

export interface ReaderAvailabilityState {
  offlineMode: boolean;
  canLogin: boolean;
}

interface AuthPayload {
  hasUser: boolean;
  hasAuth: boolean;
  hasQueryId: boolean;
  authState: SessionAuthState;
  sessionState: SessionState;
  userId: string | null;
  accountContextId: string | null;
  bookmarksApi: ApiCapabilityState;
  detailApi: ApiCapabilityState;
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
  requestedMode?: SyncMode;
  localCountHint?: number;
}

export interface RuntimeActions {
  boot: () => Promise<void>;
  dispose: () => void;
  checkAuth: () => Promise<void>;
  connectingTimeout: () => void;
  startLogin: () => Promise<void>;
  refresh: () => Promise<SyncRequestResult>;
  handleBookmarkEvents: () => Promise<void>;
  prepareForReset: () => void;
  bookmark: (
    tweetId: string,
  ) => Promise<{ bookmark: Bookmark | null; createdOnX: boolean; apiError?: string }>;
  unbookmark: (tweetId: string) => Promise<{ apiError?: string }>;
  releaseLease: () => void;
  setReaderActive: (active: boolean) => void;
  detailCached: (tweetId: string) => void;
  loadReaderDetail: (tweetId: string) => ReturnType<typeof fetchTweetDetail>;
}

export interface RuntimeState {
  authPhase: AuthPhase;
  authState: SessionAuthState;
  sessionState: SessionState;
  capability: ApiCapability;
  activeAccountId: string | null;
  hasQueryId: boolean;
  authRetryDelayMs: number | null;
  bookmarksLoaded: boolean;
  detailedIdsLoaded: boolean;
  bookmarks: Bookmark[];
  detailedTweetIds: Set<string>;
  syncStatus: SyncStatus;
  syncJobKind: SyncJobKind;
  syncBlockedReason: SyncBlockedReason | null;
  bootPolicy: BootSyncPolicy;
  bootGeneration: number;
  syncGeneration: number;
  readerActive: boolean;
  prefetchStatus: "idle" | "running" | "paused";
  actions: RuntimeActions;
}

const SYNC_BLOCKED_REASONS = new Set<SyncBlockedReason>([
  "in_flight",
  "cooldown",
  "rate_limited",
  "no_account",
  "not_ready",
]);

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
    hasUser: snapshot.sessionState === "logged_in" && Boolean(snapshot.accountContextId),
    hasAuth: snapshot.sessionState === "logged_in",
    hasQueryId: bookmarksApi === "ready",
    authState:
      snapshot.sessionState === "logged_out"
        ? "logged_out"
        : snapshot.sessionState === "logged_in"
          ? "authenticated"
          : "stale",
    sessionState: snapshot.sessionState,
    userId: snapshot.sessionState === "logged_in" ? snapshot.accountContextId : null,
    accountContextId: snapshot.accountContextId,
    bookmarksApi,
    detailApi,
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
    (status.hasQueryId ? "ready" : status.hasAuth ? "blocked" : "unknown");
  const detailApi = status.capability?.detailApi ?? "unknown";

  return {
    hasUser: status.hasUser,
    hasAuth: status.hasAuth,
    hasQueryId: status.hasQueryId,
    authState,
    sessionState,
    userId: typeof status.userId === "string" && status.userId ? status.userId : null,
    accountContextId:
      typeof status.accountContextId === "string" && status.accountContextId
        ? status.accountContextId
        : null,
    bookmarksApi,
    detailApi,
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

function readBootPolicy(): BootSyncPolicy {
  try {
    const stored = localStorage.getItem(LS_BOOT_SYNC_POLICY);
    if (stored === "manual_only_until_seeded" || stored === "auto") {
      return stored;
    }

    if (localStorage.getItem(LS_MANUAL_SYNC_REQUIRED) === "1") {
      localStorage.setItem(LS_BOOT_SYNC_POLICY, "manual_only_until_seeded");
      localStorage.removeItem(LS_MANUAL_SYNC_REQUIRED);
      return "manual_only_until_seeded";
    }
  } catch {}

  return "auto";
}

function persistBootPolicy(policy: BootSyncPolicy): void {
  try {
    if (policy === "auto") {
      localStorage.removeItem(LS_BOOT_SYNC_POLICY);
    } else {
      localStorage.setItem(LS_BOOT_SYNC_POLICY, policy);
    }
    localStorage.removeItem(LS_MANUAL_SYNC_REQUIRED);
  } catch {}
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

  if (state.capability.bookmarksApi !== "ready") {
    return "online_blocked";
  }

  return "online_ready";
}

function shouldRestrictToCachedDetails(state: RuntimeState): boolean {
  return state.authPhase === "need_login" ||
    state.authPhase === "connecting" ||
    state.syncStatus === "reauthing";
}

function shouldAutoSync(state: RuntimeState): boolean {
  return state.bootPolicy === "auto" &&
    state.authPhase === "ready" &&
    state.capability.bookmarksApi === "ready";
}

function shouldResumeSeedSync(state: RuntimeState): boolean {
  return state.bootPolicy === "manual_only_until_seeded" &&
    state.bookmarks.length > 0 &&
    state.authPhase === "ready" &&
    state.capability.bookmarksApi === "ready";
}

function shouldSkipHydrationForLoggedOutReset(
  state: RuntimeState,
  phase: AuthPhase,
): boolean {
  return phase === "need_login" && state.bootPolicy === "manual_only_until_seeded";
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
    hasQueryId: false,
    authRetryDelayMs: null,
    bookmarksLoaded: false,
    detailedIdsLoaded: false,
    bookmarks: [],
    detailedTweetIds: EMPTY_SET,
    syncStatus: "loading",
    syncJobKind: "none",
    syncBlockedReason: null,
    bootPolicy: "auto",
    bootGeneration: 0,
    syncGeneration: 0,
    readerActive: false,
    prefetchStatus: "idle",
    actions,
  };
}

export function createRuntimeStore() {
  let activeSyncController: ActiveSyncController | null = null;
  let activeLease: ActiveSyncLease | null = null;
  let processingBookmarkEvents = false;
  let authRequestId = 0;
  let cleanupStarted = false;
  let resumedSeedSyncBootGeneration = -1;

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
            cleanupOldTweetDetails(DETAIL_CACHE_RETENTION_MS),
            chrome.storage.local.set({ [CS_DB_CLEANUP_AT]: Date.now() }),
          ]);
        } catch {}
      })().catch(() => {});
    };

    const maybeStartAutomaticSync = () => {
      const state = get();
      if (state.syncStatus === "syncing") return;

      if (shouldResumeSeedSync(state)) {
        if (resumedSeedSyncBootGeneration === state.bootGeneration) return;
        resumedSeedSyncBootGeneration = state.bootGeneration;
        void sync({
          trigger: "manual",
          requestedMode: "full",
        }).catch(() => {});
        return;
      }

      if (shouldAutoSync(state)) {
        void sync({ trigger: "auto" }).catch(() => {});
      }
    };

    const hydrateCurrentAccount = async (
      bootGeneration: number,
      allowAutoSync: boolean,
    ): Promise<void> => {
      const accountId = get().activeAccountId;
      setActiveAccountId(accountId);

      const [bookmarksResult, detailedIdsResult] = await Promise.allSettled([
        withTimeout(
          getAllBookmarks(),
          DB_INIT_TIMEOUT_MS,
          new Error("DB_INIT_TIMEOUT"),
        ),
        withTimeout(
          getDetailedTweetIds(),
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

      if (allowAutoSync) {
        maybeStartAutomaticSync();
      }

      if (get().authPhase === "ready") {
        void get().actions.handleBookmarkEvents().catch(() => {});
      }

      prefetchController.reconcile();
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
      const state = get();
      const nextAccountId =
        payload.sessionState === "logged_out" || payload.authState === "logged_out"
          ? state.activeAccountId || payload.accountContextId || null
          : payload.userId || payload.accountContextId || state.activeAccountId;

      let phase: AuthPhase;
      let sessionState: SessionState;
      let authRetryDelayMs: number | null = null;

      if (payload.sessionState === "logged_out" || payload.authState === "logged_out") {
        phase = "need_login";
        sessionState = "logged_out";
      } else if (payload.sessionState === "logged_in") {
        phase = "ready";
        sessionState = "logged_in";
        if (payload.bookmarksApi === "blocked") {
          authRetryDelayMs = AUTH_STALE_RECHECK_MS;
        }
      } else if (!payload.hasUser && !payload.hasAuth) {
        phase = "need_login";
        sessionState = "logged_out";
      } else {
        phase = "connecting";
        sessionState = payload.sessionState;
        authRetryDelayMs = AUTH_QUICK_CHECK_MS;
      }

      const accountChanged = nextAccountId !== state.activeAccountId;
      const skipHydrationForLoggedOutReset = shouldSkipHydrationForLoggedOutReset(state, phase);
      const needsHydration = options.allowHydration &&
        !skipHydrationForLoggedOutReset &&
        (accountChanged || !state.bookmarksLoaded || !state.detailedIdsLoaded);

      if (needsHydration) {
        stopSync();
        void releaseActiveLease("skipped");
      }

      const nextBootGeneration = needsHydration
        ? state.bootGeneration + 1
        : state.bootGeneration;

      setRuntimeState({
        authPhase: phase,
        authState: payload.authState,
        sessionState,
        capability: {
          bookmarksApi: payload.bookmarksApi,
          detailApi: payload.detailApi,
        },
        activeAccountId: nextAccountId,
        hasQueryId: payload.hasQueryId,
        authRetryDelayMs,
        bootGeneration: nextBootGeneration,
        bookmarksLoaded: skipHydrationForLoggedOutReset
          ? true
          : needsHydration
            ? false
            : state.bookmarksLoaded,
        detailedIdsLoaded: skipHydrationForLoggedOutReset
          ? true
          : needsHydration
            ? false
            : state.detailedIdsLoaded,
        bookmarks: skipHydrationForLoggedOutReset || needsHydration ? [] : state.bookmarks,
        detailedTweetIds:
          skipHydrationForLoggedOutReset || needsHydration
            ? new Set<string>()
            : state.detailedTweetIds,
        syncStatus:
          phase === "need_login" && state.syncStatus === "syncing"
            ? "idle"
            : state.syncStatus,
        syncJobKind:
          phase === "need_login" && state.syncStatus === "syncing"
            ? "none"
            : state.syncJobKind,
      });

      if (needsHydration) {
        await hydrateCurrentAccount(nextBootGeneration, options.allowAutoSync);
        return;
      }

      if (options.allowAutoSync) {
        maybeStartAutomaticSync();
      }

      prefetchController.reconcile();
    };

    const runAuthCheck = async (): Promise<void> => {
      const requestId = authRequestId + 1;
      authRequestId = requestId;

      try {
        const payload = await loadAuthPayload();
        if (requestId !== authRequestId) return;
        await applyAuthPayload(payload, {
          allowHydration: true,
          allowAutoSync: true,
        });
      } catch {
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
      }
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
      const requestedMode =
        options.requestedMode ?? (trigger === "manual" ? "quick" : undefined);
      const requestedModeForReservation =
        trigger === "manual" &&
          (startingLocalCount <= 0 || state.bootPolicy === "manual_only_until_seeded")
          ? "full"
          : requestedMode;

      const policy = await reserveSyncRun({
        accountId,
        trigger,
        localCount,
        requestedMode: requestedModeForReservation,
      }).catch(() => null);

      if (!policy) {
        if (trigger === "manual") {
          setRuntimeState({ syncBlockedReason: "not_ready" });
          return { accepted: false, reason: "not_ready" };
        }
        return { accepted: false, reason: "runtime_error" };
      }

      if (!policy.allow || !policy.mode || !policy.leaseId) {
        const blockedReason = SYNC_BLOCKED_REASONS.has(policy.reason as SyncBlockedReason)
          ? (policy.reason as SyncBlockedReason)
          : null;
        if (trigger === "manual") {
          setRuntimeState({
            syncBlockedReason: blockedReason || "not_ready",
          });
        }
        return {
          accepted: false,
          reason: blockedReason || policy.reason || "blocked",
          retryAfterMs: policy.retryAfterMs,
        };
      }

      const current = get();
      if (current.authPhase !== "ready" || current.capability.bookmarksApi !== "ready") {
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
      let seededPolicyCleared = false;
      const syncTimer = setTimeout(() => {
        abortSync(true);
      }, timeout);

      const maybeClearBootPolicy = () => {
        if (seededPolicyCleared) return;
        if (trigger !== "manual") return;
        if (get().bootPolicy !== "manual_only_until_seeded") return;
        persistBootPolicy("auto");
        seededPolicyCleared = true;
        setRuntimeState({ bootPolicy: "auto" });
      };

      const onPage = async (pageNew: Bookmark[]) => {
        if (abortState.aborted || get().syncGeneration !== syncGeneration) return;

        const currentBookmarks = get().bookmarks;
        const currentIds = new Set(currentBookmarks.map((bookmark) => bookmark.tweetId));
        const deduped = pageNew.filter((bookmark) => !currentIds.has(bookmark.tweetId));
        if (deduped.length === 0) return;

        const updated = [...currentBookmarks, ...deduped].toSorted(compareSortIndexDesc);

        setRuntimeState({
          bookmarks: updated,
          syncJobKind: updated.length > 0 ? "backfill" : get().syncJobKind,
        });

        try {
          await upsertBookmarks(deduped);
        } catch {}

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
        const firstPass = await runReconcilePass({
          maxPages: mode === "quick" ? SYNC_MAX_PAGES_PER_JOB : undefined,
          maxBookmarks: mode === "quick" ? SYNC_MAX_BOOKMARKS_PER_JOB : undefined,
        });

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

          if (!fullSyncCompleted) {
            completionErrorCode = "INCOMPLETE_FULL_SYNC";
            setRuntimeState({
              syncStatus: "error",
              syncJobKind: "none",
              syncBlockedReason: null,
            });
          } else {
            if (mode === "full" && reconcileResult.staleIds.length > 0) {
              await deleteBookmarksByTweetIds(reconcileResult.staleIds, {
                purgeHighlights: false,
              });
              const staleIds = new Set(reconcileResult.staleIds);
              setRuntimeState((state) => ({
                bookmarks: state.bookmarks.filter((bookmark) => !staleIds.has(bookmark.tweetId)),
              }));
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

            if (mode === "full" && reconcileResult.terminationReason === "complete") {
              maybeClearBootPolicy();
            }

            setRuntimeState({
              syncStatus: "idle",
              syncJobKind: "none",
              syncBlockedReason: null,
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
          try {
            await chrome.storage.local.set({ [CS_LAST_SYNC]: Date.now() });
          } catch {}
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
          bootPolicy: readBootPolicy(),
          authPhase: "loading",
          authRetryDelayMs: null,
          bookmarksLoaded: false,
          detailedIdsLoaded: false,
          syncStatus: "loading",
          syncJobKind: "none",
          syncBlockedReason: null,
        });

        maybeRunDbCleanup();

        try {
          const payload = await loadAuthPayload();
          if (get().bootGeneration !== bootGeneration) return;
          await applyAuthPayload(payload, {
            allowHydration: true,
            allowAutoSync: true,
          });
        } catch {
          if (get().bootGeneration !== bootGeneration) return;

          setRuntimeState({
            authPhase: "connecting",
            authRetryDelayMs: AUTH_RETRY_MS,
            bookmarksLoaded: true,
            detailedIdsLoaded: true,
            syncStatus: "idle",
          });
        }
      },

      dispose: () => {
        prefetchController.stop();
        stopSync();
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
        await runAuthCheck();
      },

      refresh: async () => sync({ trigger: "manual" }),

      handleBookmarkEvents: async () => {
        if (processingBookmarkEvents) return;
        if (get().authPhase !== "ready") return;

        processingBookmarkEvents = true;
        try {
          const events = await getBookmarkEvents();
          if (events.length === 0) return;

          const plan = resolveBookmarkEventPlan(events);
          const deleteEventIds = events
            .filter((event) => event.type === "DeleteBookmark")
            .map((event) => event.id);
          const createEventIds = events
            .filter((event) => event.type === "CreateBookmark")
            .map((event) => event.id);

          if (plan.idsToDelete.length > 0) {
            const toDelete = new Set(plan.idsToDelete);
            setRuntimeState((state) => ({
              bookmarks: state.bookmarks.filter((bookmark) => !toDelete.has(bookmark.tweetId)),
            }));

            await deleteBookmarksByTweetIds(plan.idsToDelete, {
              purgeHighlights: false,
            });
          }

          if (deleteEventIds.length > 0) {
            await ackBookmarkEvents(deleteEventIds);
          }

          let createFetchSucceeded = true;
          if (plan.needsPageFetch) {
            if (get().capability.bookmarksApi !== "ready") {
              createFetchSucceeded = false;
            } else {
              try {
                await new Promise((resolve) => setTimeout(resolve, CREATE_EVENT_DELAY_MS));
                const page = await fetchBookmarkPage(undefined, 20);
                const currentIds = new Set(get().bookmarks.map((bookmark) => bookmark.tweetId));
                const deduped = page.bookmarks.filter((bookmark) => !currentIds.has(bookmark.tweetId));
                if (deduped.length > 0) {
                  const updated = [...get().bookmarks, ...deduped].toSorted(compareSortIndexDesc);
                  setRuntimeState({ bookmarks: updated });
                  await upsertBookmarks(deduped);
                  prefetchController.reconcile();
                }
                await chrome.storage.local.set({ [CS_LAST_SOFT_SYNC]: Date.now() });
              } catch {
                createFetchSucceeded = false;
              }
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
        persistBootPolicy("manual_only_until_seeded");
        prefetchController.stop();
        stopSync();
        authRequestId += 1;
        setRuntimeState((state) => ({
          bootPolicy: "manual_only_until_seeded",
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

      bookmark: async (tweetId: string) => {
        if (!tweetId) {
          return { bookmark: null, createdOnX: false };
        }

        const queueCreateEvent = async () => {
          try {
            await queueBookmarkMutation("CreateBookmark", tweetId, {
              source: "extension-runtime",
              confirmed: true,
            });
          } catch {}
        };

        try {
          await createBookmark(tweetId);
        } catch (error) {
          return {
            bookmark: null,
            createdOnX: false,
            apiError: error instanceof Error ? error.message : "Unknown error",
          };
        }

        try {
          await new Promise((resolve) => setTimeout(resolve, CREATE_EVENT_DELAY_MS));
          const page = await fetchBookmarkPage(undefined, 20);
          const canonicalBookmark =
            page.bookmarks.find((bookmark) => bookmark.tweetId === tweetId) || null;

          await chrome.storage.local.set({ [CS_LAST_SOFT_SYNC]: Date.now() });

          if (!canonicalBookmark) {
            await queueCreateEvent();
            return { bookmark: null, createdOnX: true };
          }

          const nextByTweetId = new Map(
            get().bookmarks.map((bookmark) => [bookmark.tweetId, bookmark] as const),
          );
          nextByTweetId.set(canonicalBookmark.tweetId, canonicalBookmark);

          setRuntimeState({
            bookmarks: Array.from(nextByTweetId.values()).toSorted(compareSortIndexDesc),
          });

          try {
            await upsertBookmarks([canonicalBookmark]);
          } catch {}

          prefetchController.reconcile();
          return { bookmark: canonicalBookmark, createdOnX: true };
        } catch (error) {
          await queueCreateEvent();
          return {
            bookmark: null,
            createdOnX: true,
            apiError: error instanceof Error ? error.message : "Unknown error",
          };
        }
      },

      unbookmark: async (tweetId: string) => {
        if (!tweetId) return {};

        setRuntimeState((state) => ({
          bookmarks: state.bookmarks.filter((bookmark) => bookmark.tweetId !== tweetId),
        }));

        await deleteBookmarksByTweetIds([tweetId], {
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
        const detail = await fetchTweetDetail(tweetId);
        get().actions.detailCached(tweetId);
        prefetchController.reconcile();
        return detail;
      },
    };

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
  } else if (mode === "online_blocked") {
    title = "Preparing X API...";
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
  if (mode === "online_blocked" && !hasCurrentItem) return "preparing_sync";
  if (mode === "offline_empty") return "need_login";
  if (hasCurrentItem) return "bookmark_card";
  if (syncUiState.isBlocking) return "syncing_bootstrap";
  if (state.syncStatus === "error" || state.syncStatus === "reauthing") return "sync_error";
  if (mode === "offline_cached") return "empty_offline";
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
