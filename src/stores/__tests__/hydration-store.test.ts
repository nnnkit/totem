import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  classifyError,
  createHydrationStore,
  estimateHydrationDurationMs,
  jitteredDelay,
  shouldLongPause,
  type HydrationDeps,
  type HydrationSnapshot,
  RATE_LIMIT_PAUSE_MS,
  BASE_DELAY_MIN,
  BASE_DELAY_MAX,
} from "../hydration-store";
import type { LockStorage } from "../../lib/hydration/lock";

function createFakeLockStorage(): LockStorage & { data: Record<string, unknown> } {
  const data: Record<string, unknown> = {};
  return {
    data,
    get: vi.fn(async (key: string) => ({ [key]: data[key] })),
    set: vi.fn(async (items: Record<string, unknown>) => {
      Object.assign(data, items);
    }),
    remove: vi.fn(async (key: string) => {
      delete data[key];
    }),
  };
}

interface TestDeps extends HydrationDeps {
  _setAuthReady: (ready: boolean) => void;
  _snapshots: HydrationSnapshot[];
}

function createTestDeps(overrides: Partial<HydrationDeps> = {}): TestDeps {
  const snapshots: HydrationSnapshot[] = [];
  let authReady = true;
  let authCb: ((ready: boolean) => void) | null = null;

  return {
    holderId: "test-tab",
    lockStorage: createFakeLockStorage(),
    fetchDetail: vi.fn(async () => ({ data: {} })),
    cacheDetail: vi.fn(async () => {}),
    cacheUnavailable: vi.fn(async () => {}),
    findNext: vi.fn(async () => null),
    countNeeding: vi.fn(async () => 0),
    writeSnapshot: vi.fn(async (s: HydrationSnapshot) => {
      snapshots.push(s);
    }),
    readSnapshot: vi.fn(async () => snapshots[snapshots.length - 1] ?? null),
    estimateStorage: vi.fn(async () => ({ usage: 100, quota: 1000 })),
    getAuthReady: () => authReady,
    subscribeAuth: (cb: (ready: boolean) => void) => {
      authCb = cb;
      return () => { authCb = null; };
    },
    ...overrides,
    _setAuthReady: (ready: boolean) => {
      authReady = ready;
      authCb?.(ready);
    },
    _snapshots: snapshots,
  };
}

describe("jitteredDelay", () => {
  it("returns values within the conservative hydration cadence range", () => {
    const samples = Array.from({ length: 200 }, () => jitteredDelay());
    for (const d of samples) {
      expect(d).toBeGreaterThanOrEqual(BASE_DELAY_MIN);
      expect(d).toBeLessThanOrEqual(BASE_DELAY_MAX);
    }
  });

  it("has variance (not constant)", () => {
    const samples = Array.from({ length: 50 }, () => jitteredDelay());
    const unique = new Set(samples.map((d) => Math.round(d / 100)));
    expect(unique.size).toBeGreaterThan(3);
  });
});

describe("estimateHydrationDurationMs", () => {
  it("uses the throttled cadence estimate for full export copy", () => {
    expect(estimateHydrationDurationMs(0)).toBe(0);
    expect(estimateHydrationDurationMs(10)).toBeGreaterThan(60_000);
  });
});

describe("shouldLongPause", () => {
  it("never triggers on tick 0", () => {
    let triggered = false;
    for (let i = 0; i < 100; i++) {
      if (shouldLongPause(0)) triggered = true;
    }
    expect(triggered).toBe(false);
  });

  it("triggers for some ticks in the configured long-pause range", () => {
    let triggeredAny = false;
    for (let tick = 1; tick <= 100; tick++) {
      for (let trial = 0; trial < 50; trial++) {
        if (shouldLongPause(tick)) {
          triggeredAny = true;
          break;
        }
      }
      if (triggeredAny) break;
    }
    expect(triggeredAny).toBe(true);
  });
});

