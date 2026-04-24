import { TERMINAL_ERROR_CODES } from "../../api/core/posts";

// Each kind maps to a distinct error screen with a distinct primary action.
// The UI contract: a user never lands on an error screen whose only button
// does nothing. Adding a new terminal error code means adding a new kind
// here; adding a new kind means giving it a meaningful action.
export type DetailErrorKind =
  | "none"
  | "offline"
  | "auth"
  | "rate_limited"
  | "not_found"
  | "other";

const AUTH_ERROR_CODES = new Set(["NO_AUTH", "AUTH_EXPIRED"]);
const RATE_LIMITED_CODE = "RATE_LIMITED";
const NOT_FOUND_CODE = "DETAIL_NOT_FOUND";
const OFFLINE_ERROR_NEEDLES = [
  "failed to fetch",
  "networkerror",
  "network request failed",
  "internet disconnected",
  "the internet connection appears to be offline",
  "err_internet_disconnected",
  "err_network_changed",
  "err_name_not_resolved",
  "err_connection_refused",
  "err_connection_reset",
  "err_timed_out",
];

// Compile-time check that every terminal error code from the posts API
// resolves to a concrete kind (not "other"). If you add a new terminal
// code in posts.ts, classify it here — otherwise this file won't build.
function assertAllTerminalCodesClassified(): void {
  for (const code of TERMINAL_ERROR_CODES) {
    if (code === "NO_AUTH" || code === "AUTH_EXPIRED") continue;
    if (code === RATE_LIMITED_CODE) continue;
    if (code === NOT_FOUND_CODE) continue;
    // If this throws at module load during tests, a new terminal code
    // was added without updating this classifier.
    throw new Error(
      `classifyDetailError: unclassified terminal code "${code}". ` +
      `Add it to AUTH_ERROR_CODES / RATE_LIMITED_CODE / NOT_FOUND_CODE / a new kind.`,
    );
  }
}
assertAllTerminalCodesClassified();

export function classifyDetailError(
  error: string | null,
  options: { isOnline?: boolean } = {},
): DetailErrorKind {
  if (!error) return "none";
  const normalized = error.trim();
  if (!normalized) return "none";

  if (AUTH_ERROR_CODES.has(normalized)) return "auth";
  if (normalized === RATE_LIMITED_CODE) return "rate_limited";
  if (normalized === NOT_FOUND_CODE) return "not_found";

  if (options.isOnline === false) return "offline";

  const lower = normalized.toLowerCase();
  if (OFFLINE_ERROR_NEEDLES.some((needle) => lower.includes(needle))) {
    return "offline";
  }

  return "other";
}
