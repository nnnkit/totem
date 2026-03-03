export type DetailErrorKind = "none" | "offline" | "auth" | "other";

const AUTH_ERROR_CODES = new Set(["NO_AUTH", "AUTH_EXPIRED"]);
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

export function classifyDetailError(
  error: string | null,
  options: { isOnline?: boolean } = {},
): DetailErrorKind {
  if (!error) return "none";
  const normalized = error.trim();
  if (!normalized) return "none";
  if (AUTH_ERROR_CODES.has(normalized)) return "auth";
  if (options.isOnline === false) return "offline";

  const lower = normalized.toLowerCase();
  if (OFFLINE_ERROR_NEEDLES.some((needle) => lower.includes(needle))) {
    return "offline";
  }

  return "other";
}
