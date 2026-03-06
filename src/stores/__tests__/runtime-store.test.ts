import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createRuntimeStore,
  selectDisplayBookmarks,
  selectRuntimeMode,
} from "../runtime-store";
import type { Bookmark, RuntimeSnapshot } from "../../types";
import { LS_BOOT_SYNC_POLICY } from "../../lib/storage-keys";
import type { RuntimeState } from "../runtime-store";

const mocks = vi.hoisted(() => ({
  getRuntimeSnapshot: vi.fn<() => Promise<RuntimeSnapshot>>(),
  checkAuth: vi.fn(),
  deleteBookmark: vi.fn(),
  fetchBookmarkPage: vi.fn(),
  getBookmarkEvents: vi.fn(),
  ackBookmarkEvents: vi.fn(),
  fetchTweetDetail: vi.fn(),
  reserveSyncRun: vi.fn(),
  completeSyncRun: vi.fn(),
  cleanupOldTweetDetails: vi.fn(),
  deleteBookmarksByTweetIds: vi.fn(),
  getAllBookmarks: vi.fn<() => Promise<Bookmark[]>>(),
  getCompletedTweetIds: vi.fn(),
  getDetailedTweetIds: vi.fn<() => Promise<Set<string>>>(),
  setActiveAccountId: vi.fn(),
  upsertBookmarks: vi.fn(),
}));

vi.mock("../../api/core/auth", () => ({
  checkAuth: mocks.checkAuth,
  getRuntimeSnapshot: mocks.getRuntimeSnapshot,
}));

vi.mock("../../api/core/bookmarks", () => ({
  ackBookmarkEvents: mocks.ackBookmarkEvents,
  deleteBookmark: mocks.deleteBookmark,
  fetchBookmarkPage: mocks.fetchBookmarkPage,
  getBookmarkEvents: mocks.getBookmarkEvents,
}));

vi.mock("../../api/core/posts", () => ({
  fetchTweetDetail: mocks.fetchTweetDetail,
}));

vi.mock("../../api/core/sync", () => ({
  completeSyncRun: mocks.completeSyncRun,
  reserveSyncRun: mocks.reserveSyncRun,
}));

vi.mock("../../db", () => ({
  cleanupOldTweetDetails: mocks.cleanupOldTweetDetails,
  deleteBookmarksByTweetIds: mocks.deleteBookmarksByTweetIds,
  getAllBookmarks: mocks.getAllBookmarks,
  getCompletedTweetIds: mocks.getCompletedTweetIds,
  getDetailedTweetIds: mocks.getDetailedTweetIds,
  setActiveAccountId: mocks.setActiveAccountId,
  upsertBookmarks: mocks.upsertBookmarks,
}));

function createBookmark(tweetId: string): Bookmark {
  return {
    id: tweetId,
    tweetId,
    text: `Tweet ${tweetId}`,
    createdAt: 1,
    sortIndex: tweetId,
    author: {
      name: "Author",
      screenName: "author",
      profileImageUrl: "https://example.com/avatar.png",
      verified: false,
    },
    metrics: {
      likes: 0,
      retweets: 0,
      replies: 0,
      views: 0,
      bookmarks: 0,
    },
    media: [],
    urls: [],
    isThread: false,
    hasImage: false,
    hasVideo: false,
    hasLink: false,
    quotedTweet: null,
  };
}

function runtimeSnapshot(overrides: Partial<RuntimeSnapshot> = {}): RuntimeSnapshot {
  return {
    sessionState: "logged_out",
    authPhase: "need_login",
    accountContextId: "acct-1",
    capability: {
      bookmarksApi: "unknown",
      detailApi: "unknown",
    },
    syncPolicy: {
      accountKey: "acct-1",
      inFlight: null,
      lastAttemptAt: 0,
      lastSuccessAt: 0,
      blockedReason: null,
    },
    blockedReason: null,
    cacheSummary: {
      lastSyncAt: 0,
      lastSoftSyncAt: 0,
      lightSyncNeededAt: 0,
      pendingBookmarkEventCount: 0,
    },
    ...overrides,
  };
}

