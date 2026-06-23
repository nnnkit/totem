import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createRuntimeStore,
  selectDisplayBookmarks,
  selectRuntimeMode,
} from "../runtime-store";
import type { Bookmark, RuntimeSnapshot } from "../../types";
import type { RuntimeState } from "../runtime-store";

const mocks = vi.hoisted(() => {
  const detailCacheListeners = new Set<(tweetId: string) => void>();
  return {
    getRuntimeSnapshot: vi.fn<() => Promise<RuntimeSnapshot>>(),
    checkAuth: vi.fn(),
    startAuthCapture: vi.fn(),
    deleteBookmark: vi.fn(),
    fetchBookmarkPage: vi.fn(),
    getBookmarkEvents: vi.fn(),
    queueBookmarkMutation: vi.fn(),
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
    subscribeTweetDetailCache: vi.fn((listener: (tweetId: string) => void) => {
      detailCacheListeners.add(listener);
      return () => {
        detailCacheListeners.delete(listener);
      };
    }),
    upsertBookmarks: vi.fn(),
    detailCacheListeners,
  };
});

vi.mock("../../api/core/auth", () => ({
  checkAuth: mocks.checkAuth,
  getRuntimeSnapshot: mocks.getRuntimeSnapshot,
  startAuthCapture: mocks.startAuthCapture,
}));

vi.mock("../../api/core/bookmarks", () => ({
  ackBookmarkEvents: mocks.ackBookmarkEvents,
  deleteBookmark: mocks.deleteBookmark,
  fetchBookmarkPage: mocks.fetchBookmarkPage,
  getBookmarkEvents: mocks.getBookmarkEvents,
  queueBookmarkMutation: mocks.queueBookmarkMutation,
}));

vi.mock("../../api/core/posts", () => ({
  fetchTweetDetail: mocks.fetchTweetDetail,
}));

vi.mock("../../api/core/sync", () => ({
  completeSyncRun: mocks.completeSyncRun,
  reserveSyncRun: mocks.reserveSyncRun,
}));

vi.mock("../../lib/fetch-queue", () => {
  class FetchQueue {
    private aborted = false;

    enqueue<T>(fn: () => Promise<T>): Promise<T> {
      if (this.aborted) return Promise.reject(new Error("Queue aborted"));
      return fn();
    }

    abort() {
      this.aborted = true;
    }

    get pending() {
      return 0;
    }

    get isAborted() {
      return this.aborted;
    }
  }

  return { FetchQueue };
});

vi.mock("../../db", () => ({
  cleanupOldTweetDetails: mocks.cleanupOldTweetDetails,
  deleteBookmarksByTweetIds: mocks.deleteBookmarksByTweetIds,
  getAllBookmarks: mocks.getAllBookmarks,
  getCompletedTweetIds: mocks.getCompletedTweetIds,
  getDetailedTweetIds: mocks.getDetailedTweetIds,
  setActiveAccountId: mocks.setActiveAccountId,
  subscribeTweetDetailCache: mocks.subscribeTweetDetailCache,
  upsertBookmarks: mocks.upsertBookmarks,
  // The store now reads/writes through an account-bound handle; the mock
  // handle delegates to the same fns so existing call assertions still hold.
  openAccountDb: vi.fn(() => ({
    getAllBookmarks: mocks.getAllBookmarks,
    getDetailedTweetIds: mocks.getDetailedTweetIds,
    deleteBookmarksByTweetIds: mocks.deleteBookmarksByTweetIds,
    upsertBookmarks: mocks.upsertBookmarks,
    cleanupOldTweetDetails: mocks.cleanupOldTweetDetails,
  })),
}));

