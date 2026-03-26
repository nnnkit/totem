import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AUTH_PHASE_TRANSITIONS,
  createAuthSlice,
  isValidAuthTransition,
  normalizeAuthPayloadFromSnapshot,
  normalizeAuthPayloadFromStatus,
  type AuthSliceDeps,
  type BootSyncPolicy,
} from "../auth-slice";
import type { AuthPhase, Bookmark, RuntimeSnapshot } from "../../../types";

// ── Test helpers ──────────────────────────────────────────────

function createDeps(overrides: Partial<AuthSliceDeps> = {}): AuthSliceDeps {
  return {
    getRuntimeSnapshot: vi.fn<() => Promise<RuntimeSnapshot>>().mockResolvedValue(
      runtimeSnapshot(),
    ),
    checkAuth: vi.fn().mockResolvedValue({
      hasUser: false,
      hasAuth: false,
      userId: null,
      authState: "logged_out",
      sessionState: "logged_out",
      capability: { bookmarksApi: "unknown", detailApi: "unknown" },
    }),
    getAllBookmarks: vi.fn<() => Promise<Bookmark[]>>().mockResolvedValue([]),
    getDetailedTweetIds: vi.fn<() => Promise<Set<string>>>().mockResolvedValue(new Set()),
    setActiveAccountId: vi.fn(),
    readBootPolicy: vi.fn<() => BootSyncPolicy>().mockReturnValue("auto"),
    persistBootPolicy: vi.fn(),
    onReady: vi.fn(),
    onHydrateComplete: vi.fn(),
    ...overrides,
  };
}

