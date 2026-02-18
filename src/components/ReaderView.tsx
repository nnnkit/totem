import { useEffect, useMemo, useState } from "react";
import type { Bookmark, ThreadTweet } from "../types";
import { fetchTweetDetail } from "../api/core/posts";

import { resolveTweetKind } from "./reader/utils";
import { TweetRenderer } from "./reader/TweetRenderer";
import { useReadingProgress } from "../hooks/useReadingProgress";

interface Props {
  bookmark: Bookmark;
  relatedBookmarks: Bookmark[];
  onOpenBookmark: (bookmark: Bookmark) => void;
  onBack: () => void;
  onShuffle?: () => void;
}

export function ReaderView({
  bookmark,
  relatedBookmarks,
  onOpenBookmark,
  onBack,
  onShuffle,
}: Props) {
  const [resolvedBookmark, setResolvedBookmark] = useState<Bookmark | null>(
    null,
  );
  const [detailThread, setDetailThread] = useState<ThreadTweet[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    setResolvedBookmark(null);
    setDetailThread([]);
    setDetailError(null);
    setDetailLoading(true);

    fetchTweetDetail(bookmark.tweetId)
      .then((detail) => {
        if (cancelled) return;

        if (detail.focalTweet) {
          setResolvedBookmark({
            ...detail.focalTweet,
            sortIndex: bookmark.sortIndex,
          });
        }

        if (detail.thread.length > 0) {
          setDetailThread(
            detail.thread.toSorted((a, b) => a.createdAt - b.createdAt),
          );
        }
      })
      .catch((error) => {
        if (cancelled) return;
        setDetailError(error instanceof Error ? error.message : "DETAIL_ERROR");
      })
      .finally(() => {
        if (!cancelled) {
          setDetailLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [bookmark.tweetId, bookmark.sortIndex]);

  useReadingProgress({
    tweetId: bookmark.tweetId,
    contentReady: !detailLoading,
  });

  const displayBookmark = resolvedBookmark || bookmark;
  const displayKind = useMemo(
    () => resolveTweetKind(displayBookmark),
    [displayBookmark],
  );

  useEffect(() => {
    const title =
      displayBookmark.article?.title ||
      displayBookmark.text.slice(0, 80) ||
      "Post";
    document.title = title;
    return () => {
      document.title = "New Tab";
    };
  }, [displayBookmark.article?.title, displayBookmark.text]);

  const containerWidthClass = "max-w-3xl";

  return (
    <div className="min-h-dvh bg-x-bg">
      <div className="sticky top-0 z-10 border-b border-x-border bg-x-bg/80 backdrop-blur-md">
        <div
          className={`mx-auto flex items-center gap-3 px-4 py-3 ${containerWidthClass}`}
        >
          <button
            onClick={onBack}
            aria-label="Back to bookmarks"
            className="rounded-full p-2 text-x-text transition-colors hover:bg-x-hover"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="currentColor">
              <path d="M7.414 13l5.043 5.04-1.414 1.42L3.586 12l7.457-7.46 1.414 1.42L7.414 11H21v2H7.414z" />
            </svg>
          </button>

          <span className="text-lg font-semibold text-x-text">Post</span>

          <div className="ml-auto flex items-center gap-3 text-xs text-x-text-secondary">
            <span className="flex items-center gap-1">
              <kbd className="font-sans">←</kbd>
              <kbd className="font-sans">→</kbd>
              <span className="ml-0.5">navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="font-sans">esc</kbd>
              <span className="ml-0.5">back</span>
            </span>
          </div>
        </div>
      </div>

      <article className={`${containerWidthClass} mx-auto px-5 pb-16 pt-6`}>
        <TweetRenderer
          displayBookmark={displayBookmark}
          displayKind={displayKind}
          detailThread={detailThread}
          detailLoading={detailLoading}
          detailError={detailError}
          relatedBookmarks={relatedBookmarks}
          onOpenBookmark={onOpenBookmark}
          onShuffle={onShuffle}
        />
      </article>

    </div>
  );
}