function createBookmark(tweetId: string): Bookmark {
  return {
    id: tweetId,
    tweetId,
    text: `Tweet ${tweetId}`,
    createdAt: 1,
    sortIndex: tweetId,
    bookmarked: false,
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
    userId: null,
    accountContextId: "acct-1",
    authState: "logged_out",
    sessionState: "logged_out",
    capability: {
      bookmarksApi: "unknown",
      detailApi: "unknown",
    },
  });
  mocks.startAuthCapture.mockResolvedValue({
    started: false,
    inProgress: false,
    authReady: false,
    reason: "not_started",
  });
  mocks.deleteBookmark.mockResolvedValue(undefined);
  mocks.fetchBookmarkPage.mockResolvedValue({ bookmarks: [], cursor: null, stopOnEmptyResponse: true });
  mocks.getBookmarkEvents.mockResolvedValue([]);
  mocks.queueBookmarkMutation.mockResolvedValue(undefined);
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
  mocks.subscribeTweetDetailCache.mockClear();
  mocks.detailCacheListeners.clear();
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

  it("reloads local IDB state without starting a sync", async () => {
    const store = createRuntimeStore();
    const imported = createBookmark("tweet-imported");
    store.setState({
      activeAccountId: "acct-1",
      bookmarks: [],
      detailedTweetIds: new Set<string>(),
      bookmarksLoaded: true,
      detailedIdsLoaded: true,
    });
    mocks.getAllBookmarks.mockResolvedValueOnce([imported]);
    mocks.getDetailedTweetIds.mockResolvedValueOnce(new Set(["tweet-imported"]));

    await store.getState().actions.reloadLocalData();

    expect(mocks.setActiveAccountId).toHaveBeenCalledWith("acct-1");
    expect(mocks.reserveSyncRun).not.toHaveBeenCalled();
    expect(store.getState().bookmarks).toEqual([imported]);
    expect(store.getState().detailedTweetIds.has("tweet-imported")).toBe(true);
    expect(store.getState().bookmarksLoaded).toBe(true);
    expect(store.getState().detailedIdsLoaded).toBe(true);
    store.getState().actions.dispose();
  });

  it("keeps existing bookmarks visible (no loading flash) while reloading", async () => {
    const store = createRuntimeStore();
    const existing = createBookmark("tweet-existing");
    store.setState({
      activeAccountId: "acct-1",
      bookmarks: [existing],
      detailedTweetIds: new Set<string>(["tweet-existing"]),
      bookmarksLoaded: true,
      detailedIdsLoaded: true,
    });

    let resolveBookmarks!: (rows: Bookmark[]) => void;
    mocks.getAllBookmarks.mockReturnValueOnce(
      new Promise<Bookmark[]>((resolve) => {
        resolveBookmarks = resolve;
      }),
    );
    mocks.getDetailedTweetIds.mockResolvedValueOnce(new Set(["tweet-imported"]));

    const reloadPromise = store.getState().actions.reloadLocalData();

    // Mid-reload the data is still being read, but the loaded flags must stay
    // true and the old bookmarks remain on screen — no full-screen spinner.
    expect(store.getState().bookmarksLoaded).toBe(true);
    expect(store.getState().detailedIdsLoaded).toBe(true);
    expect(store.getState().bookmarks).toEqual([existing]);

    resolveBookmarks([createBookmark("tweet-imported")]);
    await reloadPromise;

    expect(store.getState().bookmarks.map((b) => b.tweetId)).toEqual([
      "tweet-imported",
    ]);
    store.getState().actions.dispose();
  });

  it("still reads IDB on boot after a reset so cached bookmarks resurface when the user is logged out", async () => {
    const cached = createBookmark("tweet-1");
    mocks.getAllBookmarks.mockResolvedValue([cached]);
    mocks.getDetailedTweetIds.mockResolvedValue(new Set(["tweet-1"]));

    const store = createRuntimeStore();
    await store.getState().actions.boot();

    const state = store.getState();
    expect(mocks.getAllBookmarks).toHaveBeenCalled();
    expect(mocks.getDetailedTweetIds).toHaveBeenCalled();
    expect(selectRuntimeMode(state)).toBe("offline_cached");
    expect(state.bookmarks).toEqual([cached]);
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

  it("kicks off an auto sync on boot when logged in and hydrated", async () => {
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
      trigger: "auto",
      localCount: 1,
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

  it("starts silent auth capture when X has a live session but headers are missing", async () => {
    mocks.getRuntimeSnapshot.mockResolvedValue(
      runtimeSnapshot({
        sessionState: "unknown",
        authPhase: "connecting",
        accountContextId: "acct-1",
      }),
    );

    const store = createRuntimeStore();
    await store.getState().actions.boot();

    expect(store.getState().authPhase).toBe("connecting");
    expect(mocks.startAuthCapture).toHaveBeenCalledWith({ interactive: false });
  });

  it("clears in-memory bookmarks and detail ids during reset prep", () => {
    const store = createRuntimeStore();
    store.setState({
      bookmarks: [createBookmark("tweet-1")],
      detailedTweetIds: new Set(["tweet-1"]),
    });

    store.getState().actions.prepareForReset();

    const state = store.getState();
    expect(state.bookmarks).toEqual([]);
    expect(state.detailedTweetIds).toEqual(new Set());
  });

  it("tracks detail cache writes from export hydration", () => {
    const store = createRuntimeStore();
    store.setState({
      detailedTweetIds: new Set(["tweet-1"]),
    });

    for (const listener of mocks.detailCacheListeners) {
      listener("tweet-2");
    }

    expect(store.getState().detailedTweetIds).toEqual(
      new Set(["tweet-1", "tweet-2"]),
    );

    store.getState().actions.dispose();
    expect(mocks.detailCacheListeners.size).toBe(0);
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
      bookmarksLoaded: true,
      detailedIdsLoaded: true,
      syncStatus: "idle",
      syncJobKind: "none",
      syncBlockedReason: null,
      ...overrides,
    });
  }

  it("does not send requestedMode — the orchestrator decides mode", async () => {
    mocks.reserveSyncRun.mockResolvedValue({
      allow: false,
      mode: null,
      reason: "not_ready",
    });

    const store = createRuntimeStore();
    primeReadyState(store, {
      bookmarks: [createBookmark("tweet-1")],
    });

    await store.getState().actions.refresh();

    expect(mocks.reserveSyncRun).toHaveBeenCalledWith({
      accountId: "acct-1",
      trigger: "manual",
      localCount: 1,
    });
  });

  it("reports an error and keeps partial bookmarks when a full seed sync is incomplete", async () => {
    mocks.reserveSyncRun.mockResolvedValue({
      allow: true,
      mode: "full",
      reason: "manual_seed",
      leaseId: "lease-1",
      accountKey: "acct-1",
    });
    mocks.fetchBookmarkPage.mockResolvedValue({
      bookmarks: Array.from({ length: 100 }, (_, index) => createBookmark(`tweet-${index}`)),
      cursor: null,
      stopOnEmptyResponse: false,
    });

    const store = createRuntimeStore();
    primeReadyState(store);

    await store.getState().actions.refresh();

    const state = store.getState();
    expect(mocks.fetchBookmarkPage).toHaveBeenCalledTimes(2);
    expect(state.bookmarks).toHaveLength(100);
    expect(state.syncStatus).toBe("error");
    expect(mocks.completeSyncRun).toHaveBeenCalledWith({
      accountId: "acct-1",
      leaseId: "lease-1",
      mode: "full",
      status: "failure",
      trigger: "manual",
      errorCode: "INCOMPLETE_FULL_SYNC",
    });
  });

  it("completes successfully after a full seed sync and reports success to the orchestrator", async () => {
    mocks.reserveSyncRun.mockResolvedValue({
      allow: true,
      mode: "full",
      reason: "manual_seed",
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
    primeReadyState(store);

    await store.getState().actions.refresh();

    const state = store.getState();
    expect(state.syncStatus).toBe("idle");
    expect(mocks.completeSyncRun).toHaveBeenCalledWith({
      accountId: "acct-1",
      leaseId: "lease-2",
      mode: "full",
      status: "success",
      trigger: "manual",
      errorCode: undefined,
    });
  });

  it("reports failure (no false success) when the IndexedDB write rejects mid-sync", async () => {
    mocks.reserveSyncRun.mockResolvedValue({
      allow: true,
      mode: "full",
      reason: "manual_seed",
      leaseId: "lease-3",
      accountKey: "acct-1",
    });
    mocks.fetchBookmarkPage.mockResolvedValue({
      bookmarks: [createBookmark("tweet-1"), createBookmark("tweet-2")],
      cursor: "cursor-1",
      stopOnEmptyResponse: false,
    });
    mocks.upsertBookmarks.mockRejectedValue(new Error("IDB_WRITE_FAILED"));

    const store = createRuntimeStore();
    primeReadyState(store);

    await store.getState().actions.refresh();

    const state = store.getState();
    // Persist-first: a rejected write must not leave the store ahead of the DB,
    // and the sync must report failure instead of a green completion.
    expect(state.syncStatus).toBe("error");
    expect(state.bookmarks).toHaveLength(0);
    expect(mocks.completeSyncRun).toHaveBeenCalledWith({
      accountId: "acct-1",
      leaseId: "lease-3",
      mode: "full",
      status: "failure",
      trigger: "manual",
      errorCode: undefined,
    });
  });

});

// ---------------------------------------------------------------------------
// Auth flow integration tests
// ---------------------------------------------------------------------------

describe("runtime-store auth flows", () => {
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
      bookmarksLoaded: true,
      detailedIdsLoaded: true,
      syncStatus: "idle",
      syncJobKind: "none",
      syncBlockedReason: null,
      ...overrides,
    });
  }

  it("fresh install → login → checkAuth → reaches ready and triggers sync", async () => {
    // Boot with logged_out snapshot (default mock)
    const store = createRuntimeStore();
    await store.getState().actions.boot();

    expect(store.getState().authPhase).toBe("need_login");

    // User clicks login → startLogin sets authPhase to "connecting"
    // Mock getRuntimeSnapshot to return logged_in for the next auth check
    mocks.getRuntimeSnapshot.mockResolvedValue(
      runtimeSnapshot({
        sessionState: "logged_in",
        authPhase: "ready",
        accountContextId: "acct-1",
        capability: {
          bookmarksApi: "ready",
          detailApi: "unknown",
        },
      }),
    );

    await store.getState().actions.startLogin();

    const state = store.getState();
    expect(mocks.startAuthCapture).toHaveBeenCalledWith({
      interactive: true,
      force: true,
    });
    expect(state.authPhase).toBe("ready");
    expect(state.sessionState).toBe("logged_in");
  });

  it("sync auth error → reauthing → recovery after checkAuth", async () => {
    const store = createRuntimeStore();
    primeReadyState(store);

    // Allow sync but make fetchBookmarkPage throw NO_AUTH
    mocks.reserveSyncRun.mockResolvedValue({
      allow: true,
      mode: "quick",
      reason: "manual",
      leaseId: "lease-auth-err",
      accountKey: "acct-1",
    });
    mocks.fetchBookmarkPage.mockRejectedValue(new Error("NO_AUTH"));

    await store.getState().actions.refresh();

    // Should be in reauthing state
    expect(store.getState().syncStatus).toBe("reauthing");

    // Simulate auth recovery: getRuntimeSnapshot returns logged_in
    mocks.getRuntimeSnapshot.mockResolvedValue(
      runtimeSnapshot({
        sessionState: "logged_in",
        authPhase: "ready",
        accountContextId: "acct-1",
        capability: {
          bookmarksApi: "ready",
          detailApi: "unknown",
        },
      }),
    );

    await store.getState().actions.checkAuth();

    expect(store.getState().authPhase).toBe("ready");
    expect(store.getState().sessionState).toBe("logged_in");
  });

  it("sync transient error → retry → success accumulates bookmarks", async () => {
    const store = createRuntimeStore();
    primeReadyState(store);

    // First sync: allow but fail with network error
    mocks.reserveSyncRun.mockResolvedValue({
      allow: true,
      mode: "quick",
      reason: "manual",
      leaseId: "lease-err-1",
      accountKey: "acct-1",
    });
    mocks.fetchBookmarkPage.mockRejectedValue(new Error("NETWORK_ERROR"));

    await store.getState().actions.refresh();
    expect(store.getState().syncStatus).toBe("error");

    // Retry: allow sync with successful fetch
    mocks.reserveSyncRun.mockResolvedValue({
      allow: true,
      mode: "quick",
      reason: "manual",
      leaseId: "lease-ok-2",
      accountKey: "acct-1",
    });
    mocks.fetchBookmarkPage
      .mockResolvedValueOnce({
        bookmarks: [createBookmark("tweet-a"), createBookmark("tweet-b")],
        cursor: null,
        stopOnEmptyResponse: true,
      });

    await store.getState().actions.refresh();

    const state = store.getState();
    expect(state.syncStatus).toBe("idle");
    expect(state.bookmarks).toHaveLength(2);
  });

  it("connecting timeout → need_login → can retry and reach ready", async () => {
    const store = createRuntimeStore();

    // Make both auth calls fail so boot's catch block sets authPhase to "connecting"
    mocks.getRuntimeSnapshot.mockRejectedValue(new Error("AUTH_TIMEOUT"));
    mocks.checkAuth.mockRejectedValue(new Error("AUTH_TIMEOUT"));

    await store.getState().actions.boot();
    expect(store.getState().authPhase).toBe("connecting");

    // Timeout fires
    store.getState().actions.connectingTimeout();
    expect(store.getState().authPhase).toBe("need_login");

    // User retries login, this time auth succeeds
    mocks.getRuntimeSnapshot.mockResolvedValue(
      runtimeSnapshot({
        sessionState: "logged_in",
        authPhase: "ready",
        accountContextId: "acct-1",
        capability: {
          bookmarksApi: "ready",
          detailApi: "unknown",
        },
      }),
    );

    await store.getState().actions.startLogin();
    expect(mocks.startAuthCapture).toHaveBeenCalledWith({
      interactive: true,
      force: true,
    });
    expect(store.getState().authPhase).toBe("ready");
    expect(store.getState().sessionState).toBe("logged_in");
  });
});

