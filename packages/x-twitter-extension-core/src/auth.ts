import {
  getCookieHeaderValue,
  normalizeAuthState,
  parseTwidUserId,
} from "./pure";
import type { AuthState, AuthStatus, CookiesLike, StorageAreaLike } from "./types";

export type CoreDiagnosticEvent =
  | { type: "auth.live_twid.present"; userId: string; source: "x.com" | "twitter.com" }
  | { type: "auth.live_twid.missing" }
  | { type: "auth.cookie_unavailable"; reason: string }
  | { type: "auth.cookie_error"; reason: string }
  | { type: "auth.header_invalid"; reason: string }
  | {
      type: "auth.identity_mismatch";
      liveUserId: string | null;
      capturedUserId: string | null;
    };

export type CoreDiagnosticSink = (
  event: CoreDiagnosticEvent,
) => void | Promise<void>;

export interface TwitterAuthStorageKeys {
  userId: string;
  authHeaders: string;
  authState: string;
}

export interface GetTwitterAuthStatusOptions {
  storage: StorageAreaLike;
  keys: TwitterAuthStorageKeys;
  cookies?: CookiesLike;
  markLoggedOut?: (reason: string, clearAuth: boolean) => Promise<void>;
  onEvent?: CoreDiagnosticSink;
}

export function authHeaderTwidUserId(authHeaders: unknown): string | null {
  const headers = normalizeHeaders(authHeaders);
  if (!headers) return null;
  return parseTwidUserId(
    getCookieHeaderValue(
      typeof headers.cookie === "string" ? headers.cookie : "",
      "twid",
    ),
  );
}

export function usableAuthHeaderUserId(
  authHeaders: unknown,
  liveUserId: string | null | undefined,
  allowAnyCapturedUser: boolean = false,
): string | null {
  const parsed = parseCapturedAuthHeaders(authHeaders, {
    liveUserId,
    allowInteractiveAccountSwitch: allowAnyCapturedUser,
  });
  return parsed.ok ? parsed.userId : null;
}

export function normalizeHeaders(input: unknown): Record<string, string> | null {
  if (!input || typeof input !== "object") return null;

  if (typeof Headers !== "undefined" && input instanceof Headers) {
    const headers: Record<string, string> = {};
    input.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });
    return headers;
  }

  const headers: Record<string, string> = {};
  for (const [name, value] of Object.entries(input)) {
    if (typeof name !== "string" || typeof value !== "string") return null;
    headers[name.toLowerCase()] = value;
  }
  return headers;
}

export interface CapturedAuthHeaders {
  headers: Record<string, string>;
  authorization: string;
  csrfToken: string;
  cookie: string;
  ct0: string;
  userId: string;
}

export type CapturedAuthValidation =
  | (CapturedAuthHeaders & { ok: true })
  | {
      ok: false;
      reason:
        | "headers_not_object"
        | "missing_authorization"
        | "missing_csrf"
        | "missing_cookie"
        | "missing_twid"
        | "missing_ct0"
        | "csrf_ct0_mismatch"
        | "live_twid_mismatch";
      headers?: Record<string, string>;
      userId?: string | null;
      liveUserId?: string | null;
    };

export interface ParseCapturedAuthHeadersOptions {
  liveUserId?: string | null;
  allowInteractiveAccountSwitch?: boolean;
  onEvent?: CoreDiagnosticSink;
}

function emitAuthEvent(
  onEvent: CoreDiagnosticSink | undefined,
  event: CoreDiagnosticEvent,
): void {
  try {
    void onEvent?.(event);
  } catch {
    // diagnostics must not affect auth decisions
  }
}

