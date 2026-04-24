/**
 * Full-flow integration tests — exercises cross-module message paths
 * through the real handler map using the fake Chrome API layer.
 *
 * Covers:
 *   1. Auth capture → snapshot build → frontend receipt
 *   2. Sync reservation → completion → cooldown
 *   3. Bookmark event capture → queue → process → ack
 *   4. Query ID resolution integration with sync/API proxy
 *   5. Cross-slice: auth ready → sync starts, events → soft sync signal
 */

import { beforeEach, describe, expect, it } from "vitest";
import { createFakeChrome, type FakeChrome } from "../../test-utils/fake-chrome";
import { createMessageRouter, mergeHandlerMaps } from "../index";
import { createAuthHandlers, _resetForTesting as resetAuth } from "../auth";
import { createSyncHandlers, _resetForTesting as resetSync } from "../sync";
import { createEventHandlers } from "../events";
import {
  _resetForTesting as resetQueryId,
  createQueryIdHandlers,
  captureGraphqlEndpoint,
  loadGraphqlCatalog,
} from "../query-id";

// ── Helpers ─────────────────────────────────────────────────────

function setupFullRouter(fakeChrome: FakeChrome) {
  const storage = fakeChrome.storage.local as unknown as typeof chrome.storage.local;
  const tabs = fakeChrome.tabs as unknown as typeof chrome.tabs;

  const authHandlers = createAuthHandlers({ storage, tabs });
  const eventHandlers = createEventHandlers({ storage });

  const SYNC_KEY = "totem_sync_orchestrator_state";

  // Sync handlers need all deps wired to our fake storage
  const syncHandlers = createSyncHandlers({
    getSessionSnapshot: async () => {
      const stored = await storage.get([
        "totem_user_id",
        "totem_auth_headers",
        "totem_auth_state",
      ]);
      const authHeaders = stored.totem_auth_headers as Record<string, string> | undefined;
      const hasAuthHeader = Boolean(authHeaders?.authorization);
      const userId = typeof stored.totem_user_id === "string" ? stored.totem_user_id : null;
      const authState = stored.totem_auth_state;
      const sessionState =
        authState === "logged_out"
          ? "logged_out"
          : hasAuthHeader || authState === "authenticated"
            ? "logged_in"
            : "unknown";
      return {
        userId,
        accountContextId: userId,
        sessionState,
        hasAuthHeader,
      };
    },
    buildRuntimeSnapshot: async () => ({ ok: true }),
    readState: async () => {
      const stored = await storage.get([SYNC_KEY]);
      const raw = stored[SYNC_KEY];
      if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        return raw as { version: number; accounts: Record<string, unknown> };
      }
      return { version: 1, accounts: {} };
    },
    writeState: async (state: unknown) => {
      await storage.set({ [SYNC_KEY]: state });
    },
  } as Parameters<typeof createSyncHandlers>[0]);

  const queryIdHandlers = createQueryIdHandlers({
    storage,
    tabs,
    fetchFn: (() => Promise.reject(new Error("no network in tests"))) as typeof fetch,
  });

  const ping = { PING: async () => ({ ok: true, pong: true }) };

  const allHandlers = mergeHandlerMaps(
    ping,
    authHandlers,
    syncHandlers,
    eventHandlers,
    queryIdHandlers,
  );

  const router = createMessageRouter(allHandlers);
  fakeChrome.runtime.onMessage.addListener(router);

  return { storage, tabs, allHandlers };
}

async function send(fakeChrome: FakeChrome, message: Record<string, unknown>) {
  return fakeChrome.runtime.sendMessage(message);
}

/** Seed auth headers in storage — simulates content script capture */
async function seedAuth(storage: typeof chrome.storage.local) {
  await storage.set({
    totem_user_id: "12345",
    totem_account_context_id: "12345",
    totem_auth_headers: {
      authorization: "Bearer AAAA",
      "x-csrf-token": "csrf-token-123",
      cookie: 'twid="u%3D12345"; auth_token=abc123',
    },
    totem_auth_state: "authenticated",
    totem_auth_state_at: Date.now(),
  });
}

// ── Setup ───────────────────────────────────────────────────────

let fakeChrome: FakeChrome;

beforeEach(() => {
  fakeChrome = createFakeChrome();
  resetAuth();
  resetSync();
  resetQueryId();
});

