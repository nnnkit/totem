import type { ReadLogEntry } from "../types";

export interface StreakResult {
  current: number;
  longest: number;
  isAtRisk: boolean;
  earnedToday: boolean;
}

const READS_PER_DAY_THRESHOLD = 2;

function toLocalDateKey(timestamp: number, tzOffset: number): string {
  const d = new Date(timestamp + tzOffset * 60_000);
  return d.toISOString().slice(0, 10);
}

function getTzOffset(date: Date): number {
  return -date.getTimezoneOffset();
}

function addDays(dateKey: string, days: number): string {
  const d = new Date(dateKey + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function computeStreak(
  readLog: ReadLogEntry[],
  today: Date,
): StreakResult {
  if (readLog.length === 0) {
    return { current: 0, longest: 0, isAtRisk: false, earnedToday: false };
  }

  const tzOffset = getTzOffset(today);
  const todayKey = toLocalDateKey(today.getTime(), tzOffset);

  const countsByDay = new Map<string, number>();
  for (const entry of readLog) {
    const key = toLocalDateKey(entry.markedReadAt, tzOffset);
    countsByDay.set(key, (countsByDay.get(key) ?? 0) + 1);
  }

  const qualifyingDays = new Set<string>();
  for (const [day, count] of countsByDay) {
    if (count >= READS_PER_DAY_THRESHOLD) {
      qualifyingDays.add(day);
    }
  }

  const earnedToday = qualifyingDays.has(todayKey);

  const sorted = Array.from(qualifyingDays).sort();
  let longest = 0;
  let current = 0;

  if (sorted.length > 0) {
    let runLength = 1;
    for (let i = 1; i < sorted.length; i++) {
      if (addDays(sorted[i - 1], 1) === sorted[i]) {
        runLength++;
      } else {
        if (runLength > longest) longest = runLength;
        runLength = 1;
      }
    }
    if (runLength > longest) longest = runLength;

    const lastQualifying = sorted[sorted.length - 1];
    if (lastQualifying === todayKey || lastQualifying === addDays(todayKey, -1)) {
      let streak = 1;
      let cursor = lastQualifying;
      for (let i = sorted.length - 2; i >= 0; i--) {
        const expected = addDays(cursor, -1);
        if (sorted[i] === expected) {
          streak++;
          cursor = sorted[i];
        } else {
          break;
        }
      }
      current = streak;
    }
  }

  const yesterdayKey = addDays(todayKey, -1);
  const isAtRisk =
    current > 0 && !earnedToday && qualifyingDays.has(yesterdayKey);

  return { current, longest, isAtRisk, earnedToday };
}