describe("classifyError", () => {
  it("pauses on detail API rate limits", () => {
    expect(classifyError("DETAIL_ERROR_429")).toMatchObject({
      status: "paused-429",
    });
    expect(classifyError("DETAIL_ERROR_429: too many requests")).toMatchObject({
      status: "paused-429",
    });
  });

  it("keeps transient detail failures retryable", () => {
    expect(classifyError("DETAIL_ERROR_500")).toMatchObject({
      status: "running",
      retryable: true,
    });
    expect(classifyError("DETAIL_ERROR_503: upstream unavailable")).toMatchObject({
      status: "running",
      retryable: true,
    });
    expect(classifyError("DETAIL_ERROR_418")).toMatchObject({
      status: "running",
      retryable: true,
    });
  });
});

describe("HydrationStore", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts in idle state", () => {
    const deps = createTestDeps();
    const store = createHydrationStore(deps);
    expect(store.getState().status).toBe("idle");
    store.getState().dispose();
  });

  it("transitions to done when no bookmarks need hydration", async () => {
    const deps = createTestDeps();
    (deps.countNeeding as ReturnType<typeof vi.fn>).mockResolvedValue(0);
    const store = createHydrationStore(deps);

    store.getState().start();
    await vi.advanceTimersByTimeAsync(100);

    expect(store.getState().status).toBe("done");
    store.getState().dispose();
  });

  it("can start again from done when new bookmarks need hydration", async () => {
    const deps = createTestDeps();
    let callCount = 0;
    (deps.findNext as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      callCount++;
      return callCount <= 1 ? "tweet-new" : null;
    });
    (deps.countNeeding as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(1)
      .mockResolvedValue(0);

    const store = createHydrationStore(deps);
    store.setState({
      status: "done",
      total: 0,
      processed: 3,
      unavailable: 1,
      pauseUntil: 0,
      startedAt: 123,
    });

    store.getState().start();
    await vi.advanceTimersByTimeAsync(30_000);

    expect(deps.fetchDetail).toHaveBeenCalledWith("tweet-new");
    expect(store.getState()).toMatchObject({
      status: "done",
      processed: 1,
      unavailable: 0,
    });
    expect(store.getState().startedAt).not.toBe(123);
    store.getState().dispose();
  });

  it("processes a single bookmark and reaches done", async () => {
    const deps = createTestDeps();
    let callCount = 0;
    (deps.findNext as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      callCount++;
      return callCount <= 1 ? "tweet-1" : null;
    });
    (deps.countNeeding as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(1)
      .mockResolvedValue(0);

    const store = createHydrationStore(deps);
    store.getState().start();

    await vi.advanceTimersByTimeAsync(30_000);

    expect(store.getState().status).toBe("done");
    expect(store.getState().processed).toBe(1);
    expect(deps.fetchDetail).toHaveBeenCalledWith("tweet-1");
    expect(deps.cacheDetail).toHaveBeenCalledWith("tweet-1", {});
    store.getState().dispose();
  });

  it("pauses on 429 for the configured backoff then resumes", async () => {
    const deps = createTestDeps();
    let callCount = 0;
    (deps.findNext as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      callCount++;
      return callCount <= 2 ? `tweet-${callCount}` : null;
    });
    (deps.countNeeding as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(2)
      .mockResolvedValue(0);
    (deps.fetchDetail as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ error: "RATE_LIMITED" })
      .mockResolvedValue({ data: {} });

    const store = createHydrationStore(deps);
    store.getState().start();

    await vi.advanceTimersByTimeAsync(500);
    expect(store.getState().status).toBe("paused-429");
    expect(store.getState().pauseUntil).toBeGreaterThan(0);

    await vi.advanceTimersByTimeAsync(RATE_LIMIT_PAUSE_MS + 40_000);
    expect(store.getState().status).toBe("done");
    store.getState().dispose();
  });

  it("pauses on detail 429 without caching unavailable", async () => {
    const deps = createTestDeps();
    (deps.findNext as ReturnType<typeof vi.fn>).mockResolvedValue("tweet-1");
    (deps.countNeeding as ReturnType<typeof vi.fn>).mockResolvedValue(1);
    (deps.fetchDetail as ReturnType<typeof vi.fn>).mockResolvedValue({
      error: "DETAIL_ERROR_429: too many requests",
    });

    const store = createHydrationStore(deps);
    store.getState().start();
    await vi.advanceTimersByTimeAsync(500);

    expect(store.getState().status).toBe("paused-429");
    expect(deps.cacheUnavailable).not.toHaveBeenCalled();
    expect(store.getState().processed).toBe(0);
    store.getState().dispose();
  });

  it("leaves transient detail errors uncached so they can retry", async () => {
    const deps = createTestDeps();
    (deps.findNext as ReturnType<typeof vi.fn>).mockResolvedValue("tweet-1");
    (deps.countNeeding as ReturnType<typeof vi.fn>).mockResolvedValue(1);
    (deps.fetchDetail as ReturnType<typeof vi.fn>).mockResolvedValue({
      error: "DETAIL_ERROR_500",
    });

    const store = createHydrationStore(deps);
    store.getState().start();
    await vi.advanceTimersByTimeAsync(500);

    expect(deps.cacheUnavailable).not.toHaveBeenCalled();
    expect(deps.cacheDetail).not.toHaveBeenCalled();
    expect(store.getState().processed).toBe(0);
    expect(store.getState().unavailable).toBe(0);
    store.getState().dispose();
  });

  it("pauses on auth error", async () => {
    const deps = createTestDeps();
    (deps.findNext as ReturnType<typeof vi.fn>).mockResolvedValue("tweet-1");
    (deps.countNeeding as ReturnType<typeof vi.fn>).mockResolvedValue(1);
    (deps.fetchDetail as ReturnType<typeof vi.fn>).mockResolvedValue({
      error: "AUTH_EXPIRED",
    });

    const store = createHydrationStore(deps);
    store.getState().start();
    await vi.advanceTimersByTimeAsync(500);

    expect(store.getState().status).toBe("paused-auth");
    store.getState().dispose();
  });

  it("resumes from auth pause when auth becomes ready", async () => {
    const deps = createTestDeps();
    let fetchCount = 0;
    (deps.findNext as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      fetchCount++;
      return fetchCount <= 2 ? `tweet-${fetchCount}` : null;
    });
    (deps.countNeeding as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1)
      .mockResolvedValue(0);
    (deps.fetchDetail as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ error: "AUTH_EXPIRED" })
      .mockResolvedValue({ data: {} });

    const store = createHydrationStore(deps);
    store.getState().start();
    await vi.advanceTimersByTimeAsync(500);

    expect(store.getState().status).toBe("paused-auth");

    deps._setAuthReady(true);
    await vi.advanceTimersByTimeAsync(30_000);

    expect(store.getState().status).toBe("done");
    store.getState().dispose();
  });

  it("pauses on storage quota exceeded", async () => {
    const deps = createTestDeps();
    let tickCount = 0;
    (deps.findNext as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      tickCount++;
      return `tweet-${tickCount}`;
    });
    (deps.countNeeding as ReturnType<typeof vi.fn>).mockResolvedValue(100);
    (deps.fetchDetail as ReturnType<typeof vi.fn>).mockResolvedValue({ data: {} });
    (deps.estimateStorage as ReturnType<typeof vi.fn>).mockResolvedValue({
      usage: 960,
      quota: 1000,
    });

    const store = createHydrationStore(deps);
    store.getState().start();

    await vi.advanceTimersByTimeAsync(140_000);

    expect(store.getState().status).toBe("paused-storage");
    store.getState().dispose();
  });

  it("handles DETAIL_NOT_FOUND as unavailable", async () => {
    const deps = createTestDeps();
    let callCount = 0;
    (deps.findNext as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      callCount++;
      return callCount <= 1 ? "tweet-deleted" : null;
    });
    (deps.countNeeding as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(1)
      .mockResolvedValue(0);
    (deps.fetchDetail as ReturnType<typeof vi.fn>).mockResolvedValue({
      error: "DETAIL_NOT_FOUND",
    });

    const store = createHydrationStore(deps);
    store.getState().start();
    await vi.advanceTimersByTimeAsync(30_000);

    expect(store.getState().unavailable).toBe(1);
    expect(store.getState().processed).toBe(1);
    expect(store.getState().status).toBe("done");
    expect(deps.cacheUnavailable).toHaveBeenCalledWith("tweet-deleted", "deleted");
    store.getState().dispose();
  });

  it("stop releases lock and sets idle", async () => {
    const deps = createTestDeps();
    (deps.findNext as ReturnType<typeof vi.fn>).mockResolvedValue("tweet-1");
    (deps.countNeeding as ReturnType<typeof vi.fn>).mockResolvedValue(10);
    (deps.fetchDetail as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise((r) => setTimeout(() => r({ data: {} }), 100)),
    );

    const store = createHydrationStore(deps);
    store.getState().start();
    await vi.advanceTimersByTimeAsync(500);

    store.getState().stop();
    expect(store.getState().status).toBe("idle");
    store.getState().dispose();
  });

  it("writes snapshots during processing", async () => {
    const deps = createTestDeps();
    let callCount = 0;
    (deps.findNext as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      callCount++;
      return callCount <= 6 ? `tweet-${callCount}` : null;
    });
    (deps.countNeeding as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(6)
      .mockResolvedValue(0);

    const store = createHydrationStore(deps);
    store.getState().start();
    await vi.advanceTimersByTimeAsync(90_000);

    expect(deps._snapshots.length).toBeGreaterThan(0);
    const lastSnapshot = deps._snapshots[deps._snapshots.length - 1];
    expect(lastSnapshot.status).toBe("done");
    store.getState().dispose();
  });

  it("keeps progress visible while waiting on another tab lock", async () => {
    const sharedStorage = createFakeLockStorage();
    const deps1 = createTestDeps({ lockStorage: sharedStorage, holderId: "tab-1" });
    const deps2 = createTestDeps({ lockStorage: sharedStorage, holderId: "tab-2" });

    (deps1.findNext as ReturnType<typeof vi.fn>).mockResolvedValue("tweet-1");
    (deps1.countNeeding as ReturnType<typeof vi.fn>).mockResolvedValue(10);
    (deps1.fetchDetail as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise((r) => setTimeout(() => r({ data: {} }), 100)),
    );

    (deps2.findNext as ReturnType<typeof vi.fn>).mockResolvedValue("tweet-1");
    (deps2.countNeeding as ReturnType<typeof vi.fn>).mockResolvedValue(10);

    const store1 = createHydrationStore(deps1);
    const store2 = createHydrationStore(deps2);

    store1.getState().start();
    await vi.advanceTimersByTimeAsync(200);
    expect(store1.getState().status).toBe("running");

    store2.getState().start();
    await vi.advanceTimersByTimeAsync(200);
    expect(store2.getState().status).toBe("running");
    expect(deps2.fetchDetail).not.toHaveBeenCalled();

    store1.getState().dispose();
    store2.getState().dispose();
  });

  it("stop clears lock polling so cancellation does not restart hydration", async () => {
    const sharedStorage = createFakeLockStorage();
    const deps1 = createTestDeps({ lockStorage: sharedStorage, holderId: "tab-1" });
    const deps2 = createTestDeps({ lockStorage: sharedStorage, holderId: "tab-2" });

    (deps1.findNext as ReturnType<typeof vi.fn>).mockResolvedValue("tweet-1");
    (deps1.countNeeding as ReturnType<typeof vi.fn>).mockResolvedValue(10);
    (deps1.fetchDetail as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise((r) => setTimeout(() => r({ data: {} }), 1000)),
    );

    (deps2.findNext as ReturnType<typeof vi.fn>).mockResolvedValue("tweet-2");
    (deps2.countNeeding as ReturnType<typeof vi.fn>).mockResolvedValue(10);

    const store1 = createHydrationStore(deps1);
    const store2 = createHydrationStore(deps2);

    store1.getState().start();
    await vi.advanceTimersByTimeAsync(200);

    store2.getState().start();
    await vi.advanceTimersByTimeAsync(200);
    expect(deps2.fetchDetail).not.toHaveBeenCalled();

    store2.getState().stop();
    store1.getState().dispose();
    await vi.advanceTimersByTimeAsync(6000);

    expect(store2.getState().status).toBe("idle");
    expect(deps2.fetchDetail).not.toHaveBeenCalled();
    store2.getState().dispose();
  });

  it("stop clears restored rate-limit resume timers", async () => {
    const deps = createTestDeps({
      readSnapshot: vi.fn(async () => ({
        status: "paused-429" as const,
        total: 1,
        processed: 0,
        unavailable: 0,
        pauseUntil: Date.now() + 1000,
        startedAt: 123,
        updatedAt: 456,
      })),
    });
    (deps.findNext as ReturnType<typeof vi.fn>).mockResolvedValue("tweet-1");
    (deps.countNeeding as ReturnType<typeof vi.fn>).mockResolvedValue(1);

    const store = createHydrationStore(deps);
    await vi.advanceTimersByTimeAsync(0);
    expect(store.getState().status).toBe("paused-429");

    store.getState().stop();
    await vi.advanceTimersByTimeAsync(2000);

    expect(store.getState().status).toBe("idle");
    expect(deps.fetchDetail).not.toHaveBeenCalled();
    store.getState().dispose();
  });

  it("restores a running snapshot without double-counting processed rows after refresh", async () => {
    const deps = createTestDeps({
      readSnapshot: vi.fn(async () => ({
        status: "running" as const,
        total: 10,
        processed: 4,
        unavailable: 1,
        pauseUntil: 0,
        startedAt: 123,
        updatedAt: 456,
      })),
    });
    deps._setAuthReady(false);

    const store = createHydrationStore(deps);
    await vi.advanceTimersByTimeAsync(0);

    expect(store.getState()).toMatchObject({
      status: "running",
      total: 10,
      processed: 0,
      unavailable: 1,
      startedAt: 123,
    });
    expect(deps.fetchDetail).not.toHaveBeenCalled();

    store.getState().dispose();
  });

  it("resumes a restored running snapshot when auth becomes ready", async () => {
    const deps = createTestDeps({
      readSnapshot: vi.fn(async () => ({
        status: "running" as const,
        total: 1,
        processed: 0,
        unavailable: 0,
        pauseUntil: 0,
        startedAt: 123,
        updatedAt: 456,
      })),
    });
    deps._setAuthReady(false);
    let callCount = 0;
    (deps.findNext as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      callCount++;
      return callCount <= 1 ? "tweet-1" : null;
    });
    (deps.countNeeding as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(1)
      .mockResolvedValue(0);

    const store = createHydrationStore(deps);
    await vi.advanceTimersByTimeAsync(0);
    expect(deps.fetchDetail).not.toHaveBeenCalled();

    deps._setAuthReady(true);
    await vi.advanceTimersByTimeAsync(20_000);

    expect(deps.fetchDetail).toHaveBeenCalledWith("tweet-1");
    expect(store.getState().status).toBe("done");
    store.getState().dispose();
  });

  it("handles auth check during loop — pauses when not ready", async () => {
    const deps = createTestDeps();
    let callCount = 0;
    (deps.findNext as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      callCount++;
      if (callCount === 2) deps._setAuthReady(false);
      return callCount <= 3 ? `tweet-${callCount}` : null;
    });
    (deps.countNeeding as ReturnType<typeof vi.fn>).mockResolvedValue(3);

    const store = createHydrationStore(deps);
    store.getState().start();
    await vi.advanceTimersByTimeAsync(30_000);

    expect(store.getState().status).toBe("paused-auth");
    store.getState().dispose();
  });

  it("classifies 403 errors as protected", async () => {
    const deps = createTestDeps();
    let callCount = 0;
    (deps.findNext as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      callCount++;
      return callCount <= 1 ? "tweet-protected" : null;
    });
    (deps.countNeeding as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(1)
      .mockResolvedValue(0);
    (deps.fetchDetail as ReturnType<typeof vi.fn>).mockResolvedValue({
      error: "DETAIL_ERROR_403",
    });

    const store = createHydrationStore(deps);
    store.getState().start();
    await vi.advanceTimersByTimeAsync(30_000);

    expect(deps.cacheUnavailable).toHaveBeenCalledWith("tweet-protected", "protected");
    expect(store.getState().unavailable).toBe(1);
    store.getState().dispose();
  });
});
