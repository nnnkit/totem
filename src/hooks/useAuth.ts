import { useState, useEffect, useCallback, useRef } from "react";
import { checkAuth, startAuthCapture, closeAuthTab } from "../api/core/auth";
import { MANUAL_LOGIN_REQUIRED_KEY } from "../lib/reset";
import { CS_USER_ID, CS_AUTH_HEADERS, CS_QUERY_ID } from "../lib/storage-keys";
import {
  AUTH_TIMEOUT_MS,
  AUTH_RECHECK_MS,
  AUTH_QUICK_CHECK_MS,
  AUTH_RETRY_MS,
  AUTH_POLL_MS,
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

export function useAuth(): UseAuthReturn {
  const [phase, setPhase] = useState<AuthPhase>("loading");
  const captureStarted = useRef(false);
  const attemptedNoUserCapture = useRef(false);
  const recheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doCheck = useCallback(async () => {
    try {
      const [status, resetGuard] = await withTimeout(
        Promise.all([
          checkAuth(),
          chrome.storage.local.get([MANUAL_LOGIN_REQUIRED_KEY]),
        ]),
        AUTH_TIMEOUT_MS,
      );

      const requiresManualLogin = Boolean(resetGuard[MANUAL_LOGIN_REQUIRED_KEY]);

      if (!status.hasUser) {
        if (!attemptedNoUserCapture.current) {
          attemptedNoUserCapture.current = true;
          captureStarted.current = true;
          setPhase("connecting");
          startAuthCapture().catch(() => {});
          recheckTimer.current = setTimeout(doCheck, AUTH_RECHECK_MS);
          return;
        }
        captureStarted.current = false;
        setPhase("need_login");
        return;
      }

      attemptedNoUserCapture.current = false;

      if (requiresManualLogin) {
        chrome.storage.local.remove([MANUAL_LOGIN_REQUIRED_KEY]).catch(() => {});
      }

      if (status.hasAuth && status.hasQueryId) {
        // Fully connected — close background tab if still open
        captureStarted.current = false;
        closeAuthTab();
        setPhase("ready");
        return;
      }

      // User is logged in but we need to capture auth headers.
      // Auto-open background tab silently (once).
      setPhase("connecting");
      if (!captureStarted.current) {
        captureStarted.current = true;
        startAuthCapture();
        // Quick 500ms check after starting capture
        recheckTimer.current = setTimeout(doCheck, AUTH_QUICK_CHECK_MS);
      }
    } catch {
      captureStarted.current = false;
      // Runtime/service-worker checks can fail transiently. Keep retrying instead
      // of forcing the user into manual login immediately.
      setPhase("connecting");
      recheckTimer.current = setTimeout(doCheck, AUTH_RETRY_MS);
    }
  }, []);

  // Initial check
  useEffect(() => {
    doCheck();
    return () => {
      if (recheckTimer.current !== null) {
        clearTimeout(recheckTimer.current);
      }
    };
  }, [doCheck]);

  // React to storage changes (content script sets user_id, service worker sets auth)
  useEffect(() => {
    const listener = (changes: Record<string, chrome.storage.StorageChange>) => {
      if (
        changes[CS_USER_ID] ||
        changes[CS_AUTH_HEADERS] ||
        changes[CS_QUERY_ID] ||
        changes[MANUAL_LOGIN_REQUIRED_KEY]
      ) {
        doCheck();
      }
    };
    chrome.storage.local.onChanged.addListener(listener);
    return () => chrome.storage.local.onChanged.removeListener(listener);
  }, [doCheck]);

  // Fallback polling while in "connecting" phase (1s for faster first-time UX)
  useEffect(() => {
    if (phase !== "connecting") return;
    const interval = setInterval(doCheck, AUTH_POLL_MS);
    return () => clearInterval(interval);
  }, [phase, doCheck]);

  const startLogin = useCallback(async () => {
    try {
      await chrome.storage.local.remove([MANUAL_LOGIN_REQUIRED_KEY]);
    } catch {
      // Ignore storage failures and continue with auth check fallback.
    }
    captureStarted.current = false;
    attemptedNoUserCapture.current = false;
    await doCheck();
  }, [doCheck]);

  return { phase, startLogin };
}
