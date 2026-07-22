import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeChrome } from "../../test-utils/fake-chrome";
import {
  _resetForTesting,
  createAuthHandlers,
  getAuthDiagnosticLog,
  getSessionSnapshot,
  deriveAuthPhaseFromSession,
  markAuthAuthenticated,
  startAuthCaptureSession,
  type AuthDeps,
} from "../auth";
import { CS_ACCOUNT_CONTEXT_ID } from "../../lib/storage-keys";
import {
  createMessageRouter,
  handleTwidCookieChange,
  mergeHandlerMaps,
} from "../index";

// ── Helpers ─────────────────────────────────────────────────────

function makeDeps(
  fakeChrome: ReturnType<typeof createFakeChrome>,
): AuthDeps {
  return {
    storage: fakeChrome.storage.local as unknown as typeof chrome.storage.local,
    tabs: fakeChrome.tabs as unknown as typeof chrome.tabs,
  };
}

function twidCookies(): typeof chrome.cookies {
  return {
    get: async ({ name }: { name: string }) =>
      name === "twid" ? { value: "u%3D777" } : null,
  } as unknown as typeof chrome.cookies;
}

function makeDepsWithTwid(
  fakeChrome: ReturnType<typeof createFakeChrome>,
): AuthDeps {
  return { ...makeDeps(fakeChrome), cookies: twidCookies() };
}

function setupRouter(fakeChrome: ReturnType<typeof createFakeChrome>) {
  const deps = makeDeps(fakeChrome);
  const handlers = createAuthHandlers(deps);
  const router = createMessageRouter(mergeHandlerMaps(handlers));
  fakeChrome.runtime.onMessage.addListener(router);
  return { deps, handlers };
}

function makeTwidCookieChange(
  overrides: Partial<chrome.cookies.CookieChangeInfo>,
): chrome.cookies.CookieChangeInfo {
  const { cookie: cookieOverrides, ...rest } = overrides;
  const cookie: chrome.cookies.Cookie = {
    domain: ".x.com",
    name: "twid",
    storeId: "0",
    value: "u%3D777",
    session: true,
    hostOnly: false,
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "unspecified",
    ...cookieOverrides,
  };

  return {
    removed: false,
    cause: "explicit",
    cookie,
    ...rest,
  };
}

function makeCookies(twidValue: string | null): typeof chrome.cookies {
  return {
    get: async () =>
      twidValue
        ? ({
            domain: ".x.com",
            name: "twid",
            storeId: "0",
            value: twidValue,
            session: true,
            hostOnly: false,
            path: "/",
            httpOnly: true,
            secure: true,
            sameSite: "unspecified",
          } as chrome.cookies.Cookie)
        : null,
  } as unknown as typeof chrome.cookies;
}

// ── Tests ───────────────────────────────────────────────────────

