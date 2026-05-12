import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  createHydrationStore,
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
  it("returns values within [1500, 3500]", () => {
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

describe("shouldLongPause", () => {
  it("never triggers on tick 0", () => {
    let triggered = false;
    for (let i = 0; i < 100; i++) {
      if (shouldLongPause(0)) triggered = true;
    }
    expect(triggered).toBe(false);
  });

  it("triggers for some ticks between 20-40", () => {
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

    await vi.advanceTimersByTimeAsync(10_000);

    expect(store.getState().status).toBe("done");
    expect(store.getState().processed).toBe(1);
    expect(deps.fetchDetail).toHaveBeenCalledWith("tweet-1");
    expect(deps.cacheDetail).toHaveBeenCalledWith("tweet-1", {});
    store.getState().dispose();
  });

  it("pauses on 429 for 15 minutes then resumes", async () => {
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

    await vi.advanceTimersByTimeAsync(RATE_LIMIT_PAUSE_MS + 15_000);
    expect(store.getState().status).toBe("done");
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
    await vi.advanceTimersByTimeAsync(10_000);

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

    await vi.advanceTimersByTimeAsync(120_000);

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
    await vi.advanceTimersByTimeAsync(10_000);

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
    await vi.advanceTimersByTimeAsync(60_000);

    expect(deps._snapshots.length).toBeGreaterThan(0);
    const lastSnapshot = deps._snapshots[deps._snapshots.length - 1];
    expect(lastSnapshot.status).toBe("done");
    store.getState().dispose();
  });

  it("does not start when lock is held by another tab", async () => {
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
    expect(store2.getState().status).toBe("idle");

    store1.getState().dispose();
    store2.getState().dispose();
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
    await vi.advanceTimersByTimeAsync(10_000);

    expect(deps.cacheUnavailable).toHaveBeenCalledWith("tweet-protected", "protected");
    expect(store.getState().unavailable).toBe(1);
    store.getState().dispose();
  });
});
