import { createStore } from "zustand/vanilla";
import { useStore } from "zustand";
import {
  findNextBookmarkNeedingHydration,
  countBookmarksNeedingHydration,
  upsertTweetDetailCache,
} from "../db";
import {
  tryAcquire,
  heartbeat,
  release,
  readLock,
  type LockStorage,
} from "../lib/hydration/lock";
import { CS_HYDRATION_SNAPSHOT } from "../lib/storage-keys";
import { parseTweetDetailPayload } from "../api/parsers";

export type HydrationStatus =
  | "idle"
  | "running"
  | "paused-429"
  | "paused-auth"
  | "paused-storage"
  | "done";

export interface HydrationSnapshot {
  status: HydrationStatus;
  total: number;
  processed: number;
  unavailable: number;
  pauseUntil: number;
  startedAt: number;
  updatedAt: number;
}

export interface HydrationState {
  status: HydrationStatus;
  total: number;
  processed: number;
  unavailable: number;
  pauseUntil: number;
  startedAt: number;
}

const BASE_DELAY_MIN = 1500;
const BASE_DELAY_MAX = 3500;
const LONG_PAUSE_MIN = 10_000;
const LONG_PAUSE_MAX = 30_000;
const LONG_PAUSE_INTERVAL_MIN = 20;
const LONG_PAUSE_INTERVAL_MAX = 40;
const RATE_LIMIT_PAUSE_MS = 15 * 60 * 1000;
const STORAGE_QUOTA_THRESHOLD = 0.95;
const STORAGE_CHECK_INTERVAL = 10;
const SNAPSHOT_WRITE_INTERVAL = 5;

export function jitteredDelay(): number {
  return BASE_DELAY_MIN + Math.random() * (BASE_DELAY_MAX - BASE_DELAY_MIN);
}

export function shouldLongPause(tickCount: number): boolean {
  if (tickCount === 0) return false;
  const interval =
    LONG_PAUSE_INTERVAL_MIN +
    Math.floor(Math.random() * (LONG_PAUSE_INTERVAL_MAX - LONG_PAUSE_INTERVAL_MIN + 1));
  return tickCount % interval === 0;
}

export function longPauseDelay(): number {
  return LONG_PAUSE_MIN + Math.random() * (LONG_PAUSE_MAX - LONG_PAUSE_MIN);
}

export function classifyError(code: string): {
  status: HydrationStatus;
  unavailableReason?: "deleted" | "protected" | "parse_failed" | "unknown";
} {
  if (code === "RATE_LIMITED") return { status: "paused-429" };
  if (code === "AUTH_EXPIRED" || code === "NO_AUTH") return { status: "paused-auth" };
  if (code === "DETAIL_NOT_FOUND") return { status: "running", unavailableReason: "deleted" };
  if (code.startsWith("DETAIL_ERROR_403")) return { status: "running", unavailableReason: "protected" };
  return { status: "running", unavailableReason: "unknown" };
}

export interface HydrationDeps {
  holderId: string;
  lockStorage: LockStorage;
  fetchDetail: (tweetId: string) => Promise<{ error?: string; data?: unknown }>;
  cacheDetail: (tweetId: string, data: unknown) => Promise<void>;
  cacheUnavailable: (
    tweetId: string,
    reason: "deleted" | "protected" | "parse_failed" | "unknown",
  ) => Promise<void>;
  findNext: () => Promise<string | null>;
  countNeeding: () => Promise<number>;
  writeSnapshot: (snapshot: HydrationSnapshot) => Promise<void>;
  readSnapshot: () => Promise<HydrationSnapshot | null>;
  estimateStorage: () => Promise<{ usage: number; quota: number }>;
  getAuthReady: () => boolean;
  subscribeAuth: (cb: (ready: boolean) => void) => () => void;
}