function createLocalStorageMock() {
  const storage = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => storage.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      storage.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      storage.delete(key);
    }),
    clear: vi.fn(() => {
      storage.clear();
    }),
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("localStorage", createLocalStorageMock());
  vi.stubGlobal("chrome", {
    storage: {
      local: {
        get: vi.fn(async () => ({})),
        set: vi.fn(async () => {}),
        remove: vi.fn(async () => {}),
        onChanged: {
          addListener: vi.fn(),
          removeListener: vi.fn(),
        },
      },
    },
  });

  mocks.getRuntimeSnapshot.mockResolvedValue(runtimeSnapshot());
  mocks.checkAuth.mockResolvedValue({
    hasUser: false,
    hasAuth: false,
    hasQueryId: false,
    userId: null,
    accountContextId: "acct-1",
    authState: "logged_out",
    sessionState: "logged_out",
    capability: {
      bookmarksApi: "unknown",
      detailApi: "unknown",
    },
  });
  mocks.deleteBookmark.mockResolvedValue(undefined);
  mocks.fetchBookmarkPage.mockResolvedValue({ bookmarks: [], cursor: null, stopOnEmptyResponse: true });
  mocks.getBookmarkEvents.mockResolvedValue([]);
  mocks.ackBookmarkEvents.mockResolvedValue(undefined);
  mocks.fetchTweetDetail.mockResolvedValue({ focalTweet: null, thread: [] });
  mocks.reserveSyncRun.mockResolvedValue({
    allow: false,
    mode: null,
    reason: "not_ready",
  });
  mocks.completeSyncRun.mockResolvedValue(undefined);
  mocks.cleanupOldTweetDetails.mockResolvedValue(0);
  mocks.deleteBookmarksByTweetIds.mockResolvedValue(undefined);
  mocks.getAllBookmarks.mockResolvedValue([]);
  mocks.getCompletedTweetIds.mockResolvedValue(new Set<string>());
  mocks.getDetailedTweetIds.mockResolvedValue(new Set<string>());
  mocks.setActiveAccountId.mockImplementation(() => "totem_acct_acct-1");
  mocks.upsertBookmarks.mockResolvedValue(undefined);
});

describe("runtime-store boot", () => {
  it("settles to offline_empty when logged out and the cache is empty", async () => {
    const store = createRuntimeStore();

    await store.getState().actions.boot();

    const state = store.getState();
    expect(state.authPhase).toBe("need_login");
    expect(state.bookmarksLoaded).toBe(true);
    expect(state.detailedIdsLoaded).toBe(true);
    expect(selectRuntimeMode(state)).toBe("offline_empty");
    expect(selectDisplayBookmarks(state)).toEqual([]);
  });

  it("skips hydration after reset when logged out and manual sync is required", async () => {
    localStorage.setItem(LS_BOOT_SYNC_POLICY, "manual_only_until_seeded");

    const store = createRuntimeStore();
    await store.getState().actions.boot();

    const state = store.getState();
    expect(selectRuntimeMode(state)).toBe("offline_empty");
    expect(state.bookmarksLoaded).toBe(true);
    expect(state.detailedIdsLoaded).toBe(true);
    expect(state.bookmarks).toEqual([]);
    expect(state.detailedTweetIds).toEqual(new Set());
    expect(mocks.getAllBookmarks).not.toHaveBeenCalled();
    expect(mocks.getDetailedTweetIds).not.toHaveBeenCalled();
  });

  it("settles to offline_cached when logged out and cached details exist", async () => {
    const cached = createBookmark("tweet-1");
    mocks.getAllBookmarks.mockResolvedValue([cached]);
    mocks.getDetailedTweetIds.mockResolvedValue(new Set(["tweet-1"]));

    const store = createRuntimeStore();
    await store.getState().actions.boot();

    const state = store.getState();
    expect(selectRuntimeMode(state)).toBe("offline_cached");
    expect(selectDisplayBookmarks(state)).toEqual([cached]);
    expect(mocks.setActiveAccountId).toHaveBeenCalledWith("acct-1");
  });

  it("automatically resumes a partial seeded import on boot", async () => {
    localStorage.setItem(LS_BOOT_SYNC_POLICY, "manual_only_until_seeded");
    const cached = createBookmark("tweet-1");
    mocks.getRuntimeSnapshot.mockResolvedValue(runtimeSnapshot({
      sessionState: "logged_in",
      authPhase: "ready",
      capability: {
        bookmarksApi: "ready",
        detailApi: "unknown",
      },
    }));
    mocks.getAllBookmarks.mockResolvedValue([cached]);
    mocks.getDetailedTweetIds.mockResolvedValue(new Set(["tweet-1"]));
    mocks.reserveSyncRun.mockResolvedValue({
      allow: false,
      mode: null,
      reason: "not_ready",
    });

    const store = createRuntimeStore();
    await store.getState().actions.boot();

    expect(mocks.reserveSyncRun).toHaveBeenCalledWith({
      accountId: "acct-1",
      trigger: "manual",
      localCount: 1,
      requestedMode: "full",
    });
  });

  it("ignores stale boot results after dispose invalidates the generation", async () => {
    const firstBoot = deferred<RuntimeSnapshot>();
    mocks.getRuntimeSnapshot.mockImplementationOnce(() => firstBoot.promise);

    const store = createRuntimeStore();
    const bootPromise = store.getState().actions.boot();
    store.getState().actions.dispose();

    firstBoot.resolve(runtimeSnapshot());
    await bootPromise;

    const state = store.getState();
    expect(state.bookmarksLoaded).toBe(false);
    expect(state.detailedIdsLoaded).toBe(false);
    expect(state.activeAccountId).toBeNull();
  });

  it("times out detail-id hydration so boot can still settle after reset races", async () => {
    vi.useFakeTimers();
    try {
      mocks.getDetailedTweetIds.mockImplementation(
        () => new Promise<Set<string>>(() => {}),
      );

      const store = createRuntimeStore();
      const bootPromise = store.getState().actions.boot();

      await vi.runAllTimersAsync();
      await bootPromise;

      const state = store.getState();
      expect(state.bookmarksLoaded).toBe(true);
      expect(state.detailedIdsLoaded).toBe(true);
      expect(selectRuntimeMode(state)).toBe("offline_empty");
    } finally {
      vi.useRealTimers();
    }
  });

  it("preserves a persisted manual-only boot policy during reset prep", () => {
    const store = createRuntimeStore();

    store.getState().actions.prepareForReset();

    const state = store.getState();
    expect(state.bootPolicy).toBe("manual_only_until_seeded");
    expect(state.bookmarks).toEqual([]);
    expect(localStorage.setItem).toHaveBeenCalledWith(
      "totem_boot_sync_policy",
      "manual_only_until_seeded",
    );
  });
});