// ═══════════════════════════════════════════════════════════════
// 1. Auth capture → snapshot build → frontend receipt
// ═══════════════════════════════════════════════════════════════

describe("auth capture → snapshot → frontend receipt", () => {
  it("end-to-end: no auth → capture headers → CHECK_AUTH returns authenticated", async () => {
    const { storage } = setupFullRouter(fakeChrome);

    // Before auth — should be logged_out
    const before = (await send(fakeChrome, { type: "CHECK_AUTH" })) as Record<string, unknown>;
    expect(before.sessionState).toBe("logged_out");
    expect(before.hasUser).toBe(false);

    // Simulate content script capturing auth headers
    await seedAuth(storage);

    // After auth — should be logged_in
    const after = (await send(fakeChrome, { type: "CHECK_AUTH" })) as Record<string, unknown>;
    expect(after.sessionState).toBe("logged_in");
    expect(after.hasUser).toBe(true);
    expect(after.userId).toBe("12345");
    expect(after.hasAuth).toBe(true);
  });

  it("GET_RUNTIME_SNAPSHOT returns full snapshot with sync policy", async () => {
    const { storage } = setupFullRouter(fakeChrome);
    await seedAuth(storage);

    const result = (await send(fakeChrome, { type: "GET_RUNTIME_SNAPSHOT" })) as {
      ok: boolean;
      data: Record<string, unknown>;
    };
    expect(result.ok).toBe(true);
    expect(result.data.sessionState).toBe("logged_in");
    expect(result.data.authPhase).toBe("ready");
    expect(result.data.accountContextId).toBe("12345");
    expect(result.data.syncPolicy).toBeTruthy();
  });

  it("SESSION_USER_MISSING clears user and transitions to logged_out", async () => {
    const { storage } = setupFullRouter(fakeChrome);
    await seedAuth(storage);

    // Verify logged in first
    const before = (await send(fakeChrome, { type: "CHECK_AUTH" })) as Record<string, unknown>;
    expect(before.sessionState).toBe("logged_in");

    // Content script reports user missing
    await send(fakeChrome, { type: "SESSION_USER_MISSING" });

    // Auth state should reflect logged_out
    const stored = await storage.get(["totem_auth_state"]);
    expect(stored.totem_auth_state).toBe("logged_out");
  });
});

// ═══════════════════════════════════════════════════════════════
// 2. Sync reservation → completion → cooldown
// ═══════════════════════════════════════════════════════════════

describe("sync reservation → reconcile → completion → cooldown", () => {
  it("full lifecycle: reserve → complete success → cooldown blocks manual", async () => {
    const { storage } = setupFullRouter(fakeChrome);
    await seedAuth(storage);

    // Reserve a manual sync
    const reserve = (await send(fakeChrome, {
      type: "REQUEST_SYNC",
      trigger: "manual",
      localCount: 10,
      accountId: "12345",
    })) as Record<string, unknown>;

    expect(reserve.ok).toBe(true);
    expect(reserve.allow).toBe(true);
    // Fresh orchestrator state (lastFullSyncAt === 0) → self-heal forces full.
    expect(reserve.mode).toBe("full");
    expect(reserve.leaseId).toBeTruthy();
    const leaseId = reserve.leaseId as string;

    // Complete the sync successfully
    const complete = (await send(fakeChrome, {
      type: "COMPLETE_SYNC",
      accountId: "12345",
      leaseId,
      trigger: "manual",
      mode: "full",
      status: "success",
    })) as Record<string, unknown>;

    expect(complete.ok).toBe(true);

    // Cooldown should block next manual sync
    const blocked = (await send(fakeChrome, {
      type: "REQUEST_SYNC",
      trigger: "manual",
      localCount: 10,
      accountId: "12345",
    })) as Record<string, unknown>;

    expect(blocked.ok).toBe(true);
    expect(blocked.allow).toBe(false);
    expect(blocked.reason).toBe("cooldown");
  });

  it("in-flight lease blocks concurrent reservation", async () => {
    const { storage } = setupFullRouter(fakeChrome);
    await seedAuth(storage);

    // First reservation
    const first = (await send(fakeChrome, {
      type: "REQUEST_SYNC",
      trigger: "auto",
      localCount: 0,
      accountId: "12345",
    })) as Record<string, unknown>;
    expect(first.allow).toBe(true);

    // Second reservation should be blocked (in_flight)
    const second = (await send(fakeChrome, {
      type: "REQUEST_SYNC",
      trigger: "auto",
      localCount: 0,
      accountId: "12345",
    })) as Record<string, unknown>;
    expect(second.allow).toBe(false);
    expect(second.reason).toBe("in_flight");
  });

  it("failed sync with RATE_LIMITED sets backoff", async () => {
    const { storage } = setupFullRouter(fakeChrome);
    await seedAuth(storage);

    const reserve = (await send(fakeChrome, {
      type: "REQUEST_SYNC",
      trigger: "manual",
      localCount: 10,
      accountId: "12345",
    })) as Record<string, unknown>;
    const leaseId = reserve.leaseId as string;

    // Complete with rate limit error
    await send(fakeChrome, {
      type: "COMPLETE_SYNC",
      accountId: "12345",
      leaseId,
      trigger: "manual",
      mode: "quick",
      status: "failure",
      errorCode: "RATE_LIMITED",
    });

    // Next request should be blocked by rate limit
    const blocked = (await send(fakeChrome, {
      type: "REQUEST_SYNC",
      trigger: "manual",
      localCount: 10,
      accountId: "12345",
    })) as Record<string, unknown>;
    expect(blocked.allow).toBe(false);
    expect(blocked.reason).toBe("rate_limited");
  });
});

