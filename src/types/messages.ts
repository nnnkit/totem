// Canonical message types for chrome.runtime.sendMessage / onMessage contracts
// Derived from all sendMessage calls in src/api/core/ and handlers in public/service-worker.js

import type { AuthStatus, ReauthStatus } from "./auth";
import type {
  SyncTrigger,
  SyncMode,
  SyncCompletionStatus,
  RuntimeSyncPolicy,
  RuntimeCacheSummary,
} from "./sync";
import type { ApiCapability, SessionState } from "./auth";

// ── Auth messages ────────────────────────────────────────────

export interface CheckAuthRequest {
  type: "CHECK_AUTH";
  probe?: boolean;
}
export type CheckAuthResponse = AuthStatus;

export interface GetRuntimeSnapshotRequest {
  type: "GET_RUNTIME_SNAPSHOT";
}
export interface RuntimeSnapshotData {
  sessionState: SessionState;
  authPhase: "loading" | "need_login" | "connecting" | "ready";
  accountContextId: string | null;
  capability: ApiCapability;
  syncPolicy: RuntimeSyncPolicy;
  blockedReason: string | null;
  cacheSummary: RuntimeCacheSummary;
}
export type GetRuntimeSnapshotResponse =
  | { ok: true; data: RuntimeSnapshotData }
  | { error: string };

export interface SetAccountContextRequest {
  type: "SET_ACCOUNT_CONTEXT";
  accountId: string;
}
export type SetAccountContextResponse =
  | { ok: true; accountContextId: string }
  | { error: string };

export interface StartAuthCaptureRequest {
  type: "START_AUTH_CAPTURE";
}
export interface StartAuthCaptureResponse {
  tabId?: number;
}

export interface CloseAuthTabRequest {
  type: "CLOSE_AUTH_TAB";
}
export interface CloseAuthTabResponse {
  ok: boolean;
}

export interface ReauthStatusRequest {
  type: "REAUTH_STATUS";
}
export type ReauthStatusResponse = ReauthStatus;

// ── Sync messages ────────────────────────────────────────────

export interface RequestSyncRequest {
  type: "REQUEST_SYNC";
  accountId: string | null;
  trigger: SyncTrigger;
  localCount: number;
  requestedMode?: SyncMode;
}

export interface SyncPolicyReserveRequest {
  type: "SYNC_POLICY_RESERVE";
  accountId: string | null;
  trigger: SyncTrigger;
  localCount: number;
  requestedMode?: SyncMode;
}

export interface SyncReserveResponse {
  allow?: boolean;
  mode?: SyncMode | null;
  reason?: string;
  leaseId?: string;
  accountKey?: string;
  retryAfterMs?: number;
  error?: string;
}

export interface CompleteSyncRequest {
  type: "COMPLETE_SYNC";
  accountId: string | null;
  leaseId: string;
  mode: SyncMode;
  status: SyncCompletionStatus;
  trigger: SyncTrigger;
  errorCode?: string;
}

export interface SyncPolicyCompleteRequest {
  type: "SYNC_POLICY_COMPLETE";
  accountId: string | null;
  leaseId: string;
  mode: SyncMode;
  status: SyncCompletionStatus;
  trigger: SyncTrigger;
  errorCode?: string;
}

export interface CompleteSyncResponse {
  ok?: boolean;
  error?: string;
}

// ── Bookmark messages ────────────────────────────────────────

export interface FetchBookmarksRequest {
  type: "FETCH_BOOKMARKS";
  cursor?: string;
  count?: number;
}
export interface FetchBookmarksResponse {
  data?: unknown;
  error?: string;
}

export interface DeleteBookmarkRequest {
  type: "DELETE_BOOKMARK";
  tweetId: string;
}
export interface DeleteBookmarkResponse {
  ok?: boolean;
  error?: string;
}

export interface BookmarkMutationRequest {
  type: "BOOKMARK_MUTATION";
  operation: "CreateBookmark" | "DeleteBookmark";
  tweetId: string;
  source?: string;
  confirmed?: boolean;
}
export interface BookmarkMutationResponse {
  ok?: boolean;
  error?: string;
}

export interface GetBookmarkEventsRequest {
  type: "GET_BOOKMARK_EVENTS";
}
export interface GetBookmarkEventsResponse {
  data?: { events: unknown[] };
  error?: string;
}

export interface AckBookmarkEventsRequest {
  type: "ACK_BOOKMARK_EVENTS";
  ids: string[];
}
export interface AckBookmarkEventsResponse {
  ok?: boolean;
  error?: string;
}

// ── Post messages ────────────────────────────────────────────

export interface FetchTweetDetailRequest {
  type: "FETCH_TWEET_DETAIL";
  tweetId: string;
}
export interface FetchTweetDetailResponse {
  data?: unknown;
  error?: string;
}

// ── Misc messages ────────────────────────────────────────────

export interface OpenTotemReaderRequest {
  type: "OPEN_TOTEM_READER";
  tweetId: string;
}
export interface OpenTotemReaderResponse {
  ok?: boolean;
  tabId?: number;
  error?: string;
}

export interface DiscoverQueryIdsRequest {
  type: "DISCOVER_QUERY_IDS";
}
export interface DiscoverQueryIdsResponse {
  ok: boolean;
}

export interface StoreQueryIdsRequest {
  type: "STORE_QUERY_IDS";
  ids: {
    DeleteBookmark?: string;
    CreateBookmark?: string;
    TweetDetail?: string;
  };
}
export interface StoreQueryIdsResponse {
  ok: boolean;
}

export interface SessionUserMissingRequest {
  type: "SESSION_USER_MISSING";
}
export interface SessionUserMissingResponse {
  ok: boolean;
}

export interface ResetSwStateRequest {
  type: "RESET_SW_STATE";
}
export interface ResetSwStateResponse {
  ok: boolean;
}

// ── Union types ──────────────────────────────────────────────

export type ServiceWorkerRequest =
  | CheckAuthRequest
  | GetRuntimeSnapshotRequest
  | SetAccountContextRequest
  | StartAuthCaptureRequest
  | CloseAuthTabRequest
  | ReauthStatusRequest
  | RequestSyncRequest
  | SyncPolicyReserveRequest
  | CompleteSyncRequest
  | SyncPolicyCompleteRequest
  | FetchBookmarksRequest
  | DeleteBookmarkRequest
  | BookmarkMutationRequest
  | GetBookmarkEventsRequest
  | AckBookmarkEventsRequest
  | FetchTweetDetailRequest
  | OpenTotemReaderRequest
  | DiscoverQueryIdsRequest
  | StoreQueryIdsRequest
  | SessionUserMissingRequest
  | ResetSwStateRequest;

export type MessageType = ServiceWorkerRequest["type"];
