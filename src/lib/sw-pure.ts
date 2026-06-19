import type { AuthState } from "../types/auth";

export interface ParsedGraphqlEndpoint {
  queryId: string;
  operation: string;
  variables: string | null;
  features: string | null;
  fieldToggles: string | null;
  path: string;
  fullUrl: string;
}

const AUTH_STATE_VALUES = new Set(["logged_out", "stale", "authenticated"]);

export function parseTwidUserId(rawValue: unknown): string | null {
  if (typeof rawValue !== "string" || !rawValue) return null;

  const candidates = [rawValue];
  let current = rawValue;
  for (let i = 0; i < 3; i += 1) {
    try {
      const decoded = decodeURIComponent(current);
      if (!decoded || decoded === current) break;
      candidates.push(decoded);
      current = decoded;
    } catch {
      break;
    }
  }

  for (const candidate of candidates) {
    const trimmed = candidate.trim();
    if (!trimmed) continue;

    const userMatch = trimmed.match(/u=(\d+)/);
    if (userMatch?.[1]) return userMatch[1];

    const encodedMatch = trimmed.match(/u%3[Dd](\d+)/);
    if (encodedMatch?.[1]) return encodedMatch[1];

    if (/^\d+$/.test(trimmed)) return trimmed;
  }
  return null;
}

export function getCookieHeaderValue(cookieHeader: unknown, name: string): string {
  if (typeof cookieHeader !== "string" || !cookieHeader) return "";
  const prefix = `${name}=`;
  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim();
    if (trimmed.startsWith(prefix)) return trimmed.slice(prefix.length);
  }
  return "";
}

export function normalizeAuthState(
  state: unknown,
  hasAuthHeader: boolean,
): AuthState {
  if (typeof state === "string" && AUTH_STATE_VALUES.has(state)) {
    return state as AuthState;
  }
  return hasAuthHeader ? "stale" : "logged_out";
}

export function extractGraphqlOperationName(urlString: string): string {
  const match = String(urlString || "").match(
    /\/i\/api\/graphql\/[^/]+\/([^/?]+)/,
  );
  return match?.[1] || "";
}

const MAX_CAPTURED_PARAM_LENGTH = 12_000;

function trimCapturedParam(value: string | null): string | null {
  if (!value || typeof value !== "string") return null;
  if (value.length <= MAX_CAPTURED_PARAM_LENGTH) return value;
  const overflow = value.length - MAX_CAPTURED_PARAM_LENGTH;
  return `${value.slice(0, MAX_CAPTURED_PARAM_LENGTH)}... [truncated ${overflow} chars]`;
}

export function parseGraphqlEndpoint(
  urlString: string,
): ParsedGraphqlEndpoint | null {
  try {
    const url = new URL(urlString);
    const match = url.pathname.match(/\/i\/api\/graphql\/([^/]+)\/([^/]+)/);
    if (!match || !match[1] || !match[2]) return null;
    return {
      queryId: decodeURIComponent(match[1]),
      operation: decodeURIComponent(match[2]),
      variables: trimCapturedParam(url.searchParams.get("variables")),
      features: trimCapturedParam(url.searchParams.get("features")),
      fieldToggles: trimCapturedParam(url.searchParams.get("fieldToggles")),
      path: url.pathname,
      fullUrl: url.toString(),
    };
  } catch {
    return null;
  }
}

export function isValidQueryId(queryId: unknown): queryId is string {
  return typeof queryId === "string" && /^[A-Za-z0-9_-]{5,128}$/.test(queryId);
}

export function isValidOperationName(
  operationName: unknown,
): operationName is string {
  return (
    typeof operationName === "string" &&
    /^[A-Za-z][A-Za-z0-9_]{0,100}$/.test(operationName)
  );
}

