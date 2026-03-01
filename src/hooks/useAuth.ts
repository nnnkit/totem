import { useReducer, useEffect, useCallback } from "react";
import { checkAuth } from "../api/core/auth";
import { CS_USER_ID, CS_AUTH_HEADERS, CS_AUTH_STATE } from "../lib/storage-keys";
import {
  AUTH_TIMEOUT_MS,
  AUTH_QUICK_CHECK_MS,
  AUTH_RETRY_MS,
  AUTH_HEARTBEAT_MS,
  AUTH_STALE_RECHECK_MS,
} from "../lib/constants";
import type { AuthState as SessionAuthState } from "../types";

export type AuthPhase = "loading" | "need_login" | "connecting" | "ready";

interface UseAuthReturn {
  phase: AuthPhase;
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
  pendingRetry: { delayMs: number } | null;
}

const INITIAL_STATE: AuthState = {
  phase: "loading",
  authState: "stale",
  pendingRetry: null,
};

type AuthAction =
  | {
    type: "CHECK_RESULT";
    hasUser: boolean;
    hasAuth: boolean;
    hasQueryId: boolean;
    authState: SessionAuthState;
  }
  | { type: "CHECK_ERROR" }
  | { type: "RETRY_TICK" }
  | { type: "USER_LOGIN" };

// ── Reducer ──────────────────────────────────────────────────

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case "CHECK_RESULT": {
      if (action.authState === "logged_out") {
        return {
          ...state,
          authState: action.authState,
          phase: "need_login",
          pendingRetry: null,
        };
      }

      if (action.authState === "stale") {
        return {
          ...state,
          authState: action.authState,
          phase: "connecting",
          pendingRetry: { delayMs: AUTH_STALE_RECHECK_MS },
        };
      }

      if (action.hasAuth && action.hasQueryId) {
        return {
          ...state,
          authState: action.authState,
          phase: "ready",
          pendingRetry: null,
        };
      }

      // Backward-compat fallback for older worker payloads.
      if (!action.hasUser && !action.hasAuth) {
        return {
          ...state,
          authState: "logged_out",
          phase: "need_login",
          pendingRetry: null,
        };
      }

      return {
        ...state,
        authState: action.authState,
        phase: "connecting",
        pendingRetry: { delayMs: AUTH_QUICK_CHECK_MS },
      };
    }

    case "CHECK_ERROR":
      return {
        ...state,
        authState: state.phase === "ready" ? "stale" : state.authState,
        phase: "connecting",
        pendingRetry: { delayMs: AUTH_RETRY_MS },
      };

    case "RETRY_TICK":
      return { ...state, pendingRetry: null };

    case "USER_LOGIN":
      return { ...state, phase: "connecting", pendingRetry: null };
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

      dispatch({
        type: "CHECK_RESULT",
        hasUser: status.hasUser,
        hasAuth: status.hasAuth,
        hasQueryId: status.hasQueryId,
        authState,
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
    const shouldProbe = state.authState !== "logged_out";
    const id = setTimeout(() => {
      dispatch({ type: "RETRY_TICK" });
      performCheck(shouldProbe);
    }, state.pendingRetry.delayMs);
    return () => clearTimeout(id);
  }, [state.pendingRetry, state.authState, performCheck]);

  // 3. Lightweight auth heartbeat while online
  useEffect(() => {
    if (state.phase !== "ready") return;
    const id = setInterval(() => {
      performCheck(true);
    }, AUTH_HEARTBEAT_MS);
    return () => clearInterval(id);
  }, [state.phase, performCheck]);

  // 4. Storage listener — recheck on relevant changes
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

  return { phase: state.phase, startLogin };
}
