import { useEffect, useRef, useState } from "react";
import { upsertReadingProgress, getReadingProgress } from "../db";
import type { ReadingProgress } from "../types";
import {
  READING_SAVE_DEBOUNCE_MS,
  READING_SCROLL_THRESHOLD_PX,
  READING_MIN_SCROLL_HEIGHT_PX,
  READING_HEIGHT_CHANGE_RATIO,
} from "../lib/constants";

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
  const debounceTimer = useRef<number | null>(null);
  const shortContentTimer = useRef<number | null>(null);
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

  useEffect(() => {
    const currentTweetId = tweetId;

    const saveProgress = () => {
      const scrollY = window.scrollY;
      const scrollHeight = document.documentElement.scrollHeight;
      const clientHeight = document.documentElement.clientHeight;
      const maxScroll = scrollHeight - clientHeight;
      const completed = maxScroll > READING_MIN_SCROLL_HEIGHT_PX && scrollY + clientHeight >= scrollHeight - READING_SCROLL_THRESHOLD_PX;

      const existing = savedProgress.current;
      const progress: ReadingProgress = {
        tweetId: currentTweetId,
        openedAt: existing?.openedAt ?? Date.now(),
        lastReadAt: Date.now(),
        scrollY,
        scrollHeight,
        completed: existing?.completed || completed,
      };

      savedProgress.current = progress;
      upsertReadingProgress(progress);
    };

    const checkShortContent = () => {
      const scrollHeight = document.documentElement.scrollHeight;
      const clientHeight = document.documentElement.clientHeight;
      const maxScroll = scrollHeight - clientHeight;

      if (maxScroll <= READING_MIN_SCROLL_HEIGHT_PX) {
        shortContentTimer.current = window.setTimeout(() => {
          const existing = savedProgress.current;
          const progress: ReadingProgress = {
            tweetId: currentTweetId,
            openedAt: existing?.openedAt ?? Date.now(),
            lastReadAt: Date.now(),
            scrollY: 0,
            scrollHeight: document.documentElement.scrollHeight,
            completed: true,
          };
          savedProgress.current = progress;
          upsertReadingProgress(progress);
        }, READING_SAVE_DEBOUNCE_MS);
      }
    };

    if (contentReady) {
      checkShortContent();
    }

    const onScroll = () => {
      if (shortContentTimer.current !== null) {
        window.clearTimeout(shortContentTimer.current);
        shortContentTimer.current = null;
      }
      if (debounceTimer.current !== null) {
        window.clearTimeout(debounceTimer.current);
      }
      debounceTimer.current = window.setTimeout(saveProgress, READING_SAVE_DEBOUNCE_MS);
    };

    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      if (debounceTimer.current !== null) {
        window.clearTimeout(debounceTimer.current);
        debounceTimer.current = null;
      }
      if (shortContentTimer.current !== null) {
        window.clearTimeout(shortContentTimer.current);
        shortContentTimer.current = null;
      }
      saveProgress();
    };
  }, [tweetId, contentReady]);

  return { isCompleted };
}