function defaultDeps(): HydrationDeps {
  const holderId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    holderId,
    lockStorage: {
      get: (key) => chrome.storage.session.get(key),
      set: (items) => chrome.storage.session.set(items),
      remove: (key) => chrome.storage.session.remove(key),
    },
    fetchDetail: (tweetId) =>
      chrome.runtime.sendMessage({ type: "FETCH_TWEET_DETAIL", tweetId }) as Promise<{
        error?: string;
        data?: unknown;
      }>,
    cacheDetail: async (tweetId, data) => {
      const detail = parseTweetDetailPayload(data, tweetId);
      await upsertTweetDetailCache({
        tweetId,
        fetchedAt: Date.now(),
        focalTweet: detail.focalTweet,
        thread: detail.thread,
        detailsStatus: "ok",
      });
    },
    cacheUnavailable: async (tweetId, reason) => {
      await upsertTweetDetailCache({
        tweetId,
        fetchedAt: Date.now(),
        focalTweet: null,
        thread: [],
        detailsStatus: "unavailable",
        unavailableReason: reason,
      });
    },
    findNext: findNextBookmarkNeedingHydration,
    countNeeding: countBookmarksNeedingHydration,
    writeSnapshot: async (snapshot) => {
      await chrome.storage.local.set({ [CS_HYDRATION_SNAPSHOT]: snapshot });
    },
    readSnapshot: async () => {
      const result = await chrome.storage.local.get(CS_HYDRATION_SNAPSHOT);
      return (result[CS_HYDRATION_SNAPSHOT] as HydrationSnapshot) ?? null;
    },
    estimateStorage: async () => {
      const est = await navigator.storage.estimate();
      return { usage: est.usage ?? 0, quota: est.quota ?? Infinity };
    },
    getAuthReady: () => false,
    subscribeAuth: () => () => {},
  };
}

const INITIAL_STATE: HydrationState = {
  status: "idle",
  total: 0,
  processed: 0,
  unavailable: 0,
  pauseUntil: 0,
  startedAt: 0,
};

