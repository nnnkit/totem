import type { Bookmark, ReadLogEntry, ReadingProgress } from "../types";
import { toLocalDateKey } from "./queue-builder";

export interface DailyStats {
  readCount: number;
  filedToActCount: number;
  timeMinutes: number;
}

export function computeDailyStats(
  readLog: ReadLogEntry[],
  bookmarks: Bookmark[],
  readingProgress: ReadingProgress[],
  today: Date,
): DailyStats {
  const todayKey = toLocalDateKey(today);

  const readCount = readLog.filter(
    (entry) => toLocalDateKey(new Date(entry.markedReadAt)) === todayKey,
  ).length;

  const filedToActCount = bookmarks.filter((b) => {
    if (b.intent !== "act_on" || !b.intentAssignedAt) return false;
    return toLocalDateKey(new Date(b.intentAssignedAt)) === todayKey;
  }).length;

  let timeMs = 0;
  for (const p of readingProgress) {
    if (
      p.lastReadAt > 0 &&
      p.openedAt > 0 &&
      p.lastReadAt > p.openedAt &&
      toLocalDateKey(new Date(p.lastReadAt)) === todayKey
    ) {
      timeMs += p.lastReadAt - p.openedAt;
    }
  }

  return {
    readCount,
    filedToActCount,
    timeMinutes: Math.round(timeMs / 60_000),
  };
}
