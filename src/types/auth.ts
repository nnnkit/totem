// Canonical auth types for service worker ↔ frontend contracts

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

/** Captured auth headers stored in chrome.storage.local */
export interface AuthSnapshot {
  authorization: string;
  "x-csrf-token": string;
  cookie: string;
  "x-client-uuid"?: string;
  "x-twitter-active-user"?: string;
  "x-twitter-auth-type"?: string;
  "x-twitter-client-language"?: string;
}

export interface ReauthStatus {
  inProgress: boolean;
}