// ═══════════════════════════════════════════════════════════════
// 3. Bookmark event capture → queue → process → ack
// ═══════════════════════════════════════════════════════════════

describe("bookmark event capture → queue → process → ack", () => {
  it("full pipeline: push delete → get events → ack → empty queue", async () => {
    setupFullRouter(fakeChrome);

    // Push a delete event
    await send(fakeChrome, {
      type: "BOOKMARK_MUTATION",
      operation: "DeleteBookmark",
      tweetId: "111",
      source: "content-script",
    });

    // Push another delete
    await send(fakeChrome, {
      type: "BOOKMARK_MUTATION",
      operation: "DeleteBookmark",
      tweetId: "222",
      source: "content-script",
    });

    // Get events
    const events = (await send(fakeChrome, {
      type: "GET_BOOKMARK_EVENTS",
    })) as { data: { events: Array<{ id: string; type: string; tweetId: string }> } };

    expect(events.data.events).toHaveLength(2);
    expect(events.data.events[0].tweetId).toBe("111");
    expect(events.data.events[1].tweetId).toBe("222");

    // Ack first event
    const ackResult = (await send(fakeChrome, {
      type: "ACK_BOOKMARK_EVENTS",
      ids: [events.data.events[0].id],
    })) as { data: { removed: number; remaining: number } };

    expect(ackResult.data.removed).toBe(1);
    expect(ackResult.data.remaining).toBe(1);

    // Ack second event
    const ackResult2 = (await send(fakeChrome, {
      type: "ACK_BOOKMARK_EVENTS",
      ids: [events.data.events[1].id],
    })) as { data: { removed: number; remaining: number } };

    expect(ackResult2.data.removed).toBe(1);
    expect(ackResult2.data.remaining).toBe(0);
  });

  it("CreateBookmark requires confirmed=true to enqueue", async () => {
    setupFullRouter(fakeChrome);

    // Unconfirmed create — should NOT enqueue
    await send(fakeChrome, {
      type: "BOOKMARK_MUTATION",
      operation: "CreateBookmark",
      tweetId: "333",
      source: "content-script",
      confirmed: false,
    });

    const noEvents = (await send(fakeChrome, {
      type: "GET_BOOKMARK_EVENTS",
    })) as { data: { events: unknown[] } };
    expect(noEvents.data.events).toHaveLength(0);

    // Confirmed create — SHOULD enqueue
    await send(fakeChrome, {
      type: "BOOKMARK_MUTATION",
      operation: "CreateBookmark",
      tweetId: "333",
      source: "content-script",
      confirmed: true,
    });

    const events = (await send(fakeChrome, {
      type: "GET_BOOKMARK_EVENTS",
    })) as { data: { events: Array<{ type: string }> } };
    expect(events.data.events).toHaveLength(1);
    expect(events.data.events[0].type).toBe("CreateBookmark");
  });

  it("mixed creates and deletes maintain correct order", async () => {
    setupFullRouter(fakeChrome);

    await send(fakeChrome, {
      type: "BOOKMARK_MUTATION",
      operation: "DeleteBookmark",
      tweetId: "100",
      source: "test",
    });
    await send(fakeChrome, {
      type: "BOOKMARK_MUTATION",
      operation: "CreateBookmark",
      tweetId: "200",
      source: "test",
      confirmed: true,
    });
    await send(fakeChrome, {
      type: "BOOKMARK_MUTATION",
      operation: "DeleteBookmark",
      tweetId: "300",
      source: "test",
    });

    const events = (await send(fakeChrome, {
      type: "GET_BOOKMARK_EVENTS",
    })) as { data: { events: Array<{ type: string; tweetId: string }> } };

    expect(events.data.events).toHaveLength(3);
    expect(events.data.events.map((e) => e.tweetId)).toEqual(["100", "200", "300"]);
  });
});