function runtimeSnapshot(overrides: Partial<RuntimeSnapshot> = {}): RuntimeSnapshot {
  return {
    sessionState: "logged_out",
    authPhase: "need_login",
    accountContextId: "acct-1",
    capability: { bookmarksApi: "unknown", detailApi: "unknown" },
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
    setItem: vi.fn((key: string, value: string) => { storage.set(key, value); }),
    removeItem: vi.fn((key: string) => { storage.delete(key); }),
    clear: vi.fn(() => { storage.clear(); }),
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("localStorage", createLocalStorageMock());
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ── Phase transition validation ───────────────────────────────

describe("auth phase transitions", () => {
  it("defines valid transitions for all phases", () => {
    const phases: AuthPhase[] = ["loading", "need_login", "connecting", "ready"];
    for (const phase of phases) {
      expect(AUTH_PHASE_TRANSITIONS[phase]).toBeDefined();
      expect(AUTH_PHASE_TRANSITIONS[phase].length).toBeGreaterThan(0);
    }
  });

  it("allows loading → need_login", () => {
    expect(isValidAuthTransition("loading", "need_login")).toBe(true);
  });

  it("allows loading → connecting", () => {
    expect(isValidAuthTransition("loading", "connecting")).toBe(true);
  });

  it("allows loading → ready", () => {
    expect(isValidAuthTransition("loading", "ready")).toBe(true);
  });

  it("allows connecting → ready", () => {
    expect(isValidAuthTransition("connecting", "ready")).toBe(true);
  });

  it("allows connecting → need_login", () => {
    expect(isValidAuthTransition("connecting", "need_login")).toBe(true);
  });

  it("allows ready → need_login", () => {
    expect(isValidAuthTransition("ready", "need_login")).toBe(true);
  });

  it("allows ready → connecting (stale auth)", () => {
    expect(isValidAuthTransition("ready", "connecting")).toBe(true);
  });

  it("allows need_login → connecting (user starts login)", () => {
    expect(isValidAuthTransition("need_login", "connecting")).toBe(true);
  });

  it("allows need_login → ready (direct recovery)", () => {
    expect(isValidAuthTransition("need_login", "ready")).toBe(true);
  });

  it("rejects connecting → loading", () => {
    expect(isValidAuthTransition("connecting", "loading")).toBe(false);
  });

  it("rejects need_login → loading", () => {
    expect(isValidAuthTransition("need_login", "loading")).toBe(false);
  });

  it("treats same-state as valid (no-op)", () => {
    expect(isValidAuthTransition("ready", "ready")).toBe(true);
    expect(isValidAuthTransition("loading", "loading")).toBe(true);
  });
});

// ── Normalization helpers ─────────────────────────────────────

describe("normalizeAuthPayloadFromSnapshot", () => {
  it("maps logged_in snapshot to authenticated payload", () => {
    const payload = normalizeAuthPayloadFromSnapshot(runtimeSnapshot({
      sessionState: "logged_in",
      accountContextId: "user-42",
      capability: { bookmarksApi: "ready", detailApi: "unknown" },
    }));

    expect(payload.hasUser).toBe(true);
    expect(payload.hasAuth).toBe(true);
    expect(payload.authState).toBe("authenticated");
    expect(payload.sessionState).toBe("logged_in");
    expect(payload.userId).toBe("user-42");
    expect(payload.bookmarksApi).toBe("ready");
  });

  it("maps logged_out snapshot to logged_out payload", () => {
    const payload = normalizeAuthPayloadFromSnapshot(runtimeSnapshot());
    expect(payload.authState).toBe("logged_out");
    expect(payload.hasAuth).toBe(false);
  });

  it("maps unknown session to stale payload", () => {
    const payload = normalizeAuthPayloadFromSnapshot(runtimeSnapshot({
      sessionState: "unknown",
    }));
    expect(payload.authState).toBe("stale");
  });
});

describe("normalizeAuthPayloadFromStatus", () => {
  it("maps authenticated status correctly", () => {
    const payload = normalizeAuthPayloadFromStatus({
      hasUser: true,
      hasAuth: true,
      userId: "user-1",
      authState: "authenticated",
      sessionState: "logged_in",
      capability: { bookmarksApi: "ready", detailApi: "ready" },
    });

    expect(payload.authState).toBe("authenticated");
    expect(payload.userId).toBe("user-1");
    expect(payload.bookmarksApi).toBe("ready");
  });
});

// ── Auth slice boot lifecycle ─────────────────────────────────

describe("auth slice boot", () => {
  it("starts in loading phase", () => {
    const deps = createDeps();
    const store = createAuthSlice(deps);
    expect(store.getState().authPhase).toBe("loading");
    expect(store.getState().bookmarksLoaded).toBe(false);
    store.getState().actions.dispose();
  });

  it("settles to need_login when snapshot returns logged_out", async () => {
    const deps = createDeps();
    const store = createAuthSlice(deps);

    await store.getState().actions.boot();

    expect(store.getState().authPhase).toBe("need_login");
    expect(store.getState().bookmarksLoaded).toBe(true);
    expect(store.getState().detailedIdsLoaded).toBe(true);
    expect(store.getState().activeAccountId).toBe("acct-1");
    store.getState().actions.dispose();
  });

  it("settles to ready when snapshot returns logged_in", async () => {
    const deps = createDeps({
      getRuntimeSnapshot: vi.fn().mockResolvedValue(runtimeSnapshot({
        sessionState: "logged_in",
        accountContextId: "acct-1",
        capability: { bookmarksApi: "ready", detailApi: "unknown" },
      })),
    });
    const store = createAuthSlice(deps);

    await store.getState().actions.boot();

    expect(store.getState().authPhase).toBe("ready");
    expect(store.getState().sessionState).toBe("logged_in");
    expect(store.getState().bookmarksLoaded).toBe(true);
    store.getState().actions.dispose();
  });

  it("falls back to connecting when both snapshot and checkAuth fail", async () => {
    const deps = createDeps({
      getRuntimeSnapshot: vi.fn().mockRejectedValue(new Error("TIMEOUT")),
      checkAuth: vi.fn().mockRejectedValue(new Error("TIMEOUT")),
    });
    const store = createAuthSlice(deps);

    await store.getState().actions.boot();

    expect(store.getState().authPhase).toBe("connecting");
    expect(store.getState().bookmarksLoaded).toBe(true);
    store.getState().actions.dispose();
  });

  it("ignores stale boot results after dispose", async () => {
    let resolveSnapshot!: (v: RuntimeSnapshot) => void;
    const deps = createDeps({
      getRuntimeSnapshot: vi.fn().mockImplementation(
        () => new Promise<RuntimeSnapshot>((resolve) => { resolveSnapshot = resolve; }),
      ),
    });
    const store = createAuthSlice(deps);

    const bootPromise = store.getState().actions.boot();
    store.getState().actions.dispose();

    resolveSnapshot(runtimeSnapshot({
      sessionState: "logged_in",
      accountContextId: "acct-1",
    }));
    await bootPromise;

    // Should not have applied the payload
    expect(store.getState().bookmarksLoaded).toBe(false);
  });

  it("hydrates bookmarks from IndexedDB on boot", async () => {
    const bookmark: Bookmark = {
      id: "tweet-1", tweetId: "tweet-1", text: "Hello", createdAt: 1,
      sortIndex: "tweet-1", bookmarked: false,
      author: { name: "A", screenName: "a", profileImageUrl: "", verified: false },
      metrics: { likes: 0, retweets: 0, replies: 0, views: 0, bookmarks: 0 },
      media: [], urls: [], isThread: false, hasImage: false, hasVideo: false,
      hasLink: false, quotedTweet: null,
    };
    const deps = createDeps({
      getRuntimeSnapshot: vi.fn().mockResolvedValue(runtimeSnapshot({
        sessionState: "logged_in",
        accountContextId: "acct-1",
      })),
      getAllBookmarks: vi.fn().mockResolvedValue([bookmark]),
      getDetailedTweetIds: vi.fn().mockResolvedValue(new Set(["tweet-1"])),
    });
    const store = createAuthSlice(deps);

    await store.getState().actions.boot();

    expect(deps.setActiveAccountId).toHaveBeenCalledWith("acct-1");
    expect(deps.getAllBookmarks).toHaveBeenCalled();
    expect(deps.getDetailedTweetIds).toHaveBeenCalled();
    expect(store.getState().bookmarksLoaded).toBe(true);
    expect(store.getState().detailedIdsLoaded).toBe(true);
    store.getState().actions.dispose();
  });

  it("skips hydration for manual_only_until_seeded + logged_out", async () => {
    const deps = createDeps({
      readBootPolicy: vi.fn().mockReturnValue("manual_only_until_seeded"),
    });
    const store = createAuthSlice(deps);

    await store.getState().actions.boot();

    expect(store.getState().bootPolicy).toBe("manual_only_until_seeded");
    expect(store.getState().bookmarksLoaded).toBe(true);
    expect(deps.getAllBookmarks).not.toHaveBeenCalled();
    store.getState().actions.dispose();
  });

  it("calls onReady when boot reaches ready with auto sync", async () => {
    const onReady = vi.fn();
    const deps = createDeps({
      getRuntimeSnapshot: vi.fn().mockResolvedValue(runtimeSnapshot({
        sessionState: "logged_in",
        accountContextId: "acct-1",
        capability: { bookmarksApi: "ready", detailApi: "unknown" },
      })),
      onReady,
    });
    const store = createAuthSlice(deps);

    await store.getState().actions.boot();

    expect(onReady).toHaveBeenCalled();
    store.getState().actions.dispose();
  });
});

// ── Self-contained timers ─────────────────────────────────────

describe("auth slice self-contained timers", () => {
  it("starts heartbeat timer when entering ready phase", async () => {
    const deps = createDeps({
      getRuntimeSnapshot: vi.fn().mockResolvedValue(runtimeSnapshot({
        sessionState: "logged_in",
        accountContextId: "acct-1",
        capability: { bookmarksApi: "ready", detailApi: "unknown" },
      })),
    });
    const store = createAuthSlice(deps);

    await store.getState().actions.boot();

    // Auth check should be called again after heartbeat interval
    const callsBefore = (deps.getRuntimeSnapshot as ReturnType<typeof vi.fn>).mock.calls.length;
    await vi.advanceTimersByTimeAsync(45_000);
    const callsAfter = (deps.getRuntimeSnapshot as ReturnType<typeof vi.fn>).mock.calls.length;

    expect(callsAfter).toBeGreaterThan(callsBefore);
    store.getState().actions.dispose();
  });

  it("starts connecting timeout when entering connecting phase", async () => {
    const deps = createDeps({
      getRuntimeSnapshot: vi.fn().mockRejectedValue(new Error("TIMEOUT")),
      checkAuth: vi.fn().mockRejectedValue(new Error("TIMEOUT")),
    });
    const store = createAuthSlice(deps);

    await store.getState().actions.boot();
    expect(store.getState().authPhase).toBe("connecting");

    // After connecting timeout, should transition to need_login
    await vi.advanceTimersByTimeAsync(15_000);

    expect(store.getState().authPhase).toBe("need_login");
    store.getState().actions.dispose();
  });

  it("schedules retry when authRetryDelayMs is set", async () => {
    const deps = createDeps({
      getRuntimeSnapshot: vi.fn().mockRejectedValue(new Error("TIMEOUT")),
      checkAuth: vi.fn().mockRejectedValue(new Error("TIMEOUT")),
    });
    const store = createAuthSlice(deps);

    await store.getState().actions.boot();
    expect(store.getState().authRetryDelayMs).toBe(1000); // AUTH_RETRY_MS

    const callsBefore = (deps.getRuntimeSnapshot as ReturnType<typeof vi.fn>).mock.calls.length;
    await vi.advanceTimersByTimeAsync(1000);
    const callsAfter = (deps.getRuntimeSnapshot as ReturnType<typeof vi.fn>).mock.calls.length;

    expect(callsAfter).toBeGreaterThan(callsBefore);
    store.getState().actions.dispose();
  });

  it("clears all timers on dispose", async () => {
    const deps = createDeps({
      getRuntimeSnapshot: vi.fn().mockResolvedValue(runtimeSnapshot({
        sessionState: "logged_in",
        accountContextId: "acct-1",
      })),
    });
    const store = createAuthSlice(deps);

    await store.getState().actions.boot();
    store.getState().actions.dispose();

    const callsBefore = (deps.getRuntimeSnapshot as ReturnType<typeof vi.fn>).mock.calls.length;
    await vi.advanceTimersByTimeAsync(60_000);
    const callsAfter = (deps.getRuntimeSnapshot as ReturnType<typeof vi.fn>).mock.calls.length;

    // No additional calls after dispose
    expect(callsAfter).toBe(callsBefore);
  });
});

// ── connectingTimeout ─────────────────────────────────────────

describe("auth slice connectingTimeout", () => {
  it("transitions connecting → need_login", async () => {
    const deps = createDeps({
      getRuntimeSnapshot: vi.fn().mockRejectedValue(new Error("TIMEOUT")),
      checkAuth: vi.fn().mockRejectedValue(new Error("TIMEOUT")),
    });
    const store = createAuthSlice(deps);
    await store.getState().actions.boot();

    expect(store.getState().authPhase).toBe("connecting");
    store.getState().actions.connectingTimeout();
    expect(store.getState().authPhase).toBe("need_login");
    store.getState().actions.dispose();
  });

  it("is a no-op if not in connecting phase", async () => {
    const deps = createDeps();
    const store = createAuthSlice(deps);
    await store.getState().actions.boot();

    expect(store.getState().authPhase).toBe("need_login");
    store.getState().actions.connectingTimeout();
    expect(store.getState().authPhase).toBe("need_login"); // unchanged
    store.getState().actions.dispose();
  });
});

// ── startLogin ────────────────────────────────────────────────

describe("auth slice startLogin", () => {
  it("transitions need_login → connecting → ready when auth succeeds", async () => {
    const deps = createDeps();
    const store = createAuthSlice(deps);
    await store.getState().actions.boot();

    expect(store.getState().authPhase).toBe("need_login");

    // Mock successful auth for the login check
    (deps.getRuntimeSnapshot as ReturnType<typeof vi.fn>).mockResolvedValue(
      runtimeSnapshot({
        sessionState: "logged_in",
        accountContextId: "acct-1",
        capability: { bookmarksApi: "ready", detailApi: "unknown" },
      }),
    );

    await store.getState().actions.startLogin();

    expect(store.getState().authPhase).toBe("ready");
    expect(store.getState().sessionState).toBe("logged_in");
    store.getState().actions.dispose();
  });
});

// ── checkAuth error handling ──────────────────────────────────

describe("auth slice checkAuth error handling", () => {
  it("transitions ready → stale with retry on error", async () => {
    const deps = createDeps({
      getRuntimeSnapshot: vi.fn().mockResolvedValue(runtimeSnapshot({
        sessionState: "logged_in",
        accountContextId: "acct-1",
      })),
    });
    const store = createAuthSlice(deps);
    await store.getState().actions.boot();

    expect(store.getState().authPhase).toBe("ready");

    // Make next auth check fail
    (deps.getRuntimeSnapshot as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("NET_ERR"));
    (deps.checkAuth as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("NET_ERR"));

    await store.getState().actions.checkAuth();

    expect(store.getState().authState).toBe("stale");
    expect(store.getState().authRetryDelayMs).toBe(1000);
    store.getState().actions.dispose();
  });
});

// ── Integration: boot → auth → hydrate ────────────────────────

describe("auth slice integration: boot → auth → hydrate", () => {
  it("full flow: boot → ready → hydrate → onReady", async () => {
    const onReady = vi.fn();
    const onHydrateComplete = vi.fn();
    const deps = createDeps({
      getRuntimeSnapshot: vi.fn().mockResolvedValue(runtimeSnapshot({
        sessionState: "logged_in",
        accountContextId: "user-42",
        capability: { bookmarksApi: "ready", detailApi: "ready" },
      })),
      getAllBookmarks: vi.fn().mockResolvedValue([]),
      getDetailedTweetIds: vi.fn().mockResolvedValue(new Set<string>()),
      onReady,
      onHydrateComplete,
    });
    const store = createAuthSlice(deps);

    // Boot: loading → auth check → ready → hydrate
    await store.getState().actions.boot();

    const state = store.getState();
    expect(state.authPhase).toBe("ready");
    expect(state.activeAccountId).toBe("user-42");
    expect(state.bookmarksLoaded).toBe(true);
    expect(state.detailedIdsLoaded).toBe(true);
    expect(onHydrateComplete).toHaveBeenCalled();
    expect(onReady).toHaveBeenCalled();

    store.getState().actions.dispose();
  });

  it("full flow: boot → need_login → login → ready", async () => {
    const deps = createDeps();
    const store = createAuthSlice(deps);

    await store.getState().actions.boot();
    expect(store.getState().authPhase).toBe("need_login");

    // User logs in
    (deps.getRuntimeSnapshot as ReturnType<typeof vi.fn>).mockResolvedValue(
      runtimeSnapshot({
        sessionState: "logged_in",
        accountContextId: "acct-1",
        capability: { bookmarksApi: "ready", detailApi: "unknown" },
      }),
    );

    await store.getState().actions.startLogin();
    expect(store.getState().authPhase).toBe("ready");

    store.getState().actions.dispose();
  });

  it("full flow: boot → connecting (error) → timeout → need_login → login → ready", async () => {
    const deps = createDeps({
      getRuntimeSnapshot: vi.fn().mockRejectedValue(new Error("TIMEOUT")),
      checkAuth: vi.fn().mockRejectedValue(new Error("TIMEOUT")),
    });
    const store = createAuthSlice(deps);

    await store.getState().actions.boot();
    expect(store.getState().authPhase).toBe("connecting");

    // Connecting timeout fires via self-contained timer
    await vi.advanceTimersByTimeAsync(15_000);
    expect(store.getState().authPhase).toBe("need_login");

    // User logs in, auth succeeds now
    (deps.getRuntimeSnapshot as ReturnType<typeof vi.fn>).mockResolvedValue(
      runtimeSnapshot({
        sessionState: "logged_in",
        accountContextId: "acct-1",
      }),
    );

    await store.getState().actions.startLogin();
    expect(store.getState().authPhase).toBe("ready");

    store.getState().actions.dispose();
  });
});
