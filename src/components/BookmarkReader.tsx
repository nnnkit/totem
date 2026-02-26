import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeftIcon,
  CaretLeftIcon,
  CaretRightIcon,
  SunIcon,
  MoonIcon,
} from "@phosphor-icons/react";
import type { Bookmark, Highlight, SelectionRange, ThreadTweet } from "../types";
import { fetchTweetDetail } from "../api/core/posts";
import { cn } from "../lib/cn";

import { resolveTweetKind } from "./reader/utils";
import { TweetContent } from "./reader/TweetContent";
import { SelectionToolbar } from "./reader/SelectionToolbar";
import { HighlightPopover } from "./reader/HighlightPopover";
import { NotePopover } from "./reader/NotePopover";
import { useReadingProgress } from "../hooks/useReadingProgress";
import { useTheme } from "../hooks/useTheme";
import { useHighlights } from "../hooks/useHighlights";
import { Button } from "./ui/Button";

interface Props {
  bookmark: Bookmark;
  relatedBookmarks: Bookmark[];
  onOpenBookmark: (bookmark: Bookmark) => void;
  onBack: () => void;
  onShuffle?: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  onDeleteBookmark?: () => void;
  onMarkAsRead?: (tweetId: string) => void;
  onMarkAsUnread?: (tweetId: string) => void;
  onLogin?: () => void;
}

interface NotePanelState {
  highlight: Highlight;
  anchorEl: HTMLElement;
  removeOnCancel?: boolean;
}