export function parseCapturedAuthHeaders(
  input: unknown,
  options: ParseCapturedAuthHeadersOptions = {},
): CapturedAuthValidation {
  const headers = normalizeHeaders(input);
  if (!headers) {
    emitAuthEvent(options.onEvent, {
      type: "auth.header_invalid",
      reason: "headers_not_object",
    });
    return { ok: false, reason: "headers_not_object" };
  }

  const authorization = headers.authorization?.trim() ?? "";
  if (!authorization) {
    emitAuthEvent(options.onEvent, {
      type: "auth.header_invalid",
      reason: "missing_authorization",
    });
    return { ok: false, reason: "missing_authorization", headers };
  }

  const csrfToken = headers["x-csrf-token"]?.trim() ?? "";
  if (!csrfToken) {
    emitAuthEvent(options.onEvent, {
      type: "auth.header_invalid",
      reason: "missing_csrf",
    });
    return { ok: false, reason: "missing_csrf", headers };
  }

  const cookie = headers.cookie ?? "";
  if (!cookie.trim()) {
    emitAuthEvent(options.onEvent, {
      type: "auth.header_invalid",
      reason: "missing_cookie",
    });
    return { ok: false, reason: "missing_cookie", headers };
  }

  const userId = parseTwidUserId(getCookieHeaderValue(cookie, "twid"));
  if (!userId) {
    emitAuthEvent(options.onEvent, {
      type: "auth.header_invalid",
      reason: "missing_twid",
    });
    return { ok: false, reason: "missing_twid", headers, userId };
  }

  const ct0 = getCookieHeaderValue(cookie, "ct0");
  if (!ct0) {
    emitAuthEvent(options.onEvent, {
      type: "auth.header_invalid",
      reason: "missing_ct0",
    });
    return { ok: false, reason: "missing_ct0", headers, userId };
  }

  if (ct0 !== csrfToken) {
    emitAuthEvent(options.onEvent, {
      type: "auth.header_invalid",
      reason: "csrf_ct0_mismatch",
    });
    return { ok: false, reason: "csrf_ct0_mismatch", headers, userId };
  }

  if (
    options.liveUserId !== undefined &&
    options.liveUserId !== null &&
    userId !== options.liveUserId &&
    options.allowInteractiveAccountSwitch !== true
  ) {
    emitAuthEvent(options.onEvent, {
      type: "auth.identity_mismatch",
      liveUserId: options.liveUserId,
      capturedUserId: userId,
    });
    return {
      ok: false,
      reason: "live_twid_mismatch",
      headers,
      userId,
      liveUserId: options.liveUserId,
    };
  }

  return {
    ok: true,
    headers,
    authorization,
    csrfToken,
    cookie,
    ct0,
    userId,
  };
}

export type LiveTwidResult =
  | { state: "present"; userId: string; source: "x.com" | "twitter.com" }
  | { state: "missing" }
  | { state: "unavailable"; reason: string }
  | { state: "error"; reason: string };

