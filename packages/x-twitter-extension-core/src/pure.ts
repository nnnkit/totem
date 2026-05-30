import type { AuthState, ParsedGraphqlEndpoint } from "./internal-types";

export type { ParsedGraphqlEndpoint } from "./internal-types";

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

export interface ParsedTweetUrl {
  handle: string;
  id: string;
  canonicalUrl: string;
  host: "x.com" | "twitter.com" | "mobile.twitter.com";
}

const TWEET_URL_HOSTS = new Set([
  "x.com",
  "www.x.com",
  "twitter.com",
  "www.twitter.com",
  "mobile.twitter.com",
]);

export function parseTweetUrl(input: string): ParsedTweetUrl | null {
  try {
    const url = new URL(String(input || "").trim());
    const host = url.hostname.toLowerCase();
    if (!TWEET_URL_HOSTS.has(host)) return null;

    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length < 3) return null;
    const [handle, statusSegment, id] = parts;
    if (
      !handle ||
      !id ||
      !/^[A-Za-z0-9_]{1,20}$/.test(handle) ||
      !/^(?:status|statuses)$/i.test(statusSegment ?? "") ||
      !/^\d{1,24}$/.test(id)
    ) {
      return null;
    }

    const normalizedHost =
      host === "mobile.twitter.com" ? "mobile.twitter.com" : host.endsWith("twitter.com") ? "twitter.com" : "x.com";

    return {
      handle,
      id,
      canonicalUrl: `https://x.com/${handle}/status/${id}`,
      host: normalizedHost,
    };
  } catch {
    return null;
  }
}

export function isTweetUrl(input: string): boolean {
  return parseTweetUrl(input) !== null;
}

export function canonicalTweetUrl(input: string): string | null {
  return parseTweetUrl(input)?.canonicalUrl ?? null;
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

export function isValidOperationName(operationName: unknown): operationName is string {
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
    queryKey + "\\s*:\\s*" + idValue + "\\s*,\\s*" + opKey + "\\s*:\\s*" + opValue,
  );
  const match = text.match(pattern);
  if (match?.[1]) return match[1];

  const reversed = new RegExp(
    opKey + "\\s*:\\s*" + opValue + "\\s*,\\s*" + queryKey + "\\s*:\\s*" + idValue,
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
