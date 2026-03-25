/**
 * Auth types shared between content script, service worker, and frontend.
 * Canonical source of truth for the auth pipeline contract.
 */

export type AuthState = "authenticated" | "stale" | "logged_out";
export type AuthPhase = "loading" | "need_login" | "connecting" | "ready";
export type SessionState = "unknown" | "logged_in" | "logged_out";
export type ApiCapabilityState = "unknown" | "ready" | "blocked";

export interface ApiCapability {
  bookmarksApi: ApiCapabilityState;
  detailApi: ApiCapabilityState;
}

export interface AuthStatus {
  hasUser: boolean;
  hasAuth: boolean;
  userId: string | null;
  accountContextId?: string | null;
  authState: AuthState;
  sessionState: SessionState;
  capability: ApiCapability;
}

/** Shape of captured auth headers from X.com requests. */
export interface CapturedAuthHeaders {
  authorization: string;
  "x-csrf-token": string;
  cookie: string;
  "x-twitter-active-user"?: string;
  "x-twitter-auth-type"?: string;
  "x-twitter-client-language"?: string;
  "accept-language"?: string;
  "x-client-uuid"?: string;
  "x-client-transaction-id"?: string;
}
