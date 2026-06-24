import { describe, it, expect } from "vitest";
import {
  deriveAuthTransition,
  type AuthPayload,
  type AuthTransitionInput,
  type AuthTransitionOptions,
} from "../auth-transition";

const REAUTH_DELAY = 500; // AUTH_QUICK_CHECK_MS

function input(overrides: Partial<AuthTransitionInput> = {}): AuthTransitionInput {
  return {
    authPhase: "ready",
    activeAccountId: "acct-A",
    bookmarksLoaded: true,
    detailedIdsLoaded: true,
    bookmarks: [],
    detailedTweetIds: new Set<string>(),
    syncStatus: "idle",
    syncJobKind: "none",
    bootGeneration: 3,
    lastSyncAt: 1000,
    ...overrides,
  };
}

function payload(overrides: Partial<AuthPayload> = {}): AuthPayload {
  return {
    hasUser: true,
    hasAuth: true,
    authState: "authenticated",
    sessionState: "logged_in",
    userId: "acct-A",
    accountContextId: "acct-A",
    bookmarksApi: "ready",
    detailApi: "ready",
    lastSyncAt: 0,
    ...overrides,
  };
}

const LIVE: AuthTransitionOptions = { allowHydration: true, allowAutoSync: true };
const PUSH: AuthTransitionOptions = { allowHydration: false, allowAutoSync: false };

const kinds = (t: ReturnType<typeof deriveAuthTransition>) =>
  t.effects.map((e) => e.kind);

describe("deriveAuthTransition — phase machine", () => {
  it("maps logged_out session to need_login / logged_out with no retry delay", () => {
    const { patch } = deriveAuthTransition(
      input(),
      payload({ sessionState: "logged_out", authState: "logged_out" }),
      LIVE,
    );
    expect(patch.authPhase).toBe("need_login");
    expect(patch.sessionState).toBe("logged_out");
    expect(patch.authRetryDelayMs).toBeNull();
  });

  it("treats authState==='logged_out' as logged_out even when session is unknown", () => {
    const { patch } = deriveAuthTransition(
      input({ activeAccountId: "acct-A" }),
      payload({
        sessionState: "unknown",
        authState: "logged_out",
        userId: null,
        accountContextId: null,
      }),
      LIVE,
    );
    expect(patch.authPhase).toBe("need_login");
    expect(patch.sessionState).toBe("logged_out");
    // logged_out fallback keeps the existing account pointer.
    expect(patch.activeAccountId).toBe("acct-A");
  });

  it("maps logged_in session to ready / logged_in", () => {
    const { patch } = deriveAuthTransition(input(), payload(), LIVE);
    expect(patch.authPhase).toBe("ready");
    expect(patch.sessionState).toBe("logged_in");
  });

  it("maps no-user/no-auth to need_login", () => {
    const { patch } = deriveAuthTransition(
      input(),
      payload({ hasUser: false, hasAuth: false, sessionState: "unknown", authState: "stale" }),
      LIVE,
    );
    expect(patch.authPhase).toBe("need_login");
    expect(patch.sessionState).toBe("logged_out");
  });

  it("maps a user-without-auth to connecting with AUTH_QUICK_CHECK_MS retry", () => {
    const { patch, effects } = deriveAuthTransition(
      input(),
      payload({ hasUser: true, hasAuth: false, sessionState: "unknown", authState: "stale" }),
      LIVE,
    );
    expect(patch.authPhase).toBe("connecting");
    expect(patch.sessionState).toBe("unknown");
    expect(patch.authRetryDelayMs).toBe(REAUTH_DELAY);
    // user present, auth missing, not logged in → auth capture starts.
    expect(effects.some((e) => e.kind === "startAuthCapture")).toBe(true);
  });

  it("does not start auth capture while connecting if auth is present", () => {
    const { effects } = deriveAuthTransition(
      input(),
      payload({ hasUser: false, hasAuth: true, sessionState: "unknown", authState: "stale" }),
      LIVE,
    );
    expect(effects.some((e) => e.kind === "startAuthCapture")).toBe(false);
  });
});

describe("deriveAuthTransition — hydration", () => {
  it("hydrates and is terminal when the account changes", () => {
    const t = deriveAuthTransition(
      input({ activeAccountId: "acct-A", bootGeneration: 3 }),
      payload({ userId: "acct-B", accountContextId: "acct-B" }),
      LIVE,
    );
    expect(kinds(t)).toEqual(["releaseActiveWork", "clearScheduledAutoRetry", "hydrate"]);
    const hydrate = t.effects.at(-1)!;
    expect(hydrate.kind).toBe("hydrate");
    if (hydrate.kind === "hydrate") {
      // boot generation bumps once and the patch agrees with the effect.
      expect(hydrate.bootGeneration).toBe(4);
      expect(t.patch.bootGeneration).toBe(4);
      expect(hydrate.allowAutoSync).toBe(true);
    }
  });

  it("clears caches and resets loaded flags when hydrating", () => {
    const { patch } = deriveAuthTransition(
      input({ activeAccountId: "acct-A", bookmarks: [{ id: "x" } as never] }),
      payload({ userId: "acct-B", accountContextId: "acct-B" }),
      LIVE,
    );
    expect(patch.bookmarksLoaded).toBe(false);
    expect(patch.detailedIdsLoaded).toBe(false);
    expect(patch.bookmarks).toEqual([]);
    expect(patch.detailedTweetIds.size).toBe(0);
  });

  it("hydrates when caches are not yet loaded even if the account is unchanged", () => {
    const t = deriveAuthTransition(
      input({ bookmarksLoaded: false, detailedIdsLoaded: true }),
      payload(),
      LIVE,
    );
    expect(t.effects.some((e) => e.kind === "hydrate")).toBe(true);
  });

  it("ends at hydrate with no trailing auto-sync / reconcile", () => {
    const t = deriveAuthTransition(
      input({ activeAccountId: "acct-A" }),
      payload({ userId: "acct-B", accountContextId: "acct-B" }),
      LIVE,
    );
    expect(kinds(t)).not.toContain("maybeAutoSync");
    expect(kinds(t)).not.toContain("reconcilePrefetch");
    expect(kinds(t).at(-1)).toBe("hydrate");
  });
});

