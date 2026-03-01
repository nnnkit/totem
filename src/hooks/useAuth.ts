import { useReducer, useEffect, useCallback } from "react";
import { checkAuth } from "../api/core/auth";
import { CS_USER_ID, CS_AUTH_HEADERS, CS_AUTH_STATE } from "../lib/storage-keys";
import {
  AUTH_TIMEOUT_MS,
  AUTH_QUICK_CHECK_MS,
  AUTH_RETRY_MS,
  AUTH_HEARTBEAT_MS,
  AUTH_STALE_RECHECK_MS,
  AUTH_CONNECTING_TIMEOUT_MS,
} from "../lib/constants";
import type {
  AuthState as SessionAuthState,
  ApiCapability,
  ApiCapabilityState,
  SessionState,
} from "../types";

export type AuthPhase = "loading" | "need_login" | "connecting" | "ready";

interface UseAuthReturn {
  phase: AuthPhase;
  hasQueryId: boolean;
  sessionState: SessionState;
  capability: ApiCapability;
  startLogin: () => Promise<void>;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("AUTH_TIMEOUT")), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

// ── State & Actions ──────────────────────────────────────────

interface AuthState {
  phase: AuthPhase;
  authState: SessionAuthState;
  sessionState: SessionState;
  capability: ApiCapability;
  hasQueryId: boolean;
  pendingRetry: { delayMs: number } | null;
}

export const INITIAL_STATE: AuthState = {
  phase: "loading",
  authState: "stale",
  sessionState: "unknown",
  capability: {
    bookmarksApi: "unknown",
    detailApi: "unknown",
  },
  hasQueryId: false,
  pendingRetry: null,
};

type AuthAction =
  | {
    type: "CHECK_RESULT";
    hasUser: boolean;
    hasAuth: boolean;
    hasQueryId: boolean;
    authState: SessionAuthState;
    sessionState: SessionState;
    bookmarksApi: ApiCapabilityState;
    detailApi: ApiCapabilityState;
  }
  | { type: "CHECK_ERROR" }
  | { type: "RETRY_TICK" }
  | { type: "USER_LOGIN" }
  | { type: "CONNECTING_TIMEOUT" };

// ── Reducer ──────────────────────────────────────────────────

export function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case "CHECK_RESULT": {
      if (action.sessionState === "logged_out" || action.authState === "logged_out") {
        return {
          ...state,
          authState: action.authState,
          sessionState: "logged_out",
          capability: {
            bookmarksApi: action.bookmarksApi,
            detailApi: action.detailApi,
          },
          hasQueryId: action.hasQueryId,
          phase: "need_login",
          pendingRetry: null,
        };
      }

      if (action.sessionState === "logged_in") {
        return {
          ...state,
          authState: action.authState,
          sessionState: "logged_in",
          capability: {
            bookmarksApi: action.bookmarksApi,
            detailApi: action.detailApi,
          },
          hasQueryId: action.hasQueryId,
          phase: "ready",
          // Keep refreshing capability while session is valid but query IDs
          // are still warming up from captured traffic/bundle discovery.
          pendingRetry: action.bookmarksApi === "blocked"
            ? { delayMs: AUTH_STALE_RECHECK_MS }
            : null,
        };
      }

      // Backward-compat fallback for older worker payloads.
      if (!action.hasUser && !action.hasAuth) {
        return {
          ...state,
          authState: "logged_out",
          sessionState: "logged_out",
          capability: {
            bookmarksApi: action.bookmarksApi,
            detailApi: action.detailApi,
          },
          hasQueryId: action.hasQueryId,
          phase: "need_login",
          pendingRetry: null,
        };
      }

      return {
        ...state,
        authState: action.authState,
        sessionState: action.sessionState,
        capability: {
          bookmarksApi: action.bookmarksApi,
          detailApi: action.detailApi,
        },
        hasQueryId: action.hasQueryId,
        phase: "connecting",
        pendingRetry: { delayMs: AUTH_QUICK_CHECK_MS },
      };
    }

    case "CHECK_ERROR":
      if (state.phase === "ready") {
        return {
          ...state,
          authState: "stale",
          pendingRetry: { delayMs: AUTH_RETRY_MS },
        };
      }
      return {
        ...state,
        authState: state.authState === "authenticated" ? "stale" : state.authState,
        phase: "connecting",
        pendingRetry: { delayMs: AUTH_RETRY_MS },
      };

    case "RETRY_TICK":
      return { ...state, pendingRetry: null };

    case "USER_LOGIN":
      return {
        ...state,
        phase: "connecting",
        sessionState: "unknown",
        pendingRetry: { delayMs: AUTH_QUICK_CHECK_MS },
      };

    case "CONNECTING_TIMEOUT":
      if (state.phase !== "connecting") return state;
      return {
        ...state,
        phase: "need_login",
        // Keep probing in the background so transient startup/network issues
        // can self-recover without requiring manual login clicks.
        sessionState: "unknown",
        pendingRetry: { delayMs: AUTH_STALE_RECHECK_MS },
      };
  }
}