// ---------------------------------------------------------------------------
// Reactive snapshot push (applyRuntimeSnapshot)
// ---------------------------------------------------------------------------

describe("runtime-store applyRuntimeSnapshot", () => {
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
      bookmarksLoaded: true,
      detailedIdsLoaded: true,
      syncStatus: "idle",
      syncJobKind: "none",
      syncBlockedReason: null,
      ...overrides,
    });
  }

  it("propagates a capability upgrade (detailApi unknown → ready) without re-hydrating IDB", async () => {
    const store = createRuntimeStore();
    const cached = createBookmark("tweet-1");
    primeReadyState(store, {
      bookmarks: [cached],
      detailedTweetIds: new Set(["tweet-1"]),
    });

    await store.getState().actions.applyRuntimeSnapshot(
      runtimeSnapshot({
        sessionState: "logged_in",
        authPhase: "ready",
        accountContextId: "acct-1",
        capability: {
          bookmarksApi: "ready",
          detailApi: "ready",
        },
      }),
    );

    const state = store.getState();
    expect(state.capability.detailApi).toBe("ready");
    // Bookmarks must not be cleared by a push update.
    expect(state.bookmarks).toEqual([cached]);
    expect(state.detailedTweetIds).toEqual(new Set(["tweet-1"]));
    // Hydration path should not have been re-invoked.
    expect(mocks.getAllBookmarks).not.toHaveBeenCalled();
    expect(mocks.getDetailedTweetIds).not.toHaveBeenCalled();
  });

  it("transitions ready → need_login when the SW reports a logged_out snapshot", async () => {
    const store = createRuntimeStore();
    primeReadyState(store);

    await store.getState().actions.applyRuntimeSnapshot(
      runtimeSnapshot({
        sessionState: "logged_out",
        authPhase: "need_login",
        accountContextId: "acct-1",
      }),
    );

    expect(store.getState().authPhase).toBe("need_login");
    expect(store.getState().sessionState).toBe("logged_out");
  });

  it("is idempotent: applying an identical snapshot leaves state unchanged", async () => {
    const store = createRuntimeStore();
    primeReadyState(store);
    const before = store.getState();

    await store.getState().actions.applyRuntimeSnapshot(
      runtimeSnapshot({
        sessionState: "logged_in",
        authPhase: "ready",
        accountContextId: "acct-1",
        capability: { bookmarksApi: "ready", detailApi: "unknown" },
      }),
    );

    const after = store.getState();
    expect(after.capability).toEqual(before.capability);
    expect(after.authPhase).toBe(before.authPhase);
    expect(after.bookmarks).toBe(before.bookmarks);
  });

  it("does not start a sync on push-applied snapshots (allowAutoSync: false)", async () => {
    const store = createRuntimeStore();
    primeReadyState(store);

    await store.getState().actions.applyRuntimeSnapshot(
      runtimeSnapshot({
        sessionState: "logged_in",
        authPhase: "ready",
        accountContextId: "acct-1",
      }),
    );

    expect(mocks.reserveSyncRun).not.toHaveBeenCalled();
  });

  async function startHangingSync(
    store: ReturnType<typeof createRuntimeStore>,
  ): Promise<void> {
    // Reserve succeeds; first page fetch hangs so the sync stays in-flight
    // (lease + activeSyncController both set inside the closure).
    mocks.reserveSyncRun.mockResolvedValue({
      allow: true,
      mode: "full",
      reason: "manual",
      leaseId: "lease-race",
      accountKey: "acct-1",
    });
    mocks.fetchBookmarkPage.mockImplementation(
      () => new Promise(() => {}), // never resolves — simulates in-flight
    );

    // Kick off the sync but don't await it — it'll be interrupted by
    // the snapshot push releasing the lease.
    void store.getState().actions.refresh();

    // Let the reservation and lease setup complete before we push.
    await Promise.resolve();
    await Promise.resolve();
  }

  it("releases an in-flight lease when a push snapshot transitions ready → logged_out", async () => {
    const store = createRuntimeStore();
    primeReadyState(store);

    await startHangingSync(store);
    expect(store.getState().syncStatus).toBe("syncing");

    mocks.completeSyncRun.mockClear();

    await store.getState().actions.applyRuntimeSnapshot(
      runtimeSnapshot({
        sessionState: "logged_out",
        authPhase: "need_login",
        accountContextId: "acct-1",
      }),
    );

    // The push path must tell the SW the in-flight run is abandoned, not
    // silently flip local syncStatus to idle and leave the lease dangling.
    // Let the microtask from releaseActiveLease() flush.
    await Promise.resolve();
    await Promise.resolve();

    expect(mocks.completeSyncRun).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "skipped",
        leaseId: "lease-race",
      }),
    );
    expect(store.getState().authPhase).toBe("need_login");
  });

  it("releases an in-flight lease when reset prep runs in any tab", async () => {
    const store = createRuntimeStore();
    primeReadyState(store);

    await startHangingSync(store);
    expect(store.getState().syncStatus).toBe("syncing");

    mocks.completeSyncRun.mockClear();
    store.getState().actions.prepareForReset();
    await Promise.resolve();
    await Promise.resolve();

    expect(mocks.completeSyncRun).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "skipped",
        leaseId: "lease-race",
      }),
    );
    expect(store.getState().bookmarks).toEqual([]);
    expect(store.getState().syncStatus).toBe("idle");
  });

  it("does NOT release the lease when the push keeps the session ready (capability-only upgrade)", async () => {
    const store = createRuntimeStore();
    primeReadyState(store);

    await startHangingSync(store);
    expect(store.getState().syncStatus).toBe("syncing");

    mocks.completeSyncRun.mockClear();

    await store.getState().actions.applyRuntimeSnapshot(
      runtimeSnapshot({
        sessionState: "logged_in",
        authPhase: "ready",
        accountContextId: "acct-1",
        capability: { bookmarksApi: "ready", detailApi: "ready" },
      }),
    );

    // Capability went unknown → ready; session stayed ready. Sync must
    // continue untouched — pushing a capability upgrade through the lease
    // machinery would cancel healthy work.
    expect(mocks.completeSyncRun).not.toHaveBeenCalled();
    expect(store.getState().syncStatus).toBe("syncing");
  });
});
