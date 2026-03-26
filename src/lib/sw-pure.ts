/**
 * Pure functions shared between service worker modules and frontend.
 *
 * These canonical TypeScript versions are the source of
 * truth for logic and are covered by unit tests.
 */

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

const AUTH_STATE_VALUES = new Set(["logged_out", "stale", "authenticated"]);

export function parseTwidUserId(rawValue: unknown): string | null {
  if (typeof rawValue !== "string" || !rawValue) return null;

  const candidates = [rawValue];
  try {
    const decoded = decodeURIComponent(rawValue);
    if (decoded && decoded !== rawValue) {
      candidates.push(decoded);
    }
  } catch {
    // ignore decode errors
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
  const parts = cookieHeader.split(";");
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.startsWith(prefix)) {
      return trimmed.slice(prefix.length);
    }
  }
  return "";
}

export function normalizeAuthState(
  state: unknown,
  hasAuthHeader: boolean,
): "logged_out" | "stale" | "authenticated" {
  if (typeof state === "string" && AUTH_STATE_VALUES.has(state)) {
    return state as "logged_out" | "stale" | "authenticated";
  }
  return hasAuthHeader ? "stale" : "logged_out";
}

// ---------------------------------------------------------------------------
// Query ID helpers
// ---------------------------------------------------------------------------

export function extractQueryIdForOperation(
  text: string,
  operationName: string,
): string | null {
  const escaped = operationName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Match queryId:"<id>",operationName:"<name>"
  const pattern = new RegExp(
    'queryId\\s*:\\s*["\']([A-Za-z0-9_\\-]{10,50})["\']\\s*,\\s*operationName\\s*:\\s*["\']' +
      escaped +
      '["\']',
  );
  const match = text.match(pattern);
  if (match) return match[1];
  // Also try reversed order: operationName:"<name>",...,queryId:"<id>"
  const reversed = new RegExp(
    'operationName\\s*:\\s*["\']' +
      escaped +
      '["\']\\s*,\\s*(?:queryId|operationId)\\s*:\\s*["\']([A-Za-z0-9_\\-]{10,50})["\']',
  );
  const revMatch = text.match(reversed);
  return revMatch ? revMatch[1] : null;
}

export function isQueryIdStale(json: unknown): boolean {
  if (!json || typeof json !== "object") return false;
  const errors = (json as { errors?: unknown[] }).errors;
  if (!Array.isArray(errors)) return false;
  return errors.some(
    (e) =>
      e &&
      typeof e === "object" &&
      (e as { extensions?: { code?: string } }).extensions?.code ===
        "GRAPHQL_VALIDATION_FAILED",
  );
}

export function extractGraphqlOperationName(urlString: string): string {
  const match = String(urlString || "").match(
    /\/i\/api\/graphql\/[^/]+\/([^/?]+)/,
  );
  return match?.[1] || "";
}

// ---------------------------------------------------------------------------
// GraphQL catalog helpers
// ---------------------------------------------------------------------------

export interface ParsedGraphqlEndpoint {
  queryId: string;
  operation: string;
  variables: string | null;
  features: string | null;
  fieldToggles: string | null;
  path: string;
  fullUrl: string;
}

const MAX_CAPTURED_PARAM_LENGTH = 12000;

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
    if (!match) return null;
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
