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
      bookmarksApi: "ready",
      detailApi: "unknown",
    });
    expect(recovered.phase).toBe("ready");
    expect(recovered.pendingRetry).toBeNull();
  });
});
