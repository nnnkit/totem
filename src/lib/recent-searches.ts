import { LS_RECENT_SEARCHES } from "./storage-keys";

const MAX_RECENT = 6;

/** Read recent searches from localStorage. Newest first. */
export function readRecentSearches(): string[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(LS_RECENT_SEARCHES);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === "string").slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

/** Add a query to recent searches, deduped, capped at MAX_RECENT. Newest first. */
export function pushRecentSearch(query: string): string[] {
  const trimmed = query.trim();
  if (!trimmed) return readRecentSearches();
  const current = readRecentSearches();
  const next = [trimmed, ...current.filter((q) => q !== trimmed)].slice(
    0,
    MAX_RECENT,
  );
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(LS_RECENT_SEARCHES, JSON.stringify(next));
    } catch {
      // Quota or disabled storage — soft-fail.
    }
  }
  return next;
}

export function clearRecentSearches(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(LS_RECENT_SEARCHES);
  } catch {
    // ignore
  }
}

export function removeRecentSearch(query: string): string[] {
  const current = readRecentSearches();
  const next = current.filter((q) => q !== query);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(LS_RECENT_SEARCHES, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}