export async function readLiveTwid(
  cookies: CookiesLike | undefined,
  options: { onEvent?: CoreDiagnosticSink } = {},
): Promise<LiveTwidResult> {
  if (!cookies || typeof cookies.get !== "function") {
    emitAuthEvent(options.onEvent, {
      type: "auth.cookie_unavailable",
      reason: "cookies_api_unavailable",
    });
    return { state: "unavailable", reason: "cookies_api_unavailable" };
  }

  const reads: Array<{
    source: "x.com" | "twitter.com";
    url: "https://x.com/" | "https://twitter.com/";
  }> = [
    { source: "x.com", url: "https://x.com/" },
    { source: "twitter.com", url: "https://twitter.com/" },
  ];
  const present: Array<{ userId: string; source: "x.com" | "twitter.com" }> = [];
  const errors: string[] = [];

  for (const read of reads) {
    try {
      const cookie = await cookies.get({ url: read.url, name: "twid" });
      const userId = parseTwidUserId(cookie?.value ?? "");
      if (userId) present.push({ userId, source: read.source });
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  const first = present[0];
  if (first) {
    const mismatch = present.find((item) => item.userId !== first.userId);
    if (mismatch) {
      const reason = `twid_domain_mismatch:${first.source}:${mismatch.source}`;
      emitAuthEvent(options.onEvent, { type: "auth.cookie_error", reason });
      return { state: "error", reason };
    }
    emitAuthEvent(options.onEvent, {
      type: "auth.live_twid.present",
      userId: first.userId,
      source: first.source,
    });
    return { state: "present", userId: first.userId, source: first.source };
  }

  if (errors.length === reads.length) {
    const reason = errors.join("; ") || "cookie_read_failed";
    emitAuthEvent(options.onEvent, { type: "auth.cookie_error", reason });
    return { state: "error", reason };
  }

  emitAuthEvent(options.onEvent, { type: "auth.live_twid.missing" });
  return { state: "missing" };
}

export async function readLiveTwidUserId(
  cookies: CookiesLike | undefined,
): Promise<string | null | undefined> {
  const result = await readLiveTwid(cookies);
  if (result.state === "present") return result.userId;
  if (result.state === "missing") return null;
  return undefined;
}

export interface TwidCookieChangeInfo {
  removed: boolean;
  cause?: string;
  cookie: {
    name: string;
    value?: string;
    domain?: string;
  };
}

export type TwidCookieChangeClassification =
  | { action: "ignore"; reason: "not_twid" | "not_x_domain" | "overwrite_removed" }
  | { action: "present"; userId: string }
  | { action: "verify_missing"; reason: string };

export function classifyTwidCookieChange(
  changeInfo: TwidCookieChangeInfo,
): TwidCookieChangeClassification {
  const cookie = changeInfo.cookie;
  if (cookie.name !== "twid") return { action: "ignore", reason: "not_twid" };

  const domain = (cookie.domain ?? "").replace(/^\./, "").toLowerCase();
  if (domain && domain !== "x.com" && domain !== "twitter.com") {
    return { action: "ignore", reason: "not_x_domain" };
  }

  if (changeInfo.removed && changeInfo.cause === "overwrite") {
    return { action: "ignore", reason: "overwrite_removed" };
  }

  if (!changeInfo.removed) {
    const userId = parseTwidUserId(cookie.value ?? "");
    if (userId) return { action: "present", userId };
    return { action: "verify_missing", reason: "invalid_twid_value" };
  }

  return {
    action: "verify_missing",
    reason: `cookie_twid_${changeInfo.cause || "removed"}`,
  };
}

export async function getTwitterAuthStatus({
  storage,
  keys,
  cookies,
  markLoggedOut,
  onEvent,
}: GetTwitterAuthStatusOptions): Promise<AuthStatus> {
  const stored = await storage.get([keys.userId, keys.authHeaders, keys.authState]);

  let userId: string | null =
    typeof stored[keys.userId] === "string" && stored[keys.userId]
      ? (stored[keys.userId] as string)
      : null;

  let authHeaders = normalizeHeaders(stored[keys.authHeaders]) ?? undefined;

  const liveTwid = await readLiveTwid(cookies, { onEvent });
  const liveTwidUserId =
    liveTwid.state === "present"
      ? liveTwid.userId
      : liveTwid.state === "missing"
        ? null
        : undefined;
  const storedTwidUserId = authHeaderTwidUserId(authHeaders);
  const storedAuthMismatch = Boolean(
    authHeaders?.authorization &&
      storedTwidUserId &&
      liveTwidUserId !== undefined &&
      (!liveTwidUserId || storedTwidUserId !== liveTwidUserId),
  );

  if (storedAuthMismatch) {
    emitAuthEvent(onEvent, {
      type: "auth.identity_mismatch",
      liveUserId: liveTwidUserId ?? null,
      capturedUserId: storedTwidUserId,
    });
    if (markLoggedOut) {
      await markLoggedOut("live_twid_mismatch", true);
    } else {
      await storage.remove(keys.authHeaders);
    }
    authHeaders = undefined;
  }

  const hasAuthHeader = Boolean(
    !storedAuthMismatch &&
      usableAuthHeaderUserId(authHeaders, liveTwidUserId),
  );
  const effectiveUserId =
    liveTwidUserId === undefined
      ? userId || storedTwidUserId
      : liveTwidUserId;

  if (effectiveUserId) {
    userId = effectiveUserId;
    storage.set({ [keys.userId]: effectiveUserId }).catch(() => {});
  } else if (liveTwidUserId === null && userId) {
    userId = null;
  }

  const normalizedAuthState = normalizeAuthState(
    storedAuthMismatch ? "logged_out" : stored[keys.authState],
    hasAuthHeader,
  );
  const authState: AuthState =
    hasAuthHeader && normalizedAuthState === "logged_out"
      ? "stale"
      : liveTwidUserId && !hasAuthHeader
        ? "stale"
        : normalizedAuthState;

  const sessionState = hasAuthHeader
    ? "logged_in"
    : liveTwidUserId
      ? "unknown"
      : authState === "logged_out"
        ? "logged_out"
        : "unknown";

  const responseUserId = sessionState === "logged_out" ? null : userId;

  return {
    hasUser:
      sessionState !== "logged_out" &&
      Boolean(responseUserId || hasAuthHeader || liveTwidUserId),
    hasAuth: sessionState === "logged_in" && hasAuthHeader,
    userId: responseUserId,
    authState,
    sessionState,
  };
}
