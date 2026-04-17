import { useCallback, useEffect, useRef, useState } from "react";
import type { Bookmark, DailyQueue } from "../types";
import { getDailyQueue, putDailyQueue } from "../db";
import {
  buildQueue,
  toLocalDateKey,
  addDaysToDateKey,
} from "../lib/queue-builder";
import { subscribeToReaderActivity } from "../lib/reader-activity";

export interface DailyQueueState {
  queue: DailyQueue | null;
  queueBookmarks: Bookmark[];
  loading: boolean;
  markCompleted: (bookmarkId: string) => void;
  markSkipped: (bookmarkId: string) => void;
}

export function useDailyQueue(
  bookmarks: Bookmark[],
  dailyQueueSize: number,
): DailyQueueState {
  const [queue, setQueue] = useState<DailyQueue | null>(null);
  const [loading, setLoading] = useState(true);
  const buildingRef = useRef(false);

  const todayKey = toLocalDateKey(new Date());

  useEffect(() => {
    if (bookmarks.length === 0) {
      setLoading(false);
      return;
    }
    if (buildingRef.current) return;

    let cancelled = false;
    buildingRef.current = true;

    (async () => {
      const existing = await getDailyQueue(todayKey);
      if (cancelled) return;

      if (existing) {
        setQueue(existing);
        setLoading(false);
        buildingRef.current = false;
        return;
      }

      const yesterdayKey = addDaysToDateKey(todayKey, -1);
      const yesterdayQueue = await getDailyQueue(yesterdayKey);
      if (cancelled) return;

      const built = buildQueue({
        bookmarks,
        yesterdayQueue,
        today: todayKey,
        size: dailyQueueSize,
      });

      const newQueue: DailyQueue = {
        date: todayKey,
        ...built,
        createdAt: Date.now(),
      };

      await putDailyQueue(newQueue);
      if (cancelled) return;

      setQueue(newQueue);
      setLoading(false);
      buildingRef.current = false;
    })().catch(() => {
      buildingRef.current = false;
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [todayKey, bookmarks.length, dailyQueueSize, bookmarks]);

  useEffect(() => {
    return subscribeToReaderActivity(() => {
      getDailyQueue(todayKey).then((q) => {
        if (q) setQueue(q);
      }).catch(() => {});
    });
  }, [todayKey]);

  const markCompleted = useCallback(
    (bookmarkId: string) => {
      setQueue((prev) => {
        if (!prev) return prev;
        if (prev.completedIds.includes(bookmarkId)) return prev;
        const next: DailyQueue = {
          ...prev,
          completedIds: [...prev.completedIds, bookmarkId],
        };
        void putDailyQueue(next);
        return next;
      });
    },
    [],
  );

  const markSkipped = useCallback(
    (bookmarkId: string) => {
      setQueue((prev) => {
        if (!prev) return prev;
        if (prev.skippedIds.includes(bookmarkId)) return prev;
        const next: DailyQueue = {
          ...prev,
          skippedIds: [...prev.skippedIds, bookmarkId],
        };
        void putDailyQueue(next);
        return next;
      });
    },
    [],
  );

  const queueBookmarks = queue
    ? queue.bookmarkIds
        .map((id) => bookmarks.find((b) => b.id === id))
        .filter((b): b is Bookmark => b != null)
    : [];

  return { queue, queueBookmarks, loading, markCompleted, markSkipped };
}
