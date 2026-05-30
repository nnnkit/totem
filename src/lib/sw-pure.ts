/**
 * Pure functions shared between service worker modules and frontend.
 *
 * These canonical TypeScript versions are the source of
 * truth for logic and are covered by unit tests.
 */

export {
  extractGraphqlOperationName,
  extractQueryIdForOperation,
  getCookieHeaderValue,
  isQueryIdStale,
  normalizeAuthState,
  parseGraphqlEndpoint,
  parseTwidUserId,
} from "@make/x-twitter-extension-core/pure";

export type { ParsedGraphqlEndpoint } from "@make/x-twitter-extension-core/pure";

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
