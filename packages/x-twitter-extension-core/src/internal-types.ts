export type { AuthState, AuthStatus, CookiesLike, SessionState, StorageAreaLike } from "./types";

export interface ParsedGraphqlEndpoint {
  queryId: string;
  operation: string;
  variables: string | null;
  features: string | null;
  fieldToggles: string | null;
  path: string;
  fullUrl: string;
}
