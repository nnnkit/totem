import { LS_PINNED_TWEETS } from "./storage-keys";

const MAX_PINS = 6;

function readPinnedArray(): string[] {
  try {
    const raw = localStorage.getItem(LS_PINNED_TWEETS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === "string");
  } catch {
    return [];
  }
}

function writePinnedArray(ids: string[]): void {
  localStorage.setItem(LS_PINNED_TWEETS, JSON.stringify(ids));
}

export function getPinnedTweetIds(): Set<string> {
  return new Set(readPinnedArray());
}

/** Returns ordered array of pinned IDs (most recently pinned first). */
export function getPinnedTweetIdsOrdered(): string[] {
  return readPinnedArray();
}

/**
 * Toggles a pin. Returns `{ ids, hitCap }`.
 * `hitCap` is true when the pin was rejected because MAX_PINS was reached.
 * Pass `unreadIds` so the cap only counts unread pins (reading/read pins are uncapped).
 */
export function togglePin(
  tweetId: string,
  unreadIds?: Set<string>,
): { ids: Set<string>; hitCap: boolean } {
  const arr = readPinnedArray();
  const idx = arr.indexOf(tweetId);

  if (idx !== -1) {
    arr.splice(idx, 1);
    writePinnedArray(arr);
    return { ids: new Set(arr), hitCap: false };
  }

  // Cap only applies to unread pins
  const unreadPinCount = unreadIds
    ? arr.filter((id) => unreadIds.has(id)).length
    : arr.length;

  if (unreadIds?.has(tweetId) && unreadPinCount >= MAX_PINS) {
    return { ids: new Set(arr), hitCap: true };
  }

  // Add to front (most recent pin first)
  arr.unshift(tweetId);
  writePinnedArray(arr);
  return { ids: new Set(arr), hitCap: false };
}

export function isPinned(tweetId: string): boolean {
  return readPinnedArray().includes(tweetId);
}

export function subscribeToPinChanges(cb: () => void): () => void {
  const handler = (event: StorageEvent) => {
    if (event.key === LS_PINNED_TWEETS) cb();
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}
