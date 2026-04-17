import { useEffect, useState } from "react";
import { getReadLog, getAllReadingProgress } from "../db";
import { computeDailyStats, type DailyStats } from "../lib/daily-progress";
import { subscribeToReaderActivity } from "../lib/reader-activity";
import type { Bookmark } from "../types";

const EMPTY: DailyStats = { readCount: 0, filedToActCount: 0, timeMinutes: 0 };

export function useDailyStats(
  bookmarks: Bookmark[],
  enabled: boolean,
): DailyStats {
  const [stats, setStats] = useState<DailyStats>(EMPTY);

  useEffect(() => {
    if (!enabled) return;

    const refresh = async () => {
      const [readLog, progress] = await Promise.all([
        getReadLog(),
        getAllReadingProgress(),
      ]);
      setStats(computeDailyStats(readLog, bookmarks, progress, new Date()));
    };

    refresh().catch(() => {});
    return subscribeToReaderActivity(() => {
      refresh().catch(() => {});
    });
  }, [enabled, bookmarks]);

  return stats;
}
