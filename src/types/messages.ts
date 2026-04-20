/**
 * All message request/response types between frontend and service worker.
 * Canonical contract — both sides import from here.
 */

import type {
  AuthPhase,
  AuthStatus,
  ApiCapability,
  SessionState,
} from "./auth";
import type {
  SyncTrigger,
  SyncMode,
  SyncCompletionStatus,
  SyncBlockedReason,
  SyncReservationDecision,
  RuntimeSyncPolicy,
  RuntimeCacheSummary,
} from "./sync";

// ── Bookmark event types ─────────────────────────────────────────

export type BookmarkChangeType = "CreateBookmark" | "DeleteBookmark";

export interface BookmarkChangeEvent {
  id: string;
  type: BookmarkChangeType;
  tweetId: string;
  at: number;
  source: string;
}

// ── Request types ──────────────────────────────────────────────

// Auth
export interface CheckAuthRequest {
  type: "CHECK_AUTH";
  probe?: boolean;
}

export interface GetRuntimeSnapshotRequest {
  type: "GET_RUNTIME_SNAPSHOT";
  accountId?: string;
}

export interface SetAccountContextRequest {
  type: "SET_ACCOUNT_CONTEXT";
  accountId: string;
}

export interface StartAuthCaptureRequest {
  type: "START_AUTH_CAPTURE";
}

export interface CloseAuthTabRequest {
  type: "CLOSE_AUTH_TAB";
}

export interface ReauthStatusRequest {
  type: "REAUTH_STATUS";
}

export interface SessionUserMissingRequest {
  type: "SESSION_USER_MISSING";
}

// Sync
export interface RequestSyncRequest {
  type: "REQUEST_SYNC";
  accountId?: string | null;
  trigger: SyncTrigger;
  localCount: number;
}

export interface CompleteSyncRequest {
  type: "COMPLETE_SYNC";
  accountId?: string | null;
  leaseId: string;
  mode: SyncMode;
  status: SyncCompletionStatus;
  trigger: SyncTrigger;
  errorCode?: string;
}

// Bookmarks & API
export interface FetchBookmarksRequest {
  type: "FETCH_BOOKMARKS";
  cursor?: string;
  count?: number;
}

export interface DeleteBookmarkRequest {
  type: "DELETE_BOOKMARK";
  tweetId: string;
}

export interface FetchTweetDetailRequest {
  type: "FETCH_TWEET_DETAIL";
  tweetId: string;
}

export interface BookmarkMutationRequest {
  type: "BOOKMARK_MUTATION";
  operation: BookmarkChangeType;
  tweetId: string;
  source?: string;
  confirmed?: boolean;
}

export interface GetBookmarkEventsRequest {
  type: "GET_BOOKMARK_EVENTS";
}

export interface AckBookmarkEventsRequest {
  type: "ACK_BOOKMARK_EVENTS";
  ids: string[];
}

// Query IDs
export interface StoreQueryIdsRequest {
  type: "STORE_QUERY_IDS";
  ids: Record<string, string>;
}

export interface DiscoverQueryIdsRequest {
  type: "DISCOVER_QUERY_IDS";
}

// Other
export interface OpenTotemReaderRequest {
  type: "OPEN_TOTEM_READER";
  tweetId: string;
}

export interface ResetSwStateRequest {
  type: "RESET_SW_STATE";
}

/** Discriminated union of all valid service worker message requests. */
export type MessageRequest =
  | CheckAuthRequest
  | GetRuntimeSnapshotRequest
  | SetAccountContextRequest
  | StartAuthCaptureRequest
  | CloseAuthTabRequest
  | ReauthStatusRequest
  | SessionUserMissingRequest
  | RequestSyncRequest
  | CompleteSyncRequest
  | FetchBookmarksRequest
  | DeleteBookmarkRequest
  | FetchTweetDetailRequest
  | BookmarkMutationRequest
  | GetBookmarkEventsRequest
  | AckBookmarkEventsRequest
  | StoreQueryIdsRequest
  | DiscoverQueryIdsRequest
  | OpenTotemReaderRequest
  | ResetSwStateRequest;

/** All known message type strings. */
export type MessageType = MessageRequest["type"];

// ── Response types ─────────────────────────────────────────────

export interface RuntimeSnapshotData {
  sessionState: SessionState;
  authPhase: AuthPhase;
  accountContextId: string | null;
  capability: ApiCapability;
  syncPolicy: RuntimeSyncPolicy;
  blockedReason: SyncBlockedReason | null;
  cacheSummary: RuntimeCacheSummary;
}

/** Generic service worker response envelope. */
export interface SwResponse {
  ok?: boolean;
  error?: string;
}

// Re-export consumed types for convenience
export type {
  AuthStatus,
  SyncReservationDecision,
  SyncTrigger,
  SyncMode,
  SyncCompletionStatus,
};
