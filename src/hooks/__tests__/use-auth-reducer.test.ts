import { describe, expect, it } from "vitest";
import { AUTH_STALE_RECHECK_MS } from "../../lib/constants";
import { INITIAL_STATE, authReducer } from "../useAuth";

type AuthReducerState = typeof INITIAL_STATE;
type AuthReducerEvent = Parameters<typeof authReducer>[1];

function apply(
  state: AuthReducerState,
  ...events: AuthReducerEvent[]
): AuthReducerState {
  return events.reduce(authReducer, state);
}

describe("useAuth reducer", () => {
  it("keeps background polling after connecting timeout", () => {
    const connecting = authReducer(INITIAL_STATE, {
      type: "CHECK_RESULT",
      hasUser: true,
      hasAuth: false,
      hasQueryId: false,
      authState: "stale",
      sessionState: "unknown",
      userId: null,
      accountContextId: null,
      bookmarksApi: "unknown",
      detailApi: "unknown",
    });
    expect(connecting.phase).toBe("connecting");

    const timedOut = authReducer(connecting, { type: "CONNECTING_TIMEOUT" });
    expect(timedOut.phase).toBe("need_login");
    expect(timedOut.sessionState).toBe("unknown");
    expect(timedOut.pendingRetry).toEqual({ delayMs: AUTH_STALE_RECHECK_MS });
  });

  it("recovers to ready after timeout once session is available", () => {
    const timedOut = apply(
      INITIAL_STATE,
      {
        type: "CHECK_RESULT",
        hasUser: true,
        hasAuth: false,
        hasQueryId: false,
        authState: "stale",
        sessionState: "unknown",
        userId: null,
        accountContextId: null,
        bookmarksApi: "unknown",
        detailApi: "unknown",
      },
      { type: "CONNECTING_TIMEOUT" },
    );

    const recovered = authReducer(timedOut, {
      type: "CHECK_RESULT",
      hasUser: true,
      hasAuth: true,
      hasQueryId: true,
      authState: "authenticated",
      sessionState: "logged_in",
      userId: "12345",
      accountContextId: "12345",
      bookmarksApi: "ready",
      detailApi: "unknown",
    });
    expect(recovered.phase).toBe("ready");
    expect(recovered.pendingRetry).toBeNull();
    expect(recovered.activeAccountId).toBe("12345");
  });

  it("retains the last known account id while logged out", () => {
    const loggedIn = authReducer(INITIAL_STATE, {
      type: "CHECK_RESULT",
      hasUser: true,
      hasAuth: true,
      hasQueryId: true,
      authState: "authenticated",
      sessionState: "logged_in",
      userId: "111",
      accountContextId: "111",
      bookmarksApi: "ready",
      detailApi: "unknown",
    });
    expect(loggedIn.activeAccountId).toBe("111");

    const loggedOut = authReducer(loggedIn, {
      type: "CHECK_RESULT",
      hasUser: false,
      hasAuth: false,
      hasQueryId: false,
      authState: "logged_out",
      sessionState: "logged_out",
      userId: null,
      accountContextId: "111",
      bookmarksApi: "unknown",
      detailApi: "unknown",
    });
    expect(loggedOut.activeAccountId).toBe("111");
  });

  it("does not adopt a fresh account id from a logged-out payload", () => {
    const loggedOut = authReducer(INITIAL_STATE, {
      type: "CHECK_RESULT",
      hasUser: false,
      hasAuth: false,
      hasQueryId: false,
      authState: "logged_out",
      sessionState: "logged_out",
      userId: "stale_user",
      accountContextId: null,
      bookmarksApi: "unknown",
      detailApi: "unknown",
    });

    expect(loggedOut.activeAccountId).toBeNull();
  });

  it("updates active account id when a different user is detected", () => {
    const first = authReducer(INITIAL_STATE, {
      type: "CHECK_RESULT",
      hasUser: true,
      hasAuth: true,
      hasQueryId: true,
      authState: "authenticated",
      sessionState: "logged_in",
      userId: "111",
      accountContextId: "111",
      bookmarksApi: "ready",
      detailApi: "unknown",
    });

    const switched = authReducer(first, {
      type: "CHECK_RESULT",
      hasUser: true,
      hasAuth: true,
      hasQueryId: true,
      authState: "authenticated",
      sessionState: "logged_in",
      userId: "222",
      accountContextId: "222",
      bookmarksApi: "ready",
      detailApi: "unknown",
    });
    expect(switched.activeAccountId).toBe("222");
  });

  it("hydrates account context while logged out for offline cache access", () => {
    const loggedOut = authReducer(INITIAL_STATE, {
      type: "CHECK_RESULT",
      hasUser: false,
      hasAuth: false,
      hasQueryId: false,
      authState: "logged_out",
      sessionState: "logged_out",
      userId: null,
      accountContextId: "86246237",
      bookmarksApi: "unknown",
      detailApi: "unknown",
    });
    expect(loggedOut.phase).toBe("need_login");
    expect(loggedOut.activeAccountId).toBe("86246237");
  });
});
