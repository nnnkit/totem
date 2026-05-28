export interface StorageAreaLike {
  get(keys?: string | string[] | Record<string, unknown> | null): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string | string[]): Promise<void>;
}

export interface CookiesLike {
  get(details: { url: string; name: string }): Promise<{ value?: string } | null | undefined>;
}

export type AuthState = "authenticated" | "stale" | "logged_out";
export type SessionState = "unknown" | "logged_in" | "logged_out";

export interface AuthStatus {
  hasUser: boolean;
  hasAuth: boolean;
  userId: string | null;
  authState: AuthState;
  sessionState: SessionState;
}
