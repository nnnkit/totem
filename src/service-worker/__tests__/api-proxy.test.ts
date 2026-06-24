/**
 * API proxy auth-expiry policy tests.
 *
 * Exercises `withAuthedRequest` — the single seam every X API handler routes
 * through — via the public handler map, with a scripted `fetchFn` and an
 * injected `reAuth`. Locks the 401/403 → clear → one silent retry → logout
 * policy and the session-marking side effects that were previously copy-pasted
 * and untested across four handlers.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeChrome } from "../../test-utils/fake-chrome";
import { createApiProxyHandlers } from "../api-proxy";
import { AuthExpiredError, RateLimitError, _resetForTesting as resetQueryId } from "../query-id";
import { _resetForTesting as resetAuth } from "../auth";
import type { MessageRequest } from "../../types/messages";

let fakeChrome: ReturnType<typeof createFakeChrome>;

function storage(): typeof chrome.storage.local {
  return fakeChrome.storage.local as unknown as typeof chrome.storage.local;
}

async function seedCatalog(pairs: Array<[string, string]>) {
  const now = Date.now();
  const endpoints: Record<string, unknown> = {};
  for (const [operation, queryId] of pairs) {
    const key = `${operation}:${queryId}`;
    endpoints[key] = {
      key,
      operation,
      queryId,
      path: `/i/api/graphql/${queryId}/${operation}`,
      firstSeen: now,
      lastSeen: now,
      seenCount: 1,
      methods: ["GET"],
      sampleUrl: `https://x.com/i/api/graphql/${queryId}/${operation}`,
      sampleVariables: null,
      sampleFeatures: null,
      sampleFieldToggles: null,
    };
  }
  await storage().set({
    totem_graphql_catalog: { version: 1, updatedAt: now, endpoints },
  });
}

async function seedAuth() {
  await storage().set({
    totem_user_id: "12345",
    totem_auth_headers: {
      authorization: "Bearer AAAA",
      "x-csrf-token": "csrf-token-123",
      cookie: 'twid="u%3D12345"; ct0=csrf-token-123; auth_token=abc123',
    },
    totem_auth_state: "authenticated",
    totem_auth_state_at: Date.now(),
  });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function makeHandlers(over: {
  fetchFn: ReturnType<typeof vi.fn>;
  reAuth?: ReturnType<typeof vi.fn>;
}) {
  return createApiProxyHandlers({
    storage: storage(),
    tabs: fakeChrome.tabs as unknown as typeof chrome.tabs,
    fetchFn: over.fetchFn as unknown as typeof fetch,
    reAuth: over.reAuth as unknown as (() => Promise<boolean>) | undefined,
  });
}

const BOOKMARKS_MSG = { type: "FETCH_BOOKMARKS" } as unknown as MessageRequest;
const SENDER = {} as chrome.runtime.MessageSender;

beforeEach(async () => {
  fakeChrome = createFakeChrome();
  resetQueryId();
  resetAuth();
  (globalThis as Record<string, unknown>).chrome = fakeChrome;
  await seedCatalog([
    ["Bookmarks", "QID_BM"],
    ["UserByRestId", "QID_VP"],
  ]);
});

afterEach(() => {
  delete (globalThis as Record<string, unknown>).chrome;
});

describe("api-proxy auth-expiry policy", () => {
  it("returns data and marks the session authenticated on success", async () => {
    await seedAuth();
    const fetchFn = vi.fn().mockResolvedValue(
      jsonResponse({ data: { bookmark_timeline_v2: {} } }),
    );
    const handlers = makeHandlers({ fetchFn });

    const result = await handlers.FETCH_BOOKMARKS!(BOOKMARKS_MSG, SENDER);

    expect(result).toEqual({ data: { data: { bookmark_timeline_v2: {} } } });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const after = await storage().get([
      "totem_auth_state",
      "totem_auth_state_reason",
    ]);
    expect(after.totem_auth_state).toBe("authenticated");
    expect(after.totem_auth_state_reason).toBe("bookmarks_ok");
  });

  it("throws NO_AUTH without fetching when no headers are captured", async () => {
    const fetchFn = vi.fn();
    const handlers = makeHandlers({ fetchFn });

    await expect(handlers.FETCH_BOOKMARKS!(BOOKMARKS_MSG, SENDER)).rejects.toThrow(
      "NO_AUTH",
    );
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("clears headers, logs out, and throws on 401 when re-auth fails", async () => {
    await seedAuth();
    const fetchFn = vi.fn().mockResolvedValue(new Response("", { status: 401 }));
    const reAuth = vi.fn().mockResolvedValue(false);
    const handlers = makeHandlers({ fetchFn, reAuth });

    await expect(handlers.FETCH_BOOKMARKS!(BOOKMARKS_MSG, SENDER)).rejects.toBeInstanceOf(
      AuthExpiredError,
    );
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(reAuth).toHaveBeenCalledTimes(1);
    const after = await storage().get([
      "totem_auth_state",
      "totem_auth_state_reason",
      "totem_auth_headers",
    ]);
    expect(after.totem_auth_state).toBe("logged_out");
    expect(after.totem_auth_state_reason).toBe("bookmarks_401");
    expect(after.totem_auth_headers).toBeUndefined();
  });

  it("retries once after a successful silent re-auth on 401", async () => {
    await seedAuth();
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 401 }))
      .mockResolvedValueOnce(jsonResponse({ data: { ok: true } }));
    // A successful silent re-auth re-captures credentials into storage.
    const reAuth = vi.fn().mockImplementation(async () => {
      await seedAuth();
      return true;
    });
    const handlers = makeHandlers({ fetchFn, reAuth });

    const result = await handlers.FETCH_BOOKMARKS!(BOOKMARKS_MSG, SENDER);

    expect(result).toEqual({ data: { data: { ok: true } } });
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(reAuth).toHaveBeenCalledTimes(1);
    const after = await storage().get(["totem_auth_state"]);
    expect(after.totem_auth_state).toBe("authenticated");
  });

  it("logs out after a single retry when 401 persists", async () => {
    await seedAuth();
    const fetchFn = vi.fn().mockResolvedValue(new Response("", { status: 403 }));
    const reAuth = vi.fn().mockImplementation(async () => {
      await seedAuth();
      return true;
    });
    const handlers = makeHandlers({ fetchFn, reAuth });

    await expect(handlers.FETCH_BOOKMARKS!(BOOKMARKS_MSG, SENDER)).rejects.toBeInstanceOf(
      AuthExpiredError,
    );
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(reAuth).toHaveBeenCalledTimes(1);
    const after = await storage().get(["totem_auth_state_reason"]);
    expect(after.totem_auth_state_reason).toBe("bookmarks_403");
  });

  it("treats 429 as a rate limit, not an auth failure", async () => {
    await seedAuth();
    const fetchFn = vi.fn().mockResolvedValue(new Response("", { status: 429 }));
    const reAuth = vi.fn().mockResolvedValue(false);
    const handlers = makeHandlers({ fetchFn, reAuth });

    await expect(handlers.FETCH_BOOKMARKS!(BOOKMARKS_MSG, SENDER)).rejects.toBeInstanceOf(
      RateLimitError,
    );
    expect(reAuth).not.toHaveBeenCalled();
    const after = await storage().get(["totem_auth_state"]);
    expect(after.totem_auth_state).toBe("authenticated");
  });

  it("applies the same auth-expiry policy to the viewer-profile fetch", async () => {
    await seedAuth();
    const fetchFn = vi.fn().mockResolvedValue(new Response("", { status: 401 }));
    const reAuth = vi.fn().mockResolvedValue(false);
    const handlers = makeHandlers({ fetchFn, reAuth });

    await expect(
      handlers.FETCH_VIEWER_PROFILE!(
        { type: "FETCH_VIEWER_PROFILE" } as unknown as MessageRequest,
        SENDER,
      ),
    ).rejects.toBeInstanceOf(AuthExpiredError);
    const after = await storage().get([
      "totem_auth_state",
      "totem_auth_state_reason",
    ]);
    expect(after.totem_auth_state).toBe("logged_out");
    expect(after.totem_auth_state_reason).toBe("viewer_401");
  });
});