// ═══════════════════════════════════════════════════════════════
// 4. Query ID resolution integrates with sync and API proxy
// ═══════════════════════════════════════════════════════════════

describe("query ID resolution during sync", () => {
  it("STORE_QUERY_IDS makes IDs available for subsequent operations", async () => {
    setupFullRouter(fakeChrome);

    // Store query IDs (simulates content script capturing from traffic)
    const storeResult = (await send(fakeChrome, {
      type: "STORE_QUERY_IDS",
      ids: {
        Bookmarks: "abc123",
        DeleteBookmark: "def456",
        TweetDetail: "ghi789",
      },
    })) as { ok: boolean };
    expect(storeResult.ok).toBe(true);

    // Verify via DISCOVER_QUERY_IDS (should be a no-op since all are cached)
    const discoverResult = (await send(fakeChrome, {
      type: "DISCOVER_QUERY_IDS",
    })) as { ok: boolean };
    expect(discoverResult.ok).toBe(true);
  });

  it("passive catalog capture populates query IDs", async () => {
    const { storage } = setupFullRouter(fakeChrome);

    // Simulate passive traffic capture
    await captureGraphqlEndpoint(
      { url: "https://x.com/i/api/graphql/abc123/Bookmarks?variables=%7B%7D", method: "GET" },
      storage,
    );

    // Load catalog and verify
    const catalog = await loadGraphqlCatalog(storage);
    const entries = Object.values(catalog.endpoints);
    expect(entries.length).toBeGreaterThan(0);
    expect(entries[0].operation).toBe("Bookmarks");
    expect(entries[0].queryId).toBe("abc123");
  });

  it("query IDs persist across catalog load/store cycle", async () => {
    const { storage } = setupFullRouter(fakeChrome);

    // Capture an endpoint
    await captureGraphqlEndpoint(
      { url: "https://x.com/i/api/graphql/xyz999/TweetDetail?variables=%7B%7D", method: "GET" },
      storage,
    );

    // Force flush (since scheduleCatalogFlush uses setTimeout)
    const { flushGraphqlCatalog } = await import("../query-id");
    await flushGraphqlCatalog(storage);

    // Reset in-memory state and reload from storage
    resetQueryId();
    const catalog = await loadGraphqlCatalog(storage);
    const entries = Object.values(catalog.endpoints);
    const tweetDetailEntry = entries.find((e) => e.operation === "TweetDetail");
    expect(tweetDetailEntry).toBeTruthy();
    expect(tweetDetailEntry!.queryId).toBe("xyz999");
  });
});

// ═══════════════════════════════════════════════════════════════
// 5. Cross-slice: auth→sync→bookmarks full flow
// ═══════════════════════════════════════════════════════════════

