import { useCallback, useEffect, useState } from "react";
import { getReadLog } from "../db";
import { computeStreak, type StreakResult } from "../lib/streak-tracker";
import { subscribeToReaderActivity } from "../lib/reader-activity";

const EMPTY: StreakResult = { current: 0, longest: 0, isAtRisk: false, earnedToday: false };

export function useStreak(): StreakResult {
  const [result, setResult] = useState<StreakResult>(EMPTY);

  const refresh = useCallback(() => {
    getReadLog()
      .then((log) => setResult(computeStreak(log, new Date())))
      .catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
    return subscribeToReaderActivity(refresh);
  }, [refresh]);

  return result;
}
