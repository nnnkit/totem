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
 * Pass `unreadIds` to prune stale pins (read/reading) before checking the cap.
 */
export function togglePin(
  tweetId: string,
  unreadIds?: Set<string>,
): { ids: Set<string>; hitCap: boolean } {
  let arr = readPinnedArray();

  // Prune pins that are no longer unread
  if (unreadIds) {
    const before = arr.length;
    arr = arr.filter((id) => id === tweetId || unreadIds.has(id));
    if (arr.length !== before) writePinnedArray(arr);
  }

  const idx = arr.indexOf(tweetId);

  if (idx !== -1) {
    arr.splice(idx, 1);
    writePinnedArray(arr);
    return { ids: new Set(arr), hitCap: false };
  }

  if (arr.length >= MAX_PINS) {
    return { ids: new Set(arr), hitCap: true };
  }

  // Add to front (most recent pin first)
  arr.unshift(tweetId);
  writePinnedArray(arr);
  return { ids: new Set(arr), hitCap: false };
}

export function removePin(tweetId: string): void {
  const arr = readPinnedArray();
  const idx = arr.indexOf(tweetId);
  if (idx === -1) return;
  arr.splice(idx, 1);
  writePinnedArray(arr);
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