describe("cross-slice auth→sync→bookmarks flow", () => {
  it("auth ready enables sync, which enables bookmark operations", async () => {
    const { storage } = setupFullRouter(fakeChrome);

    // Step 1: No auth → sync blocked
    const blockedSync = (await send(fakeChrome, {
      type: "REQUEST_SYNC",
      trigger: "auto",
      localCount: 0,
      accountId: "12345",
    })) as Record<string, unknown>;
    expect(blockedSync.allow).toBe(false);
    expect(blockedSync.reason).toBe("not_ready");

    // Step 2: Auth capture
    await seedAuth(storage);

    // Step 3: Verify auth is ready
    const authStatus = (await send(fakeChrome, { type: "CHECK_AUTH" })) as Record<string, unknown>;
    expect(authStatus.sessionState).toBe("logged_in");

    // Step 4: Sync now allowed
    const allowedSync = (await send(fakeChrome, {
      type: "REQUEST_SYNC",
      trigger: "auto",
      localCount: 0,
      accountId: "12345",
    })) as Record<string, unknown>;
    expect(allowedSync.allow).toBe(true);
    expect(allowedSync.mode).toBe("full"); // bootstrap (localCount=0)

    // Step 5: During sync, bookmark events can be captured
    await send(fakeChrome, {
      type: "BOOKMARK_MUTATION",
      operation: "CreateBookmark",
      tweetId: "10001",
      source: "content-script",
      confirmed: true,
    });
    await send(fakeChrome, {
      type: "BOOKMARK_MUTATION",
      operation: "DeleteBookmark",
      tweetId: "10002",
      source: "content-script",
    });

    const events = (await send(fakeChrome, {
      type: "GET_BOOKMARK_EVENTS",
    })) as { data: { events: Array<{ id: string; type: string; tweetId: string }> } };
    expect(events.data.events).toHaveLength(2);

    // Step 6: Complete sync
    const leaseId = allowedSync.leaseId as string;
    const completed = (await send(fakeChrome, {
      type: "COMPLETE_SYNC",
      accountId: "12345",
      leaseId,
      trigger: "auto",
      mode: "full",
      status: "success",
    })) as Record<string, unknown>;
    expect(completed.ok).toBe(true);

    // Step 7: Ack bookmark events (simulates post-sync event processing)
    const eventIds = events.data.events.map((e) => e.id);
    const acked = (await send(fakeChrome, {
      type: "ACK_BOOKMARK_EVENTS",
      ids: eventIds,
    })) as { data: { removed: number; remaining: number } };
    expect(acked.data.removed).toBe(2);
    expect(acked.data.remaining).toBe(0);
  });

  it("auth loss mid-flow blocks subsequent sync reservations", async () => {
    const { storage } = setupFullRouter(fakeChrome);
    await seedAuth(storage);

    // Sync works when authed
    const first = (await send(fakeChrome, {
      type: "REQUEST_SYNC",
      trigger: "manual",
      localCount: 5,
      accountId: "12345",
    })) as Record<string, unknown>;
    expect(first.allow).toBe(true);

    // Complete it
    await send(fakeChrome, {
      type: "COMPLETE_SYNC",
      accountId: "12345",
      leaseId: first.leaseId as string,
      trigger: "manual",
      mode: "quick",
      status: "success",
    });

    // Simulate auth loss (content script reports SESSION_USER_MISSING)
    await send(fakeChrome, { type: "SESSION_USER_MISSING" });

    // Wait for cooldown to not interfere — auth loss should be the blocker
    // Force-clear cooldown by writing directly
    const orchestratorState = await storage.get(["totem_sync_orchestrator_state"]);
    const state = orchestratorState.totem_sync_orchestrator_state as Record<string, unknown>;
    if (state && typeof state === "object" && (state as { accounts?: Record<string, unknown> }).accounts) {
      const accounts = (state as { accounts: Record<string, { manualCooldownUntil?: number }> }).accounts;
      for (const key of Object.keys(accounts)) {
        accounts[key].manualCooldownUntil = 0;
      }
      await storage.set({ totem_sync_orchestrator_state: state });
    }

    // Sync should now be blocked due to auth loss
    const blocked = (await send(fakeChrome, {
      type: "REQUEST_SYNC",
      trigger: "manual",
      localCount: 5,
      accountId: "12345",
    })) as Record<string, unknown>;
    expect(blocked.allow).toBe(false);
    expect(blocked.reason).toBe("not_ready");
  });

  it("multiple message types can be interleaved correctly", async () => {
    const { storage } = setupFullRouter(fakeChrome);
    await seedAuth(storage);

    // Interleave auth checks, event pushes, and sync operations
    const [authResult, eventResult, syncResult] = await Promise.all([
      send(fakeChrome, { type: "CHECK_AUTH" }),
      send(fakeChrome, {
        type: "BOOKMARK_MUTATION",
        operation: "DeleteBookmark",
        tweetId: "999",
        source: "test",
      }),
      send(fakeChrome, {
        type: "REQUEST_SYNC",
        trigger: "auto",
        localCount: 0,
        accountId: "12345",
      }),
    ]);

    expect((authResult as Record<string, unknown>).sessionState).toBe("logged_in");
    expect((eventResult as Record<string, unknown>).ok).toBe(true);
    expect((syncResult as Record<string, unknown>).allow).toBe(true);
  });
});