export function extractQueryIdForOperation(
  text: string,
  operationName: string,
): string | null {
  const escaped = operationName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const key = (name: string) => `["']?${name}["']?`;
  const queryKey = `(?:${key("queryId")}|${key("operationId")})`;
  const opKey = key("operationName");
  const idValue = "[\"']([A-Za-z0-9_\\-]{5,128})[\"']";
  const opValue = "[\"']" + escaped + "[\"']";
  const pattern = new RegExp(
    queryKey +
      "\\s*:\\s*" +
      idValue +
      "\\s*,\\s*" +
      opKey +
      "\\s*:\\s*" +
      opValue,
  );
  const match = text.match(pattern);
  if (match?.[1]) return match[1];

  const reversed = new RegExp(
    opKey +
      "\\s*:\\s*" +
      opValue +
      "\\s*,\\s*" +
      queryKey +
      "\\s*:\\s*" +
      idValue,
  );
  const revMatch = text.match(reversed);
  return revMatch?.[1] ?? null;
}

export function isQueryIdStale(json: unknown): boolean {
  if (!json || typeof json !== "object") return false;
  const errors = (json as { errors?: unknown[] }).errors;
  if (!Array.isArray(errors)) return false;
  return errors.some(
    (error) =>
      error &&
      typeof error === "object" &&
      (error as { extensions?: { code?: string } }).extensions?.code ===
        "GRAPHQL_VALIDATION_FAILED",
  );
}

// ---------------------------------------------------------------------------
// Bookmark mutation / tweet ID helpers
// ---------------------------------------------------------------------------

export interface BookmarkMutationInfo {
  queryId: string;
  operation: string;
}

export function parseBookmarkMutation(
  urlString: string,
): BookmarkMutationInfo | null {
  const match = urlString.match(
    /\/i\/api\/graphql\/([^/]+)\/(DeleteBookmark|CreateBookmark)(?:\?|$)/,
  );
  if (!match) return null;
  return {
    queryId: match[1],
    operation: match[2],
  };
}

export function extractTweetIdFromVariables(
  variables: unknown,
): string | null {
  if (!variables || typeof variables !== "object") return null;
  const v = variables as Record<string, unknown>;
  const tweetId =
    v.tweet_id || v.tweetId || v.focalTweetId || v.target_tweet_id || v.targetTweetId;
  return typeof tweetId === "string" && tweetId ? tweetId : null;
}

export function extractTweetIdFromReferer(
  referer: unknown,
): string | null {
  if (!referer || typeof referer !== "string") return null;
  const match = referer.match(/\/status\/(\d+)/);
  return match ? match[1] : null;
}

// ---------------------------------------------------------------------------
// Sync helpers
// ---------------------------------------------------------------------------

const SYNC_ACCOUNT_ID_SANITIZE_RE = /[^A-Za-z0-9_-]/g;

export function normalizeSyncAccountId(accountId: unknown): string | null {
  if (typeof accountId !== "string") return null;
  const trimmed = accountId.trim();
  if (!trimmed) return null;
  const sanitized = trimmed
    .replace(SYNC_ACCOUNT_ID_SANITIZE_RE, "_")
    .slice(0, 120);
  return sanitized || null;
}

export interface SessionCapability {
  bookmarksApi: string;
  detailApi?: string;
}

export interface SessionSnapshotLike {
  sessionState: string;
  capability: SessionCapability;
}

export interface SyncAccountLike {
  rateLimitBackoffUntil?: number;
  inFlight?: { startedAt?: number } | null;
  manualCooldownUntil?: number;
}

const SYNC_ORCHESTRATOR_MANUAL_RECLAIM_MS = 90_000;

export type SyncBlockedReason =
  | "no_account"
  | "not_ready"
  | "rate_limited"
  | "in_flight"
  | "cooldown"
  | null;

export function getSyncBlockedReason(
  sessionSnapshot: SessionSnapshotLike,
  account: SyncAccountLike | null | undefined,
  accountKey: string | null,
  now: number,
): SyncBlockedReason {
  if (!accountKey) return "no_account";

  if (
    sessionSnapshot.sessionState !== "logged_in" ||
    sessionSnapshot.capability.bookmarksApi !== "ready"
  ) {
    return "not_ready";
  }

  if (account && Number(account.rateLimitBackoffUntil || 0) > now) {
    return "rate_limited";
  }

  if (account?.inFlight) {
    const startedAt = Number(account.inFlight.startedAt || 0);
    const lockAge = now - startedAt;
    if (lockAge < SYNC_ORCHESTRATOR_MANUAL_RECLAIM_MS) {
      return "in_flight";
    }
  }

  if (account && Number(account.manualCooldownUntil || 0) > now) {
    return "cooldown";
  }

  return null;
}
