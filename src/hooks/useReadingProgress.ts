import { useEffect, useRef, useState } from "react";
import { upsertReadingProgress, getReadingProgress } from "../db";
import type { ReadingProgress } from "../types";

interface UseReadingProgressOptions {
  tweetId: string;
  contentReady: boolean;
}

export function useReadingProgress({
  tweetId,
  contentReady,
}: UseReadingProgressOptions): void {
  const savedProgress = useRef<ReadingProgress | null>(null);
  const restoredRef = useRef(false);
  const tweetIdRef = useRef(tweetId);
  const debounceTimer = useRef<number | null>(null);
  const [progressLoaded, setProgressLoaded] = useState(false);

  // Reset on tweet change
  useEffect(() => {
    let cancelled = false;

    tweetIdRef.current = tweetId;
    restoredRef.current = false;
    savedProgress.current = null;
    setProgressLoaded(false);

    getReadingProgress(tweetId)
      .then((progress) => {
        if (cancelled || tweetIdRef.current !== tweetId) return;
        savedProgress.current = progress;
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled && tweetIdRef.current === tweetId) {
          setProgressLoaded(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [tweetId]);

  // Scroll restoration
  useEffect(() => {
    if (!contentReady || !progressLoaded || restoredRef.current) return;
    restoredRef.current = true;

    const progress = savedProgress.current;
    if (!progress || progress.completed) {
      window.scrollTo(0, 0);
      return;
    }

    requestAnimationFrame(() => {
      const contentEl = document.getElementById("section-main-tweet");

      if (progress.contentBased && contentEl && contentEl.offsetHeight > 0) {
        // Content-relative restoration
        const contentTop = contentEl.getBoundingClientRect().top + window.scrollY;
        const readPixels = (progress.scrollPercent / 100) * contentEl.offsetHeight;
        const targetScrollY = contentTop - window.innerHeight + readPixels;
        window.scrollTo(0, Math.max(0, targetScrollY));
      } else {
        // Legacy restoration
        const currentHeight = document.documentElement.scrollHeight;
        const heightChanged =
          progress.scrollHeight > 0 &&
          Math.abs(currentHeight - progress.scrollHeight) / progress.scrollHeight > 0.15;

        if (heightChanged) {
          const targetY = (progress.scrollPercent / 100) * currentHeight;
          window.scrollTo(0, targetY);
        } else {
          window.scrollTo(0, progress.scrollY);
        }
      }
    });
  }, [contentReady, progressLoaded, tweetId]);

  // Scroll tracking
  useEffect(() => {
    const saveProgress = () => {
      const scrollY = window.scrollY;
      const scrollHeight = document.documentElement.scrollHeight;

      let scrollPercent: number;
      let contentBased = false;

      const contentEl = document.getElementById("section-main-tweet");
      if (contentEl && contentEl.offsetHeight > 0) {
        const rect = contentEl.getBoundingClientRect();
        const readPixels = window.innerHeight - rect.top;
        scrollPercent = Math.round(
          Math.min(100, Math.max(0, (readPixels / rect.height) * 100))
        );
        contentBased = true;
      } else {
        const clientHeight = document.documentElement.clientHeight;
        const maxScroll = scrollHeight - clientHeight;
        scrollPercent =
          maxScroll > 0 ? Math.round((scrollY / maxScroll) * 100) : 0;
      }

      const completed = scrollPercent >= 90;

      const progress: ReadingProgress = {
        tweetId: tweetIdRef.current,
        scrollPercent,
        scrollY,
        scrollHeight,
        lastReadAt: Date.now(),
        completed,
        contentBased,
      };

      savedProgress.current = progress;
      upsertReadingProgress(progress);
    };

    const onScroll = () => {
      if (debounceTimer.current !== null) {
        window.clearTimeout(debounceTimer.current);
      }
      debounceTimer.current = window.setTimeout(saveProgress, 3000);
    };

    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      if (debounceTimer.current !== null) {
        window.clearTimeout(debounceTimer.current);
        debounceTimer.current = null;
      }
      // Final save on unmount
      saveProgress();
    };
  }, [tweetId]);
}