// ── Hook ─────────────────────────────────────────────────────

export function useAuth(): UseAuthReturn {
  const [state, dispatch] = useReducer(authReducer, INITIAL_STATE);

  const performCheck = useCallback(async (probe = false) => {
    try {
      const status = await withTimeout(checkAuth({ probe }), AUTH_TIMEOUT_MS);
      const authState: SessionAuthState = status.authState ??
        (status.hasAuth ? "authenticated" : "logged_out");
      const sessionState: SessionState = status.sessionState ??
        (authState === "logged_out"
          ? "logged_out"
          : status.hasAuth
            ? "logged_in"
            : "unknown");
      const bookmarksApi: ApiCapabilityState = status.capability?.bookmarksApi ??
        (status.hasQueryId
          ? "ready"
          : status.hasAuth
            ? "blocked"
            : "unknown");
      const detailApi: ApiCapabilityState = status.capability?.detailApi ?? "unknown";

      dispatch({
        type: "CHECK_RESULT",
        hasUser: status.hasUser,
        hasAuth: status.hasAuth,
        hasQueryId: status.hasQueryId,
        authState,
        sessionState,
        bookmarksApi,
        detailApi,
      });
    } catch {
      dispatch({ type: "CHECK_ERROR" });
    }
  }, []);

  // 1. Initial check on mount
  useEffect(() => {
    performCheck(true);
  }, [performCheck]);

  // 2. Single retry timer — manages one setTimeout at a time
  useEffect(() => {
    if (!state.pendingRetry) return;
    const shouldProbe = state.sessionState !== "logged_out";
    const id = setTimeout(() => {
      dispatch({ type: "RETRY_TICK" });
      performCheck(shouldProbe);
    }, state.pendingRetry.delayMs);
    return () => clearTimeout(id);
  }, [state.pendingRetry, state.sessionState, performCheck]);

  // 3. Lightweight auth heartbeat while online
  useEffect(() => {
    if (state.phase !== "ready") return;
    const id = setInterval(() => {
      performCheck(true);
    }, AUTH_HEARTBEAT_MS);
    return () => clearInterval(id);
  }, [state.phase, performCheck]);

  // 4. Guardrail: never spin in connecting forever.
  useEffect(() => {
    if (state.phase !== "connecting") return;
    const id = setTimeout(() => {
      dispatch({ type: "CONNECTING_TIMEOUT" });
    }, AUTH_CONNECTING_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, [state.phase]);

  // 5. Storage listener — recheck on relevant changes
  useEffect(() => {
    const listener = (changes: Record<string, chrome.storage.StorageChange>) => {
      const authChange = changes[CS_AUTH_HEADERS];
      const authStateChange = changes[CS_AUTH_STATE];
      const isRelevant =
        Boolean(authChange) ||
        Boolean(authStateChange) ||
        Boolean(changes[CS_USER_ID]);

      if (!isRelevant) return;
      performCheck();
    };
    chrome.storage.local.onChanged.addListener(listener);
    return () => chrome.storage.local.onChanged.removeListener(listener);
  }, [performCheck]);

  const startLogin = useCallback(async () => {
    dispatch({ type: "USER_LOGIN" });
    await performCheck(true);
  }, [performCheck]);

  return {
    phase: state.phase,
    hasQueryId: state.hasQueryId,
    sessionState: state.sessionState,
    capability: state.capability,
    startLogin,
  };
}