export function BookmarkReader({
  bookmark,
  relatedBookmarks,
  onOpenBookmark,
  onBack,
  onShuffle,
  onPrev,
  onNext,
  onDeleteBookmark,
  onMarkAsRead,
  onMarkAsUnread,
  onLogin,
}: Props) {
  const articleRef = useRef<HTMLElement>(null);
  const { resolvedTheme, setThemePreference } = useTheme();
  const [readOverride, setReadOverride] = useState<boolean | null>(null);
  const [resolvedBookmark, setResolvedBookmark] = useState<Bookmark | null>(
    null,
  );
  const [detailThread, setDetailThread] = useState<ThreadTweet[]>([]);
  const [detailLoading, setDetailLoading] = useState(true);
  const [detailError, setDetailError] = useState<string | null>(null);
  const { isCompleted } = useReadingProgress({
    tweetId: bookmark.tweetId,
    contentReady: !detailLoading,
  });
  const effectiveMarkedRead = readOverride ?? isCompleted;

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

        setDetailLoading(false);
      })
      .catch((error) => {
        if (cancelled) return;
        setDetailError(error instanceof Error ? error.message : "DETAIL_ERROR");
        setDetailLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [bookmark.tweetId, bookmark.sortIndex]);

  const { addHighlight, removeHighlight, updateHighlightNote, getHighlight, applyNow, setPendingNoteId } =
    useHighlights({
      tweetId: bookmark.tweetId,
      contentReady: !detailLoading,
      containerRef: articleRef,
    });

  const [notePanelState, setNotePanelState] = useState<NotePanelState | null>(null);

  useEffect(() => {
    const container = articleRef.current;
    if (!container) return;
    if (notePanelState) {
      container.dataset.notePopoverOpen = "";
    } else {
      delete container.dataset.notePopoverOpen;
    }
  }, [notePanelState]);

  const handleAddNoteFromToolbar = useCallback(
    async (ranges: SelectionRange[]) => {
      const created = await addHighlight(ranges, { type: "note" });
      if (created.length === 0) return;
      const highlight = created[0];
      setPendingNoteId(highlight.id);
      applyNow();
      const marks = document.querySelectorAll(
        `mark[data-highlight-id="${highlight.id}"]`,
      );
      const lastMark = marks[marks.length - 1] as HTMLElement | undefined;
      if (lastMark) {
        setNotePanelState({ highlight, anchorEl: lastMark, removeOnCancel: true });
      }
    },
    [addHighlight, applyNow, setPendingNoteId],
  );

  const handleSaveNote = useCallback(
    async (note: string, highlightId: string) => {
      setPendingNoteId(null);
      await updateHighlightNote(highlightId, note);
    },
    [updateHighlightNote, setPendingNoteId],
  );

  const handleDeleteNote = useCallback(
    async (highlightId: string) => {
      const highlight = getHighlight(highlightId);
      if (highlight?.type === "note") {
        await removeHighlight(highlightId);
      } else {
        await updateHighlightNote(highlightId, null);
      }
    },
    [getHighlight, removeHighlight, updateHighlightNote],
  );

  const handleToggleRead = useCallback(() => {
    if (effectiveMarkedRead) {
      onMarkAsUnread?.(bookmark.tweetId);
      setReadOverride(false);
    } else {
      onMarkAsRead?.(bookmark.tweetId);
      setReadOverride(true);
    }
  }, [effectiveMarkedRead, onMarkAsRead, onMarkAsUnread, bookmark.tweetId]);

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

  const containerWidthClass = "max-w-2xl";

  return (
    <div className="reader-page min-h-dvh">
      <div className="sticky top-0 z-10 border-b border-border bg-surface/80 backdrop-blur-md">
        <div
          className={cn("mx-auto flex items-center gap-3 px-6 py-2.5", containerWidthClass)}
        >
          <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back to bookmarks" title="Back">
            <ArrowLeftIcon className="size-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto"
            onClick={() => setThemePreference(resolvedTheme === "dark" ? "light" : "dark")}
            aria-label="Toggle theme"
            title={resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {resolvedTheme === "dark" ? <SunIcon className="size-5" /> : <MoonIcon className="size-5" />}
          </Button>
        </div>
      </div>

      {onPrev && (
        <button
          onClick={onPrev}
          aria-label="Previous post"
          title="Previous"
          className="fixed left-4 top-1/2 z-20 -translate-y-1/2 rounded bg-surface/80 p-3 text-muted shadow-md border border-border backdrop-blur-sm transition-colors hover:bg-surface-hover hover:text-foreground"
        >
          <CaretLeftIcon className="size-5" />
        </button>
      )}

      {onNext && (
        <button
          onClick={onNext}
          aria-label="Next post"
          title="Next"
          className="fixed right-4 top-1/2 z-20 -translate-y-1/2 rounded bg-surface/80 p-3 text-muted shadow-md border border-border backdrop-blur-sm transition-colors hover:bg-surface-hover hover:text-foreground"
        >
          <CaretRightIcon className="size-5" />
        </button>
      )}

      <article
        ref={articleRef}
        className={cn(containerWidthClass, "relative mx-auto px-6 pb-16 pt-8")}
      >
        <TweetContent
          displayBookmark={displayBookmark}
          displayKind={displayKind}
          detailThread={detailThread}
          detailLoading={detailLoading}
          detailError={detailError}
          relatedBookmarks={relatedBookmarks}
          onOpenBookmark={onOpenBookmark}
          onShuffle={onShuffle}
          tweetSectionIdPrefix="section-tweet"
          onToggleRead={onMarkAsRead ? handleToggleRead : undefined}
          isMarkedRead={effectiveMarkedRead}
          onDeleteBookmark={onDeleteBookmark}
          onLogin={onLogin}
        />
      </article>

      <SelectionToolbar
        containerRef={articleRef}
        tweetUrl={`https://x.com/${displayBookmark.author.screenName}/status/${displayBookmark.tweetId}`}
        onHighlight={(ranges) => addHighlight(ranges)}
        onAddNote={handleAddNoteFromToolbar}
      />

      <HighlightPopover
        containerRef={articleRef}
        getHighlight={getHighlight}
        onDelete={removeHighlight}
        onAddNote={(hl, anchorEl) => setNotePanelState({ highlight: hl, anchorEl })}
        onOpenNote={(hl, anchorEl) => setNotePanelState({ highlight: hl, anchorEl })}
      />

      {notePanelState && (
        <NotePopover
          highlight={notePanelState.highlight}
          anchorEl={notePanelState.anchorEl}
          onSaveNote={handleSaveNote}
          onDeleteNote={handleDeleteNote}
          onClose={() => {
            setPendingNoteId(null);
            if (notePanelState.removeOnCancel) {
              const latest = getHighlight(notePanelState.highlight.id);
              if (latest && !latest.note) {
                removeHighlight(latest.id);
              }
            }
            setNotePanelState(null);
          }}
        />
      )}
    </div>
  );
}