export function createHydrationStore(deps: HydrationDeps = defaultDeps()) {
  let loopRunning = false;
  let loopAbort: AbortController | null = null;
  let pollTimerId: ReturnType<typeof setTimeout> | null = null;
  let unsubAuth: (() => void) | null = null;

  const store = createStore<
    HydrationState & {
      start: () => void;
      stop: () => void;
      reset: () => void;
      dispose: () => void;
      _runLoop: () => Promise<void>;
    }
  >((set, get) => ({
    ...INITIAL_STATE,

    start: () => {
      if (loopRunning) return;
      const state = get();
      if (state.status === "done") return;

      loopAbort = new AbortController();
      set({
        status: "running",
        startedAt: state.startedAt || Date.now(),
        pauseUntil: 0,
      });
      get()._runLoop();
    },

    stop: () => {
      loopAbort?.abort();
      loopAbort = null;
      loopRunning = false;
      set({ status: "idle", pauseUntil: 0 });
      release(deps.holderId, deps.lockStorage).catch(() => {});
      writeSnapshotFromState(get());
    },

    reset: () => {
      get().stop();
      set({ ...INITIAL_STATE });
      deps.writeSnapshot({
        ...INITIAL_STATE,
        updatedAt: Date.now(),
      }).catch(() => {});
    },

    dispose: () => {
      get().stop();
      if (pollTimerId !== null) {
        clearTimeout(pollTimerId);
        pollTimerId = null;
      }
      unsubAuth?.();
      unsubAuth = null;
    },

    _runLoop: async () => {
      if (loopRunning) return;
      loopRunning = true;
      const signal = loopAbort?.signal;

      try {
        const acquired = await tryAcquire(deps.holderId, deps.lockStorage);
        if (!acquired) {
          loopRunning = false;
          set({ status: "idle" });
          startLockPolling();
          return;
        }

        const total = await deps.countNeeding();
        if (total === 0) {
          set({ status: "done", total: 0 });
          loopRunning = false;
          await release(deps.holderId, deps.lockStorage);
          writeSnapshotFromState(get());
          return;
        }
        set({ total });

        let tickCount = 0;
        let snapshotCounter = 0;

        while (!signal?.aborted) {
          if (!deps.getAuthReady()) {
            set({ status: "paused-auth" });
            writeSnapshotFromState(get());
            loopRunning = false;
            return;
          }

          if (tickCount > 0 && tickCount % STORAGE_CHECK_INTERVAL === 0) {
            try {
              const { usage, quota } = await deps.estimateStorage();
              if (quota > 0 && usage / quota > STORAGE_QUOTA_THRESHOLD) {
                set({ status: "paused-storage" });
                loopRunning = false;
                await release(deps.holderId, deps.lockStorage);
                writeSnapshotFromState(get());
                return;
              }
            } catch {
              // ignore estimate failures
            }
          }

          const tweetId = await deps.findNext();
          if (!tweetId) {
            const remaining = await deps.countNeeding();
            set({ status: "done", total: remaining });
            loopRunning = false;
            await release(deps.holderId, deps.lockStorage);
            writeSnapshotFromState(get());
            return;
          }

          try {
            const response = await deps.fetchDetail(tweetId);

            if (signal?.aborted) break;

            if (response.error) {
              const classified = classifyError(response.error);

              if (classified.unavailableReason) {
                await deps.cacheUnavailable(tweetId, classified.unavailableReason);
                set((s) => ({
                  processed: s.processed + 1,
                  unavailable: s.unavailable + 1,
                }));
              } else if (classified.status === "paused-429") {
                const pauseUntil = Date.now() + RATE_LIMIT_PAUSE_MS;
                set({ status: "paused-429", pauseUntil });
                writeSnapshotFromState(get());
                await heartbeat(deps.holderId, deps.lockStorage);
                await sleep(RATE_LIMIT_PAUSE_MS, signal);
                if (signal?.aborted) break;
                set({ status: "running", pauseUntil: 0 });
              } else if (classified.status === "paused-auth") {
                set({ status: "paused-auth" });
                loopRunning = false;
                writeSnapshotFromState(get());
                return;
              }
            } else {
              await deps.cacheDetail(tweetId, response.data);
              set((s) => ({ processed: s.processed + 1 }));
            }
          } catch {
            // Transport error — skip this tweet, retry on next loop iteration
          }

          tickCount++;

          await heartbeat(deps.holderId, deps.lockStorage);

          snapshotCounter++;
          if (snapshotCounter >= SNAPSHOT_WRITE_INTERVAL) {
            const updatedTotal = await deps.countNeeding();
            set({ total: updatedTotal });
            writeSnapshotFromState(get());
            snapshotCounter = 0;
          }

          if (signal?.aborted) break;

          let delay = jitteredDelay();
          if (shouldLongPause(tickCount)) {
            delay += longPauseDelay();
          }
          await sleep(delay, signal);
        }
      } finally {
        loopRunning = false;
      }
    },
  }));

  function writeSnapshotFromState(state: HydrationState) {
    deps
      .writeSnapshot({
        status: state.status,
        total: state.total,
        processed: state.processed,
        unavailable: state.unavailable,
        pauseUntil: state.pauseUntil,
        startedAt: state.startedAt,
        updatedAt: Date.now(),
      })
      .catch(() => {});
  }

  function startLockPolling() {
    if (pollTimerId !== null) return;
    pollTimerId = setTimeout(async () => {
      pollTimerId = null;
      const lock = await readLock(deps.lockStorage).catch(() => null);
      if (!lock || Date.now() - lock.lastTickAt >= 60_000) {
        store.getState().start();
      } else {
        startLockPolling();
      }
    }, 5000);
  }

  unsubAuth = deps.subscribeAuth((ready) => {
    const state = store.getState();
    if (ready && state.status === "paused-auth") {
      state.start();
    } else if (!ready && state.status === "running") {
      store.setState({ status: "paused-auth" });
    }
  });

  return store;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }
    const id = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(id);
      resolve();
    }, { once: true });
  });
}

let _defaultStore: ReturnType<typeof createHydrationStore> | null = null;

export function getHydrationStore() {
  if (!_defaultStore) {
    _defaultStore = createHydrationStore();
  }
  return _defaultStore;
}

export function useHydrationStore<T>(selector: (state: HydrationState) => T): T {
  return useStore(getHydrationStore(), selector as never) as T;
}

export { RATE_LIMIT_PAUSE_MS, STORAGE_QUOTA_THRESHOLD, BASE_DELAY_MIN, BASE_DELAY_MAX };
