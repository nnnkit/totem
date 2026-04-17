import type { Bookmark, DailyQueue } from "../types";

export interface QueueBuilderInput {
  bookmarks: Bookmark[];
  yesterdayQueue: DailyQueue | null;
  today: string;
  size: number;
}

export interface BuiltQueue {
  bookmarkIds: string[];
  completedIds: string[];
  skippedIds: string[];
}

function isInCooldown(bookmark: Bookmark, now: number): boolean {
  if (!bookmark.cooldownUntil) return false;
  return new Date(bookmark.cooldownUntil).getTime() > now;
}

export function buildQueue(input: QueueBuilderInput): BuiltQueue {
  const { bookmarks, yesterdayQueue, today, size } = input;
  const now = new Date(today + "T12:00:00").getTime();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

  const byId = new Map<string, Bookmark>();
  for (const b of bookmarks) {
    byId.set(b.id, b);
  }

  const picked = new Set<string>();
  const result: string[] = [];

  function add(id: string): boolean {
    if (picked.has(id)) return false;
    if (result.length >= size) return false;
    picked.add(id);
    result.push(id);
    return true;
  }

  // 1. Carry over yesterday's skipped (that still exist and aren't in cooldown)
  if (yesterdayQueue) {
    for (const id of yesterdayQueue.skippedIds) {
      if (result.length >= size) break;
      const b = byId.get(id);
      if (!b || isInCooldown(b, now)) continue;
      if ((b.skipCount ?? 0) >= 3 && b.intentSource !== "manual") continue;
      add(id);
    }
  }

  function shouldExclude(b: Bookmark): boolean {
    if (isInCooldown(b, now)) return true;
    if ((b.skipCount ?? 0) >= 3 && b.intentSource !== "manual") return true;
    return false;
  }

  // 2. All Act-on items not in cooldown
  const actOn = bookmarks
    .filter(
      (b) =>
        b.intent === "act_on" && !shouldExclude(b) && !picked.has(b.id),
    )
    .sort((a, b) => a.createdAt - b.createdAt);
  for (const b of actOn) {
    if (result.length >= size) break;
    add(b.id);
  }

  // 3. Oldest Read-soon items not in cooldown
  const readSoon = bookmarks
    .filter(
      (b) =>
        b.intent === "read_soon" &&
        !shouldExclude(b) &&
        !picked.has(b.id),
    )
    .sort((a, b) => a.createdAt - b.createdAt);
  for (const b of readSoon) {
    if (result.length >= size) break;
    add(b.id);
  }

  // 4. 1–2 recent Read-soon saves (last 7 days) for variety
  if (result.length < size) {
    const recentReadSoon = bookmarks
      .filter(
        (b) =>
          b.intent === "read_soon" &&
          !shouldExclude(b) &&
          !picked.has(b.id) &&
          b.createdAt >= sevenDaysAgo,
      )
      .sort((a, b) => b.createdAt - a.createdAt);

    let added = 0;
    for (const b of recentReadSoon) {
      if (result.length >= size || added >= 2) break;
      if (add(b.id)) added++;
    }
  }

  return {
    bookmarkIds: result,
    completedIds: [],
    skippedIds: [],
  };
}

export function toLocalDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDaysToDateKey(dateKey: string, days: number): string {
  const d = new Date(dateKey + "T12:00:00");
  d.setDate(d.getDate() + days);
  return toLocalDateKey(d);
}
