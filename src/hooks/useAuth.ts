import { useReducer, useEffect, useCallback } from "react";
import { checkAuth, startAuthCapture, closeAuthTab } from "../api/core/auth";
import { CS_USER_ID, CS_AUTH_HEADERS } from "../lib/storage-keys";
import {
  AUTH_TIMEOUT_MS,
  AUTH_RECHECK_MS,
  AUTH_QUICK_CHECK_MS,
  AUTH_RETRY_MS,
  AUTH_POLL_MS,
  AUTH_CONNECTING_TIMEOUT_MS,
} from "../lib/constants";

type AuthPhase = "loading" | "need_login" | "connecting" | "ready";

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
  connectingSince: number;
  gaveUp: boolean;
  captureStarted: boolean;
  triedNoUserCapture: boolean;
  pendingRetry: { delayMs: number } | null;
}

const INITIAL_STATE: AuthState = {
  phase: "loading",
  connectingSince: 0,
  gaveUp: false,
  captureStarted: false,
  triedNoUserCapture: false,
  pendingRetry: null,
};

type AuthAction =
  | { type: "CHECK_RESULT"; hasUser: boolean; hasAuth: boolean; hasQueryId: boolean; now: number }
  | { type: "CHECK_ERROR"; now: number }
  | { type: "RETRY_TICK" }
  | { type: "CAPTURE_STARTED" }
  | { type: "STORAGE_CHANGED"; hasAuthData: boolean }
  | { type: "USER_LOGIN" }
  | { type: "CONNECTING_TIMEOUT" };

// ── Reducer ──────────────────────────────────────────────────

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case "CHECK_RESULT": {
      if (!action.hasUser) {
        if (!state.triedNoUserCapture) {
          return {
            ...state,
            phase: "connecting",
            triedNoUserCapture: true,
            captureStarted: true,
            connectingSince: action.now,
            pendingRetry: { delayMs: AUTH_RECHECK_MS },
          };
        }
        return {
          ...state,
          phase: "need_login",
          captureStarted: false,
          pendingRetry: null,
        };
      }

      if (action.hasAuth && action.hasQueryId) {
        return {
          ...state,
          phase: "ready",
          captureStarted: false,
          triedNoUserCapture: false,
          pendingRetry: null,
        };
      }

      const since = state.connectingSince || action.now;
      if (state.connectingSince > 0 && action.now - state.connectingSince > AUTH_CONNECTING_TIMEOUT_MS) {
        return {
          ...state,
          phase: "need_login",
          captureStarted: false,
          gaveUp: true,
          pendingRetry: null,
        };
      }

      return {
        ...state,
        phase: "connecting",
        connectingSince: since,
        triedNoUserCapture: false,
        pendingRetry: state.captureStarted ? null : { delayMs: AUTH_QUICK_CHECK_MS },
      };
    }

    case "CHECK_ERROR": {
      if (
        state.connectingSince > 0 &&
        action.now - state.connectingSince > AUTH_CONNECTING_TIMEOUT_MS
      ) {
        return {
          ...state,
          phase: "need_login",
          captureStarted: false,
          gaveUp: true,
          pendingRetry: null,
        };
      }
      const since = state.connectingSince || action.now;
      return {
        ...state,
        phase: "connecting",
        connectingSince: since,
        captureStarted: false,
        pendingRetry: { delayMs: AUTH_RETRY_MS },
      };
    }

    case "RETRY_TICK":
      return { ...state, pendingRetry: null };

    case "CAPTURE_STARTED":
      return { ...state, captureStarted: true };

    case "STORAGE_CHANGED": {
      if (state.gaveUp && !action.hasAuthData) return state;
      if (state.gaveUp && action.hasAuthData) {
        return { ...state, gaveUp: false, connectingSince: 0 };
      }
      return state;
    }

    case "USER_LOGIN":
      return { ...INITIAL_STATE };

    case "CONNECTING_TIMEOUT":
      return {
        ...state,
        phase: "need_login",
        captureStarted: false,
        gaveUp: true,
        pendingRetry: null,
      };
  }
}

// ── Hook ─────────────────────────────────────────────────────

export function useAuth(): UseAuthReturn {
  const [state, dispatch] = useReducer(authReducer, INITIAL_STATE);

  const performCheck = useCallback(async () => {
    try {
      const status = await withTimeout(checkAuth(), AUTH_TIMEOUT_MS);

      dispatch({
        type: "CHECK_RESULT",
        hasUser: status.hasUser,
        hasAuth: status.hasAuth,
        hasQueryId: status.hasQueryId,
        now: Date.now(),
      });
    } catch {
      dispatch({ type: "CHECK_ERROR", now: Date.now() });
    }
  }, []);

  // 1. Initial check on mount
  useEffect(() => {
    performCheck();
  }, [performCheck]);

  // 2. Side effects on phase change — start/stop auth capture
  useEffect(() => {
    if (state.phase === "connecting" && !state.captureStarted) {
      dispatch({ type: "CAPTURE_STARTED" });
      startAuthCapture().catch(() => {});
    }
  }, [state.phase, state.captureStarted]);

  useEffect(() => {
    if (state.phase !== "connecting" && state.phase !== "loading") {
      closeAuthTab();
    }
  }, [state.phase]);

  // 3. Single retry timer — manages one setTimeout at a time
  useEffect(() => {
    if (!state.pendingRetry) return;
    const id = setTimeout(() => {
      dispatch({ type: "RETRY_TICK" });
      performCheck();
    }, state.pendingRetry.delayMs);
    return () => clearTimeout(id);
  }, [state.pendingRetry, performCheck]);

  // 4. Polling while connecting with capture started
  useEffect(() => {
    if (state.phase !== "connecting" || !state.captureStarted) return;
    const id = setInterval(performCheck, AUTH_POLL_MS);
    return () => clearInterval(id);
  }, [state.phase, state.captureStarted, performCheck]);

  // 5. Connecting timeout watchdog
  useEffect(() => {
    if (state.phase !== "connecting" || state.connectingSince === 0) return;
    const elapsed = Date.now() - state.connectingSince;
    const remaining = AUTH_CONNECTING_TIMEOUT_MS - elapsed;
    if (remaining <= 0) {
      dispatch({ type: "CONNECTING_TIMEOUT" });
      return;
    }
    const id = setTimeout(() => dispatch({ type: "CONNECTING_TIMEOUT" }), remaining);
    return () => clearTimeout(id);
  }, [state.phase, state.connectingSince]);

  // 6. Storage listener — recheck on relevant changes
  useEffect(() => {
    const listener = (changes: Record<string, chrome.storage.StorageChange>) => {
      const hasAuthData = Boolean(changes[CS_AUTH_HEADERS]);
      const isRelevant =
        hasAuthData ||
        Boolean(changes[CS_USER_ID]);

      if (!isRelevant) return;

      dispatch({ type: "STORAGE_CHANGED", hasAuthData });
      performCheck();
    };
    chrome.storage.local.onChanged.addListener(listener);
    return () => chrome.storage.local.onChanged.removeListener(listener);
  }, [performCheck]);

  const startLogin = useCallback(async () => {
    dispatch({ type: "USER_LOGIN" });
    await performCheck();
  }, [performCheck]);

  return { phase: state.phase, startLogin };
}
