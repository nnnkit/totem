import { useEffect, useRef, useState } from "react";
import { getReadingProgress } from "../db";
import type { ReadingProgress } from "../types";
import { READING_HEIGHT_CHANGE_RATIO } from "../lib/constants";

interface UseReadingProgressOptions {
  tweetId: string;
  contentReady: boolean;
}

interface UseReadingProgressResult {
  isCompleted: boolean;
}

export function useReadingProgress({
  tweetId,
  contentReady,
}: UseReadingProgressOptions): UseReadingProgressResult {
  const savedProgress = useRef<ReadingProgress | null>(null);
  const restoredRef = useRef(false);
  const [progressLoaded, setProgressLoaded] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const currentTweetId = tweetId;

    restoredRef.current = false;
    savedProgress.current = null;
    setProgressLoaded(false);
    setIsCompleted(false);

    getReadingProgress(currentTweetId)
      .then((progress) => {
        if (cancelled) return;
        savedProgress.current = progress;
        if (progress?.completed) setIsCompleted(true);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) {
          setProgressLoaded(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [tweetId]);

  useEffect(() => {
    if (!contentReady || !progressLoaded || restoredRef.current) return;
    restoredRef.current = true;

    const progress = savedProgress.current;
    if (!progress || progress.completed) {
      window.scrollTo(0, 0);
      return;
    }

    requestAnimationFrame(() => {
      const currentHeight = document.documentElement.scrollHeight;
      const heightChanged =
        progress.scrollHeight > 0 &&
        Math.abs(currentHeight - progress.scrollHeight) /
          progress.scrollHeight >
          READING_HEIGHT_CHANGE_RATIO;

      if (heightChanged) {
        const ratio =
          progress.scrollHeight > 0
            ? progress.scrollY / progress.scrollHeight
            : 0;
        window.scrollTo(0, ratio * currentHeight);
      } else {
        window.scrollTo(0, progress.scrollY);
      }
    });
  }, [contentReady, progressLoaded, tweetId]);

  return { isCompleted };
}