describe("runtime-store sync", () => {
  function primeReadyState(
    store: ReturnType<typeof createRuntimeStore>,
    overrides: Partial<RuntimeState> = {},
  ) {
    store.setState({
      authPhase: "ready",
      authState: "authenticated",
      sessionState: "logged_in",
      capability: {
        bookmarksApi: "ready",
        detailApi: "unknown",
      },
      activeAccountId: "acct-1",
      hasQueryId: true,
      bookmarksLoaded: true,
      detailedIdsLoaded: true,
      syncStatus: "idle",
      syncJobKind: "none",
      syncBlockedReason: null,
      ...overrides,
    });
  }

  it("forces full manual sync while seeding after reset even if bookmarks already exist", async () => {
    localStorage.setItem(LS_BOOT_SYNC_POLICY, "manual_only_until_seeded");
    mocks.reserveSyncRun.mockResolvedValue({
      allow: false,
      mode: null,
      reason: "not_ready",
    });

    const store = createRuntimeStore();
    primeReadyState(store, {
      bootPolicy: "manual_only_until_seeded",
      bookmarks: [createBookmark("tweet-1")],
    });

    await store.getState().actions.refresh();

    expect(mocks.reserveSyncRun).toHaveBeenCalledWith({
      accountId: "acct-1",
      trigger: "manual",
      localCount: 1,
      requestedMode: "full",
    });
  });

  it("keeps manual-only policy and reports an error when a full seed sync is incomplete", async () => {
    localStorage.setItem(LS_BOOT_SYNC_POLICY, "manual_only_until_seeded");
    mocks.reserveSyncRun.mockResolvedValue({
      allow: true,
      mode: "full",
      reason: "manual",
      leaseId: "lease-1",
      accountKey: "acct-1",
    });
    mocks.fetchBookmarkPage.mockResolvedValue({
      bookmarks: Array.from({ length: 100 }, (_, index) => createBookmark(`tweet-${index}`)),
      cursor: null,
      stopOnEmptyResponse: false,
    });

    const store = createRuntimeStore();
    primeReadyState(store, {
      bootPolicy: "manual_only_until_seeded",
    });

    await store.getState().actions.refresh();

    const state = store.getState();
    expect(mocks.fetchBookmarkPage).toHaveBeenCalledTimes(2);
    expect(state.bookmarks).toHaveLength(100);
    expect(state.syncStatus).toBe("error");
    expect(state.bootPolicy).toBe("manual_only_until_seeded");
    expect(localStorage.getItem(LS_BOOT_SYNC_POLICY)).toBe("manual_only_until_seeded");
    expect(mocks.completeSyncRun).toHaveBeenCalledWith({
      accountId: "acct-1",
      leaseId: "lease-1",
      mode: "full",
      status: "failure",
      trigger: "manual",
      errorCode: "INCOMPLETE_FULL_SYNC",
    });
  });

  it("clears manual-only policy only after a complete full seed sync", async () => {
    localStorage.setItem(LS_BOOT_SYNC_POLICY, "manual_only_until_seeded");
    mocks.reserveSyncRun.mockResolvedValue({
      allow: true,
      mode: "full",
      reason: "manual",
      leaseId: "lease-2",
      accountKey: "acct-1",
    });
    mocks.fetchBookmarkPage
      .mockResolvedValueOnce({
        bookmarks: [createBookmark("tweet-1"), createBookmark("tweet-2")],
        cursor: "cursor-1",
        stopOnEmptyResponse: false,
      })
      .mockResolvedValueOnce({
        bookmarks: [],
        cursor: null,
        stopOnEmptyResponse: true,
      });

    const store = createRuntimeStore();
    primeReadyState(store, {
      bootPolicy: "manual_only_until_seeded",
    });

    await store.getState().actions.refresh();

    const state = store.getState();
    expect(state.syncStatus).toBe("idle");
    expect(state.bootPolicy).toBe("auto");
    expect(localStorage.getItem(LS_BOOT_SYNC_POLICY)).toBeNull();
    expect(mocks.completeSyncRun).toHaveBeenCalledWith({
      accountId: "acct-1",
      leaseId: "lease-2",
      mode: "full",
      status: "success",
      trigger: "manual",
      errorCode: undefined,
    });
  });
});