describe("auth module", () => {
  let fakeChrome: ReturnType<typeof createFakeChrome>;

  beforeEach(() => {
    fakeChrome = createFakeChrome();
    _resetForTesting();
  });

  // ── getSessionSnapshot ──────────────────────────────────────

  describe("getSessionSnapshot", () => {
    it("returns logged_out when no auth data exists", async () => {
      const storage = fakeChrome.storage
        .local as unknown as typeof chrome.storage.local;
      const snapshot = await getSessionSnapshot(storage);
      // With no stored state and no auth header, normalizeAuthState returns "logged_out"
      expect(snapshot.sessionState).toBe("logged_out");
      expect(snapshot.userId).toBeNull();
      expect(snapshot.hasAuthHeader).toBe(false);
    });

    it("returns logged_in when auth headers are present and state is authenticated", async () => {
      const storage = fakeChrome.storage
        .local as unknown as typeof chrome.storage.local;
      await storage.set({
        totem_user_id: "12345",
        totem_account_context_id: "12345",
        totem_auth_headers: {
          authorization: "Bearer token123",
          "x-csrf-token": "csrf456",
          cookie: "twid=u%3D12345; ct0=csrf456",
        },
        totem_auth_state: "authenticated",
      });

      const snapshot = await getSessionSnapshot(storage);
      expect(snapshot.sessionState).toBe("logged_in");
      expect(snapshot.userId).toBe("12345");
      expect(snapshot.hasAuthHeader).toBe(true);
      expect(snapshot.capability.bookmarksApi).toBe("ready");
    });

    it("extracts userId from cookie when totem_user_id is missing", async () => {
      const storage = fakeChrome.storage
        .local as unknown as typeof chrome.storage.local;
      await storage.set({
        totem_auth_headers: {
          authorization: "Bearer token",
          "x-csrf-token": "csrf",
          cookie: "twid=u%3D9999; ct0=csrf",
        },
        totem_auth_state: "stale",
      });

      const snapshot = await getSessionSnapshot(storage);
      expect(snapshot.userId).toBe("9999");
      expect(snapshot.sessionState).toBe("logged_in");
    });

    it("returns logged_out when auth state is logged_out", async () => {
      const storage = fakeChrome.storage
        .local as unknown as typeof chrome.storage.local;
      await storage.set({
        totem_auth_state: "logged_out",
      });

      const snapshot = await getSessionSnapshot(storage);
      expect(snapshot.sessionState).toBe("logged_out");
      expect(snapshot.authState).toBe("logged_out");
    });

    it("does not report ready when auth state is authenticated but headers are missing", async () => {
      const storage = fakeChrome.storage
        .local as unknown as typeof chrome.storage.local;
      await storage.set({
        totem_auth_state: "authenticated",
      });

      const snapshot = await getSessionSnapshot(storage, makeCookies(null));

      expect(snapshot.sessionState).not.toBe("logged_in");
      expect(snapshot.hasAuthHeader).toBe(false);
    });

    it("returns connecting when X has a live twid but auth headers have not been captured yet", async () => {
      const storage = fakeChrome.storage
        .local as unknown as typeof chrome.storage.local;

      const snapshot = await getSessionSnapshot(
        storage,
        makeCookies("u%3D555"),
      );

      expect(snapshot.sessionState).toBe("unknown");
      expect(snapshot.authState).toBe("stale");
      expect(snapshot.userId).toBe("555");
      expect(snapshot.accountContextId).toBe("555");
      expect(snapshot.hasAuthHeader).toBe(false);
    });

    it("invalidates preserved auth headers when the live twid cookie is gone", async () => {
      const storage = fakeChrome.storage
        .local as unknown as typeof chrome.storage.local;
      await storage.set({
        totem_user_id: "12345",
        totem_account_context_id: "12345",
        totem_auth_headers: {
          authorization: "Bearer old",
          "x-csrf-token": "csrf",
          cookie: "twid=u%3D12345; ct0=csrf",
        },
        totem_auth_state: "authenticated",
      });

      const snapshot = await getSessionSnapshot(storage, makeCookies(null));
      expect(snapshot.sessionState).toBe("logged_out");
      expect(snapshot.hasAuthHeader).toBe(false);

      const stored = await storage.get([
        "totem_auth_headers",
        "totem_auth_state",
        "totem_auth_state_reason",
      ]);

      expect(stored.totem_auth_headers).toBeUndefined();
      expect(stored.totem_auth_state).toBe("logged_out");
      expect(stored.totem_auth_state_reason).toBe("live_twid_mismatch");
    });

    it("invalidates preserved auth headers when the live twid belongs to a different account", async () => {
      const storage = fakeChrome.storage
        .local as unknown as typeof chrome.storage.local;
      await storage.set({
        totem_user_id: "12345",
        totem_account_context_id: "12345",
        totem_auth_headers: {
          authorization: "Bearer old",
          "x-csrf-token": "csrf",
          cookie: "twid=u%3D12345; ct0=csrf",
        },
        totem_auth_state: "authenticated",
      });

      const snapshot = await getSessionSnapshot(
        storage,
        makeCookies("u%3D99999"),
      );

      expect(snapshot.sessionState).toBe("unknown");
      expect(snapshot.userId).toBe("99999");
      expect(snapshot.accountContextId).toBe("99999");
      expect(snapshot.hasAuthHeader).toBe(false);
    });
  });

  // ── deriveAuthPhaseFromSession ──────────────────────────────

  describe("deriveAuthPhaseFromSession", () => {
    it("maps logged_out to need_login", () => {
      expect(deriveAuthPhaseFromSession("logged_out")).toBe("need_login");
    });

    it("maps logged_in to ready", () => {
      expect(deriveAuthPhaseFromSession("logged_in")).toBe("ready");
    });

    it("maps unknown to connecting", () => {
      expect(deriveAuthPhaseFromSession("unknown")).toBe("connecting");
    });
  });

  // ── CHECK_AUTH handler ──────────────────────────────────────

  describe("CHECK_AUTH handler", () => {
    it("returns auth status for authenticated user", async () => {
      const storage = fakeChrome.storage
        .local as unknown as typeof chrome.storage.local;
      await storage.set({
        totem_user_id: "42",
        totem_account_context_id: "42",
        totem_auth_headers: {
          authorization: "Bearer token",
          "x-csrf-token": "csrf",
          cookie: "twid=u%3D42; ct0=csrf",
        },
        totem_auth_state: "authenticated",
      });

      setupRouter(fakeChrome);

      const response = (await fakeChrome.runtime.sendMessage({
        type: "CHECK_AUTH",
      })) as Record<string, unknown>;

      expect(response.hasUser).toBe(true);
      expect(response.hasAuth).toBe(true);
      expect(response.userId).toBe("42");
      expect(response.sessionState).toBe("logged_in");
      expect(response.authState).toBe("authenticated");
      expect(response.capability).toEqual({
        bookmarksApi: "ready",
        detailApi: "unknown",
      });
    });

    it("returns no-auth status for logged out user", async () => {
      const storage = fakeChrome.storage
        .local as unknown as typeof chrome.storage.local;
      await storage.set({
        totem_auth_state: "logged_out",
      });

      setupRouter(fakeChrome);

      const response = (await fakeChrome.runtime.sendMessage({
        type: "CHECK_AUTH",
      })) as Record<string, unknown>;

      expect(response.hasUser).toBe(false);
      expect(response.hasAuth).toBe(false);
      expect(response.userId).toBeNull();
      expect(response.sessionState).toBe("logged_out");
    });

    it("writes diagnostic entry on CHECK_AUTH", async () => {
      setupRouter(fakeChrome);
      await fakeChrome.runtime.sendMessage({ type: "CHECK_AUTH" });

      const log = getAuthDiagnosticLog();
      expect(log.some((e) => e.stage === "frontend_receipt")).toBe(true);
    });
  });

  describe("twid cookie changes", () => {
    it("keeps auth when Chrome reports a twid overwrite during cookie refresh", async () => {
      const storage = fakeChrome.storage
        .local as unknown as typeof chrome.storage.local;
      await storage.set({
        totem_user_id: "777",
        totem_account_context_id: "777",
        totem_auth_headers: {
          authorization: "Bearer real_token",
          "x-csrf-token": "real_csrf",
          cookie: "twid=u%3D777; ct0=real_csrf",
        },
        totem_auth_state: "authenticated",
        totem_auth_state_reason: "headers_trio",
      });

      await handleTwidCookieChange(
        makeTwidCookieChange({ removed: true, cause: "overwrite" }),
        storage,
      );

      const stored = await storage.get([
        "totem_auth_headers",
        "totem_auth_state",
        "totem_auth_state_reason",
      ]);
      expect(stored.totem_auth_state).toBe("authenticated");
      expect(stored.totem_auth_state_reason).toBe("headers_trio");
      expect(stored.totem_auth_headers).toBeDefined();
    });

    it("logs out when the twid cookie is explicitly removed", async () => {
      const storage = fakeChrome.storage
        .local as unknown as typeof chrome.storage.local;
      await storage.set({
        totem_user_id: "777",
        totem_account_context_id: "777",
        totem_auth_headers: {
          authorization: "Bearer real_token",
          "x-csrf-token": "real_csrf",
          cookie: "twid=u%3D777; ct0=real_csrf",
        },
        totem_auth_state: "authenticated",
        totem_auth_state_reason: "headers_trio",
      });

      await handleTwidCookieChange(
        makeTwidCookieChange({ removed: true, cause: "explicit" }),
        storage,
      );

      const stored = await storage.get([
        "totem_auth_headers",
        "totem_auth_state",
        "totem_auth_state_reason",
      ]);
      expect(stored.totem_auth_state).toBe("logged_out");
      expect(stored.totem_auth_state_reason).toBe("cookie_twid_explicit");
      expect(stored.totem_auth_headers).toBeUndefined();
    });
  });

  // ── GET_RUNTIME_SNAPSHOT handler ────────────────────────────

  describe("GET_RUNTIME_SNAPSHOT handler", () => {
    it("returns full runtime snapshot", async () => {
      const storage = fakeChrome.storage
        .local as unknown as typeof chrome.storage.local;
      await storage.set({
        totem_user_id: "100",
        totem_account_context_id: "100",
        totem_auth_headers: {
          authorization: "Bearer token",
          "x-csrf-token": "csrf",
          cookie: "twid=u%3D100; ct0=csrf",
        },
        totem_auth_state: "authenticated",
      });

      setupRouter(fakeChrome);

      const response = (await fakeChrome.runtime.sendMessage({
        type: "GET_RUNTIME_SNAPSHOT",
      })) as { ok: boolean; data: Record<string, unknown> };

      expect(response.ok).toBe(true);
      expect(response.data.sessionState).toBe("logged_in");
      expect(response.data.authPhase).toBe("ready");
      expect(response.data.accountContextId).toBe("100");
      expect(response.data.capability).toEqual({
        bookmarksApi: "ready",
        detailApi: "unknown",
      });
      expect(response.data.syncPolicy).toBeDefined();
      expect(response.data.cacheSummary).toBeDefined();
    });

    it("persists runtime state v2 to storage", async () => {
      const storage = fakeChrome.storage
        .local as unknown as typeof chrome.storage.local;
      await storage.set({
        totem_user_id: "200",
        totem_account_context_id: "200",
        totem_auth_state: "authenticated",
        totem_auth_headers: {
          authorization: "Bearer t",
          "x-csrf-token": "c",
          cookie: "twid=u%3D200; ct0=c",
        },
      });

      setupRouter(fakeChrome);
      await fakeChrome.runtime.sendMessage({ type: "GET_RUNTIME_SNAPSHOT" });

      const stored = await storage.get(["totem_runtime_state_v2"]);
      expect(stored.totem_runtime_state_v2).toBeDefined();
      expect(
        (stored.totem_runtime_state_v2 as Record<string, unknown>)
          .sessionState,
      ).toBe("logged_in");
    });

    it("returns snapshot with specific accountId", async () => {
      const storage = fakeChrome.storage
        .local as unknown as typeof chrome.storage.local;
      await storage.set({
        totem_user_id: "300",
        totem_account_context_id: "300",
        totem_auth_state: "authenticated",
        totem_auth_headers: {
          authorization: "Bearer t",
          "x-csrf-token": "c",
          cookie: "twid=u%3D300",
        },
      });

      setupRouter(fakeChrome);
      const response = (await fakeChrome.runtime.sendMessage({
        type: "GET_RUNTIME_SNAPSHOT",
        accountId: "999",
      })) as { ok: boolean; data: Record<string, unknown> };

      expect(response.ok).toBe(true);
      expect(response.data.accountContextId).toBe("999");
    });
  });

  // ── SESSION_USER_MISSING handler ────────────────────────────

  describe("SESSION_USER_MISSING handler", () => {
    it("removes user ID and sets logged_out when no auth headers", async () => {
      const storage = fakeChrome.storage
        .local as unknown as typeof chrome.storage.local;
      await storage.set({
        totem_user_id: "42",
        totem_auth_state: "stale",
      });

      setupRouter(fakeChrome);
      const response = (await fakeChrome.runtime.sendMessage({
        type: "SESSION_USER_MISSING",
      })) as { ok: boolean };

      expect(response.ok).toBe(true);

      const stored = await storage.get([
        "totem_user_id",
        "totem_auth_state",
        "totem_auth_headers",
      ]);
      expect(stored.totem_user_id).toBeUndefined();
      expect(stored.totem_auth_state).toBe("logged_out");
      // auth headers should be cleared since there were none
      expect(stored.totem_auth_headers).toBeUndefined();
    });

    it("keeps auth headers when they exist (marks logged_out without clearAuth)", async () => {
      const storage = fakeChrome.storage
        .local as unknown as typeof chrome.storage.local;
      await storage.set({
        totem_user_id: "42",
        totem_auth_headers: {
          authorization: "Bearer token",
          "x-csrf-token": "csrf",
          cookie: "twid=u%3D42; ct0=csrf",
        },
        totem_auth_state: "authenticated",
      });

      setupRouter(fakeChrome);
      await fakeChrome.runtime.sendMessage({ type: "SESSION_USER_MISSING" });

      const stored = await storage.get([
        "totem_user_id",
        "totem_auth_state",
        "totem_auth_headers",
      ]);
      expect(stored.totem_user_id).toBeUndefined();
      expect(stored.totem_auth_state).toBe("logged_out");
      // Auth headers should be preserved for diagnostics
      expect(stored.totem_auth_headers).toBeDefined();
    });

    it("logs diagnostic entry", async () => {
      setupRouter(fakeChrome);
      await fakeChrome.runtime.sendMessage({ type: "SESSION_USER_MISSING" });

      const log = getAuthDiagnosticLog();
      expect(
        log.some(
          (e) => e.stage === "capture" && e.status === "missing",
        ),
      ).toBe(true);
    });
  });

  // ── SET_ACCOUNT_CONTEXT handler ─────────────────────────────

  describe("SET_ACCOUNT_CONTEXT handler", () => {
    it("sets account context and returns it", async () => {
      setupRouter(fakeChrome);
      const response = (await fakeChrome.runtime.sendMessage({
        type: "SET_ACCOUNT_CONTEXT",
        accountId: "new-account-42",
      })) as { ok: boolean; accountContextId: string };

      expect(response.ok).toBe(true);
      expect(response.accountContextId).toBe("new-account-42");
    });

    it("rejects invalid account context", async () => {
      setupRouter(fakeChrome);
      const response = (await fakeChrome.runtime.sendMessage({
        type: "SET_ACCOUNT_CONTEXT",
        accountId: "",
      })) as { ok: boolean; error: string };

      expect(response.ok).toBe(false);
      expect(response.error).toBe("INVALID_ACCOUNT_CONTEXT");
    });
  });

  // ── CLOSE_AUTH_TAB handler ──────────────────────────────────

  describe("CLOSE_AUTH_TAB handler", () => {
    it("returns ok", async () => {
      setupRouter(fakeChrome);
      const response = (await fakeChrome.runtime.sendMessage({
        type: "CLOSE_AUTH_TAB",
      })) as { ok: boolean };

      expect(response.ok).toBe(true);
    });
  });

  // ── REAUTH_STATUS handler ──────────────────────────────────

  describe("REAUTH_STATUS handler", () => {
    it("returns reauth status", async () => {
      setupRouter(fakeChrome);
      const response = (await fakeChrome.runtime.sendMessage({
        type: "REAUTH_STATUS",
      })) as { inProgress: boolean };

      expect(response.inProgress).toBe(false);
    });
  });

  // ── START_AUTH_CAPTURE handler ──────────────────────────────

  describe("START_AUTH_CAPTURE handler", () => {
    it("creates a tab and returns tabId", async () => {
      setupRouter(fakeChrome);
      const response = (await fakeChrome.runtime.sendMessage({
        type: "START_AUTH_CAPTURE",
      })) as { tabId: number | null; started: boolean; inProgress: boolean };

      expect(response.tabId).toBeGreaterThan(0);
      expect(response.started).toBe(true);
      expect(response.inProgress).toBe(true);
    });

    it("logs diagnostic entry for capture start", async () => {
      setupRouter(fakeChrome);
      await fakeChrome.runtime.sendMessage({ type: "START_AUTH_CAPTURE" });

      const log = getAuthDiagnosticLog();
      expect(
        log.some(
          (e) =>
            e.stage === "capture" &&
            e.status === "ok" &&
            e.reason?.includes("auth_capture_started"),
        ),
      ).toBe(true);
    });

    it("closes the auth tab after captured headers arrive", async () => {
      setupRouter(fakeChrome);
      const removeSpy = vi.spyOn(fakeChrome.tabs, "remove");

      const response = (await fakeChrome.runtime.sendMessage({
        type: "START_AUTH_CAPTURE",
      })) as { tabId: number | null };

      await fakeChrome.storage.local.set({
        totem_auth_headers: {
          authorization: "Bearer token",
          "x-csrf-token": "csrf",
          cookie: "twid=u%3D42; ct0=csrf",
        },
      });
      await Promise.resolve();

      expect(removeSpy).toHaveBeenCalledWith(response.tabId);
    });

    it("deduplicates concurrent capture starts before tab creation resolves", async () => {
      const deps = makeDeps(fakeChrome);
      let resolveCreate!: (tab: { id: number; url?: string }) => void;
      const createPromise = new Promise<{ id: number; url?: string }>((resolve) => {
        resolveCreate = resolve;
      });
      const createSpy = vi
        .spyOn(fakeChrome.tabs, "create")
        .mockReturnValue(createPromise);

      const first = startAuthCaptureSession(deps, { interactive: true });
      await Promise.resolve();
      const second = await startAuthCaptureSession(deps, { interactive: true });

      expect(createSpy).toHaveBeenCalledTimes(1);
      expect(second.started).toBe(false);
      expect(second.inProgress).toBe(true);

      resolveCreate({ id: 42, url: "https://x.com/i/bookmarks" });
      const firstResult = await first;
      expect(firstResult.started).toBe(true);
      expect(firstResult.tabId).toBe(42);
    });

    it("interactive timeout surfaces the tab instead of closing it", async () => {
      vi.useFakeTimers();
      try {
        const deps = makeDepsWithTwid(fakeChrome);
        const updateSpy = vi.spyOn(fakeChrome.tabs, "update");
        const removeSpy = vi.spyOn(fakeChrome.tabs, "remove");

        const start = await startAuthCaptureSession(deps, {
          interactive: true,
          force: true,
        });
        expect(start.started).toBe(true);

        await vi.advanceTimersByTimeAsync(15_000);

        expect(updateSpy).toHaveBeenCalledWith(start.tabId, { active: true });
        expect(removeSpy).not.toHaveBeenCalled();
        expect(
          getAuthDiagnosticLog().some(
            (e) => e.reason === "auth_capture_failed:capture_timeout",
          ),
        ).toBe(true);
      } finally {
        vi.useRealTimers();
      }
    });

    it("silent timeout still closes the background tab", async () => {
      vi.useFakeTimers();
      try {
        const deps = makeDepsWithTwid(fakeChrome);
        const removeSpy = vi.spyOn(fakeChrome.tabs, "remove");

        const start = await startAuthCaptureSession(deps, {
          interactive: false,
        });
        expect(start.started).toBe(true);

        await vi.advanceTimersByTimeAsync(15_000);

        expect(removeSpy).toHaveBeenCalledWith(start.tabId);
      } finally {
        vi.useRealTimers();
      }
    });

    it("opens the capture tab in the foreground after a recent failure", async () => {
      const deps = makeDepsWithTwid(fakeChrome);
      const createSpy = vi.spyOn(fakeChrome.tabs, "create");

      const first = await startAuthCaptureSession(deps, {
        interactive: false,
      });
      expect(first.started).toBe(true);
      // User closes the background tab → capture fails.
      await fakeChrome.tabs.remove(first.tabId as number);
      await Promise.resolve();

      await startAuthCaptureSession(deps, { interactive: true, force: true });

      expect(createSpy).toHaveBeenLastCalledWith({
        url: "https://x.com/i/bookmarks",
        active: true,
      });
    });
  });

  // ── Storage-write dedupe (onChanged → checkAuth storm) ──────

  describe("storage write dedupe", () => {
    it("setAuthState skips rewriting an unchanged state+reason", async () => {
      const storage = fakeChrome.storage
        .local as unknown as typeof chrome.storage.local;
      await markAuthAuthenticated("detail_ok", storage);

      const setSpy = vi.spyOn(fakeChrome.storage.local, "set");
      await markAuthAuthenticated("detail_ok", storage);

      const authStateWrites = setSpy.mock.calls.filter(
        ([items]) =>
          items !== null &&
          typeof items === "object" &&
          "totem_auth_state" in items,
      );
      expect(authStateWrites).toHaveLength(0);
    });

    it("setAuthState writes when the reason changes", async () => {
      const storage = fakeChrome.storage
        .local as unknown as typeof chrome.storage.local;
      await markAuthAuthenticated("detail_ok", storage);

      const setSpy = vi.spyOn(fakeChrome.storage.local, "set");
      await markAuthAuthenticated("headers_trio", storage);

      const authStateWrites = setSpy.mock.calls.filter(
        ([items]) =>
          items !== null &&
          typeof items === "object" &&
          "totem_auth_state" in items,
      );
      expect(authStateWrites).toHaveLength(1);
    });

    it("getSessionSnapshot does not rewrite an unchanged identity", async () => {
      const storage = fakeChrome.storage
        .local as unknown as typeof chrome.storage.local;
      await storage.set({
        totem_user_id: "777",
        [CS_ACCOUNT_CONTEXT_ID]: "777",
        totem_auth_headers: {
          authorization: "Bearer token",
          "x-csrf-token": "csrf",
          cookie: "twid=u%3D777; ct0=csrf",
        },
      });

      const setSpy = vi.spyOn(fakeChrome.storage.local, "set");
      const snapshot = await getSessionSnapshot(storage, twidCookies());

      expect(snapshot.sessionState).toBe("logged_in");
      const identityWrites = setSpy.mock.calls.filter(
        ([items]) =>
          items !== null &&
          typeof items === "object" &&
          ("totem_user_id" in items || CS_ACCOUNT_CONTEXT_ID in items),
      );
      expect(identityWrites).toHaveLength(0);
    });

    it("getSessionSnapshot writes the identity when it changed", async () => {
      const storage = fakeChrome.storage
        .local as unknown as typeof chrome.storage.local;

      await getSessionSnapshot(storage, twidCookies());

      const stored = await storage.get([
        "totem_user_id",
        CS_ACCOUNT_CONTEXT_ID,
      ]);
      expect(stored.totem_user_id).toBe("777");
      expect(stored[CS_ACCOUNT_CONTEXT_ID]).toBe("777");
    });
  });

  // ── Diagnostics dedupe ──────────────────────────────────────

  describe("diagnostics dedupe", () => {
    it("collapses consecutive identical entries", async () => {
      setupRouter(fakeChrome);
      await fakeChrome.runtime.sendMessage({ type: "CHECK_AUTH" });
      await fakeChrome.runtime.sendMessage({ type: "CHECK_AUTH" });
      await fakeChrome.runtime.sendMessage({ type: "CHECK_AUTH" });

      const log = getAuthDiagnosticLog();
      for (let i = 1; i < log.length; i++) {
        const prev = log[i - 1];
        const curr = log[i];
        const identical =
          prev.stage === curr.stage &&
          prev.status === curr.status &&
          prev.reason === curr.reason;
        expect(identical).toBe(false);
      }
    });
  });

  // ── Diagnostics persistence ─────────────────────────────────

  describe("diagnostics", () => {
    it("persists diagnostics to storage on CHECK_AUTH", async () => {
      const storage = fakeChrome.storage
        .local as unknown as typeof chrome.storage.local;

      setupRouter(fakeChrome);
      await fakeChrome.runtime.sendMessage({ type: "CHECK_AUTH" });

      const stored = await storage.get(["totem_auth_diagnostics"]);
      expect(stored.totem_auth_diagnostics).toBeDefined();
      expect(
        Array.isArray(stored.totem_auth_diagnostics),
      ).toBe(true);
      expect(
        (stored.totem_auth_diagnostics as unknown[]).length,
      ).toBeGreaterThan(0);
    });
  });

  // ── End-to-end: auth capture → snapshot → frontend ──────────

  describe("end-to-end: auth capture → snapshot → frontend receipt", () => {
    it("full flow: no auth → capture headers → CHECK_AUTH returns authenticated", async () => {
      const storage = fakeChrome.storage
        .local as unknown as typeof chrome.storage.local;
      setupRouter(fakeChrome);

      // Step 1: No auth — CHECK_AUTH returns unauthenticated
      const initial = (await fakeChrome.runtime.sendMessage({
        type: "CHECK_AUTH",
      })) as Record<string, unknown>;
      expect(initial.hasAuth).toBe(false);

      // Step 2: Simulate auth header capture (as webRequest listener would do)
      await storage.set({
        totem_user_id: "777",
        totem_account_context_id: "777",
        totem_auth_headers: {
          authorization: "Bearer real_token",
          "x-csrf-token": "real_csrf",
          cookie: "twid=u%3D777; ct0=real_csrf",
        },
        totem_auth_time: Date.now(),
        totem_auth_state: "authenticated",
        totem_auth_state_at: Date.now(),
        totem_auth_state_reason: "headers_trio",
      });

      // Step 3: CHECK_AUTH now returns authenticated
      const after = (await fakeChrome.runtime.sendMessage({
        type: "CHECK_AUTH",
      })) as Record<string, unknown>;
      expect(after.hasUser).toBe(true);
      expect(after.hasAuth).toBe(true);
      expect(after.userId).toBe("777");
      expect(after.sessionState).toBe("logged_in");
      expect(after.authState).toBe("authenticated");

      // Step 4: Runtime snapshot also reflects authenticated state
      const snapshot = (await fakeChrome.runtime.sendMessage({
        type: "GET_RUNTIME_SNAPSHOT",
      })) as { ok: boolean; data: Record<string, unknown> };
      expect(snapshot.data.sessionState).toBe("logged_in");
      expect(snapshot.data.authPhase).toBe("ready");
    });
  });
});