describe("deriveAuthTransition — auto-sync & reconcile", () => {
  it("auto-syncs then reconciles when already hydrated and ready", () => {
    const t = deriveAuthTransition(input(), payload(), LIVE);
    expect(kinds(t)).toEqual(["maybeAutoSync", "reconcilePrefetch"]);
  });

  it("only reconciles when auto-sync is disallowed", () => {
    const t = deriveAuthTransition(input(), payload(), {
      allowHydration: true,
      allowAutoSync: false,
    });
    expect(kinds(t)).toEqual(["reconcilePrefetch"]);
  });

  it("suppresses auto-sync after recovering from reauth and forces sync idle", () => {
    const t = deriveAuthTransition(
      input({ authPhase: "ready", syncStatus: "reauthing" }),
      payload(),
      LIVE,
    );
    expect(t.patch.syncStatus).toBe("idle");
    expect(t.patch.syncJobKind).toBe("none");
    expect(kinds(t)).toEqual(["reconcilePrefetch"]);
  });

  it("clears the scheduled auto-retry when phase transitions into ready", () => {
    const t = deriveAuthTransition(input({ authPhase: "connecting" }), payload(), LIVE);
    expect(kinds(t)).toEqual(["clearScheduledAutoRetry", "maybeAutoSync", "reconcilePrefetch"]);
  });
});

describe("deriveAuthTransition — sync invalidation & account pointer", () => {
  it("forces sync idle and releases active work when login is required mid-sync", () => {
    const t = deriveAuthTransition(
      input({ syncStatus: "syncing", syncJobKind: "bootstrap" }),
      payload({ sessionState: "logged_out", authState: "logged_out" }),
      LIVE,
    );
    expect(t.patch.syncStatus).toBe("idle");
    expect(t.patch.syncJobKind).toBe("none");
    expect(t.effects[0]?.kind).toBe("releaseActiveWork");
  });

  it("does not move the account pointer on the snapshot-push path", () => {
    const t = deriveAuthTransition(
      input({ activeAccountId: "acct-A" }),
      payload({ userId: "acct-B", accountContextId: "acct-B" }),
      PUSH,
    );
    expect(t.patch.activeAccountId).toBe("acct-A");
    // no hydration off the push path; the follow-up checkAuth owns the move.
    expect(kinds(t)).not.toContain("hydrate");
    expect(kinds(t)).toContain("clearScheduledAutoRetry");
  });
});

describe("deriveAuthTransition — lastSyncAt max-merge", () => {
  it("never regresses lastSyncAt below the current value", () => {
    const { patch } = deriveAuthTransition(
      input({ lastSyncAt: 5000 }),
      payload({ lastSyncAt: 1000 }),
      LIVE,
    );
    expect(patch.lastSyncAt).toBe(5000);
  });

  it("advances lastSyncAt when the payload is newer", () => {
    const { patch } = deriveAuthTransition(
      input({ lastSyncAt: 1000 }),
      payload({ lastSyncAt: 5000 }),
      LIVE,
    );
    expect(patch.lastSyncAt).toBe(5000);
  });
});

describe("deriveAuthTransition — interaction edges", () => {
  it("emits auth capture before the terminal hydrate when connecting into an unloaded cache", () => {
    const t = deriveAuthTransition(
      input({ bookmarksLoaded: false }),
      payload({ hasUser: true, hasAuth: false, sessionState: "unknown", authState: "stale" }),
      LIVE,
    );
    const ks = kinds(t);
    expect(ks.indexOf("startAuthCapture")).toBeGreaterThanOrEqual(0);
    expect(ks.indexOf("startAuthCapture")).toBeLessThan(ks.indexOf("hydrate"));
    // hydrate is terminal — nothing runs after it.
    expect(ks.at(-1)).toBe("hydrate");
    expect(ks).not.toContain("maybeAutoSync");
    expect(ks).not.toContain("reconcilePrefetch");
    expect(t.patch.bootGeneration).toBe(4);
  });

  it("releases active work but keeps syncStatus 'syncing' on a connecting push without hydration", () => {
    const t = deriveAuthTransition(
      input({ syncStatus: "syncing", syncJobKind: "bootstrap" }),
      payload({ hasUser: true, hasAuth: false, sessionState: "unknown", authState: "stale" }),
      LIVE,
    );
    expect(t.effects[0]?.kind).toBe("releaseActiveWork");
    // needLoginWhileSyncing is false (phase is connecting, not need_login) → sync facts unchanged.
    expect(t.patch.syncStatus).toBe("syncing");
    expect(t.patch.syncJobKind).toBe("bootstrap");
  });

  it("does not auto-sync after reauth recovery even when the recovery also hydrates", () => {
    const t = deriveAuthTransition(
      input({ syncStatus: "reauthing", bookmarksLoaded: false }),
      payload(),
      LIVE,
    );
    const hydrate = t.effects.find((e) => e.kind === "hydrate");
    expect(hydrate?.kind).toBe("hydrate");
    if (hydrate?.kind === "hydrate") {
      expect(hydrate.allowAutoSync).toBe(false);
    }
    expect(t.patch.syncStatus).toBe("idle");
    expect(t.patch.syncJobKind).toBe("none");
  });
});
