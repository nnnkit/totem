import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useHotkeys } from "react-hotkeys-hook";
import {
  ArrowLeftIcon,
  ArrowsClockwiseIcon,
  MagnifyingGlassIcon,
} from "@phosphor-icons/react";
import type { Bookmark } from "../types";
import type { ContinueReadingItem } from "../hooks/useContinueReading";
import { useBookmarkSearch } from "../hooks/useBookmarkSearch";
import { pickTitle, estimateReadingMinutes } from "../lib/bookmark-utils";
import { timeAgo, sortIndexToTimestamp } from "../lib/time";
import { cn } from "../lib/cn";
import { NEW_BADGE_CUTOFF_MS } from "../lib/constants";

export type ReadingTab = "continue" | "read" | "unread";

interface Props {
  continueReadingItems: ContinueReadingItem[];
  unreadBookmarks: Bookmark[];
  syncing: boolean;
  activeTab: ReadingTab;
  onTabChange: (tab: ReadingTab) => void;
  onOpenBookmark: (bookmark: Bookmark) => void;
  onSync: () => void;
  onBack: () => void;
}

function inferKindBadge(bookmark: Bookmark): string {
  if (bookmark.tweetKind === "article") return "Article";
  if (bookmark.tweetKind === "thread" || bookmark.isThread) return "Thread";
  if (bookmark.hasLink) return "Link";
  return "Post";
}

export function BookmarksList({
  continueReadingItems,
  unreadBookmarks,
  syncing,
  activeTab,
  onTabChange,
  onOpenBookmark,
  onSync,
  onBack,
}: Props) {
  const containerWidthClass = "max-w-3xl";
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [prevActiveTab, setPrevActiveTab] = useState(activeTab);
  if (prevActiveTab !== activeTab) {
    setPrevActiveTab(activeTab);
    setFocusedIndex(-1);
  }
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const tabListRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const continueTabRef = useRef<HTMLButtonElement>(null);
  const readTabRef = useRef<HTMLButtonElement>(null);
  const unreadTabRef = useRef<HTMLButtonElement>(null);
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  const allBookmarks = useMemo(() => {
    const seen = new Set<string>();
    const merged: Bookmark[] = [];
    for (const item of continueReadingItems) {
      if (!seen.has(item.bookmark.tweetId)) {
        seen.add(item.bookmark.tweetId);
        merged.push(item.bookmark);
      }
    }
    for (const b of unreadBookmarks) {
      if (!seen.has(b.tweetId)) {
        seen.add(b.tweetId);
        merged.push(b);
      }
    }
    return merged;
  }, [continueReadingItems, unreadBookmarks]);

  const { query, setQuery, results, isSearching } =
    useBookmarkSearch(allBookmarks);

  const matchingIds = useMemo(() => {
    if (!isSearching) return null;
    return new Set(results.map((b) => b.tweetId));
  }, [isSearching, results]);

  useHotkeys(
    "/",
    () => {
      searchInputRef.current?.focus();
    },
    { preventDefault: true },
  );

  const tabRefs: Record<
    ReadingTab,
    React.RefObject<HTMLButtonElement | null>
  > = {
    continue: continueTabRef,
    read: readTabRef,
    unread: unreadTabRef,
  };

  const updateIndicator = useCallback(() => {
    const container = tabListRef.current;
    const tab = tabRefs[activeTab].current;
    if (!container || !tab) return;
    const containerRect = container.getBoundingClientRect();
    const tabRect = tab.getBoundingClientRect();
    setIndicator({
      left: tabRect.left - containerRect.left,
      width: tabRect.width,
    });
  }, [activeTab]);

  useLayoutEffect(() => {
    updateIndicator();
  }, [updateIndicator]);

  const { inProgress, completed } = useMemo(() => {
    const ip: ContinueReadingItem[] = [];
    const cp: ContinueReadingItem[] = [];
    for (const item of continueReadingItems) {
      if (item.progress.completed) {
        cp.push(item);
      } else {
        ip.push(item);
      }
    }
    return { inProgress: ip, completed: cp };
  }, [continueReadingItems]);

  const newBookmarkIds = useMemo(() => {
    const cutoff = Date.now() - NEW_BADGE_CUTOFF_MS;
    const ids = new Set<string>();
    const all = [
      ...unreadBookmarks,
      ...continueReadingItems.map((item) => item.bookmark),
    ];
    for (const b of all) {
      if (sortIndexToTimestamp(b.sortIndex) >= cutoff) ids.add(b.tweetId);
    }
    return ids;
  }, [unreadBookmarks, continueReadingItems]);

  const filteredUnread = useMemo(
    () =>
      matchingIds
        ? unreadBookmarks.filter((b) => matchingIds.has(b.tweetId))
        : unreadBookmarks,
    [unreadBookmarks, matchingIds],
  );

  const filteredInProgress = useMemo(
    () =>
      matchingIds
        ? inProgress.filter((item) => matchingIds.has(item.bookmark.tweetId))
        : inProgress,
    [inProgress, matchingIds],
  );

  const filteredCompleted = useMemo(
    () =>
      matchingIds
        ? completed.filter((item) => matchingIds.has(item.bookmark.tweetId))
        : completed,
    [completed, matchingIds],
  );

  const visibleBookmarks = useMemo(() => {
    if (activeTab === "continue") {
      return filteredInProgress.map((item) => item.bookmark);
    }
    if (activeTab === "read") {
      return filteredCompleted.map((item) => item.bookmark);
    }
    return filteredUnread;
  }, [activeTab, filteredInProgress, filteredCompleted, filteredUnread]);

  useEffect(() => {
    if (focusedIndex >= 0 && focusedIndex < itemRefs.current.length) {
      itemRefs.current[focusedIndex]?.scrollIntoView({ block: "nearest" });
    }
  }, [focusedIndex]);

  useHotkeys(
    "j, ArrowDown",
    () => {
      setFocusedIndex((prev) =>
        prev < visibleBookmarks.length - 1 ? prev + 1 : prev,
      );
    },
    { preventDefault: true },
    [visibleBookmarks.length],
  );

  useHotkeys(
    "k, ArrowUp",
    () => {
      setFocusedIndex((prev) => (prev > 0 ? prev - 1 : prev));
    },
    { preventDefault: true },
  );

  useHotkeys(
    "enter, o",
    () => {
      if (focusedIndex >= 0 && focusedIndex < visibleBookmarks.length) {
        onOpenBookmark(visibleBookmarks[focusedIndex]);
      }
    },
    { preventDefault: true },
    [focusedIndex, visibleBookmarks, onOpenBookmark],
  );

  useHotkeys(
    "escape",
    () => onBack(),
    {
      preventDefault: true,
    },
    [onBack],
  );

  const tabOrder: ReadingTab[] = ["unread", "continue", "read"];
  useHotkeys(
    "tab",
    () => {
      const idx = tabOrder.indexOf(activeTab);
      onTabChange(tabOrder[(idx + 1) % tabOrder.length]);
    },
    { preventDefault: true },
    [activeTab, onTabChange],
  );

  let continueIdx = 0;

  return (
    <div className="min-h-dvh bg-x-bg">
      <div className="sticky top-0 z-10 border-b border-x-border bg-x-bg/80 backdrop-blur-md">
        <div
          className={cn(
            "mx-auto flex items-center gap-3 px-4 py-3",
            containerWidthClass,
          )}
        >
          <button
            onClick={onBack}
            aria-label="Back to home"
            title="Back"
            className="rounded-lg p-2 text-x-text transition-colors hover:bg-x-hover"
          >
            <ArrowLeftIcon className="size-5" />
          </button>
          <span className="text-lg font-semibold text-x-text">Reading</span>
          <div className="relative ml-auto mr-2 max-w-xs flex-1">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-x-text-secondary" />
            <input
              ref={searchInputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setQuery("");
                  searchInputRef.current?.blur();
                }
              }}
              placeholder="Search bookmarks..."
              className="w-full rounded-lg border border-x-border bg-x-card py-1.5 pl-9 pr-3 text-sm text-x-text placeholder:text-x-text-secondary/60 focus:border-accent focus:outline-none"
            />
          </div>
          <div>
            <button
              type="button"
              onClick={onSync}
              disabled={syncing}
              className="rounded-lg p-2 text-x-text-secondary transition-colors hover:bg-x-hover hover:text-x-text"
              aria-label="Sync bookmarks"
              title="Sync bookmarks"
            >
              <ArrowsClockwiseIcon
                className={cn("size-5", syncing && "animate-spin")}
              />
            </button>
          </div>
        </div>
        <div
          ref={tabListRef}
          className={cn("relative mx-auto flex px-4", containerWidthClass)}
          role="tablist"
        >
          <button
            ref={unreadTabRef}
            type="button"
            role="tab"
            aria-selected={activeTab === "unread"}
            onClick={() => onTabChange("unread")}
            className={cn(
              "px-4 py-2.5 text-sm font-medium transition-colors",
              activeTab === "unread"
                ? "text-x-text"
                : "text-x-text-secondary hover:text-x-text",
            )}
          >
            Unread
            {filteredUnread.length > 0 && (
              <span className="ml-1.5 inline-flex size-5 items-center justify-center rounded-md bg-x-text-secondary/10 text-xs tabular-nums text-x-text-secondary">
                {filteredUnread.length}
              </span>
            )}
          </button>
          <button
            ref={continueTabRef}
            type="button"
            role="tab"
            aria-selected={activeTab === "continue"}
            onClick={() => onTabChange("continue")}
            className={cn(
              "px-4 py-2.5 text-sm font-medium transition-colors",
              activeTab === "continue"
                ? "text-x-text"
                : "text-x-text-secondary hover:text-x-text",
            )}
          >
            Reading
            {filteredInProgress.length > 0 && (
              <span className="ml-1.5 inline-flex size-5 items-center justify-center rounded-md bg-accent/10 text-xs tabular-nums text-accent">
                {filteredInProgress.length}
              </span>
            )}
          </button>
          <button
            ref={readTabRef}
            type="button"
            role="tab"
            aria-selected={activeTab === "read"}
            onClick={() => onTabChange("read")}
            className={cn(
              "px-4 py-2.5 text-sm font-medium transition-colors",
              activeTab === "read"
                ? "text-x-text"
                : "text-x-text-secondary hover:text-x-text",
            )}
          >
            Read
            {filteredCompleted.length > 0 && (
              <span className="ml-1.5 inline-flex size-5 items-center justify-center rounded-md bg-x-success/10 text-xs tabular-nums text-x-success">
                {filteredCompleted.length}
              </span>
            )}
          </button>
          <span
            className="absolute bottom-0 h-0.5 rounded-full bg-accent transition-all duration-200 ease-[cubic-bezier(0.645,0.045,0.355,1)]"
            style={{ left: indicator.left, width: indicator.width }}
          />
        </div>
      </div>

      <main className={cn(containerWidthClass, "mx-auto px-4 pb-16 pt-6")}>
        {activeTab === "unread" && (
          <>
            {filteredUnread.length > 0 ? (
              <div className="space-y-2">
                {filteredUnread.map((bookmark, idx) => (
                  <button
                    key={bookmark.tweetId}
                    ref={(el) => {
                      itemRefs.current[idx] = el;
                    }}
                    type="button"
                    onClick={() => onOpenBookmark(bookmark)}
                    className={cn(
                      "bookmark-list-item flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-x-hover",
                      focusedIndex === idx
                        ? "border-accent ring-2 ring-accent/40 bg-x-hover"
                        : "border-x-border bg-x-card",
                    )}
                  >
                    <img
                      src={bookmark.author.profileImageUrl}
                      alt=""
                      className="size-10 shrink-0 rounded-full"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium text-x-text">
                          {pickTitle(bookmark)}
                        </p>
                        {newBookmarkIds.has(bookmark.tweetId) && (
                          <span className="shrink-0 rounded-md bg-accent px-2 py-0.5 text-xs font-medium text-white">
                            New
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-x-text-secondary">
                        @{bookmark.author.screenName} &middot;{" "}
                        {estimateReadingMinutes(bookmark)} min read &middot;{" "}
                        <span className="rounded bg-x-border/50 px-1.5 py-0.5 text-xs uppercase">
                          {inferKindBadge(bookmark)}
                        </span>
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <p className="text-x-text-secondary text-lg text-pretty">
                  All caught up! No unread bookmarks.
                </p>
                <button
                  type="button"
                  onClick={onSync}
                  className="mt-4 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
                >
                  Sync new bookmarks
                </button>
              </div>
            )}
          </>
        )}

        {activeTab === "continue" && (
          <>
            {filteredInProgress.length > 0 ? (
              <div className="space-y-2">
                {filteredInProgress.map(({ bookmark, progress }) => {
                  const idx = continueIdx++;
                  return (
                    <button
                      key={bookmark.tweetId}
                      ref={(el) => {
                        itemRefs.current[idx] = el;
                      }}
                      type="button"
                      onClick={() => onOpenBookmark(bookmark)}
                      className={cn(
                        "bookmark-list-item flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-x-hover",
                        focusedIndex === idx
                          ? "border-accent ring-2 ring-accent/40 bg-x-hover"
                          : "border-x-border bg-x-card",
                      )}
                    >
                      <img
                        src={bookmark.author.profileImageUrl}
                        alt=""
                        className="size-10 shrink-0 rounded-full"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium text-x-text">
                            {pickTitle(bookmark)}
                          </p>
                          {newBookmarkIds.has(bookmark.tweetId) && (
                            <span className="shrink-0 rounded-md bg-accent px-2 py-0.5 text-xs font-medium text-white">
                              New
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-x-text-secondary">
                          @{bookmark.author.screenName} &middot; Last read{" "}
                          {timeAgo(progress.lastReadAt)}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <p className="text-x-text-secondary text-lg text-pretty">
                  No reading in progress. Open a bookmark to start tracking.
                </p>
                <button
                  type="button"
                  onClick={() => onTabChange("unread")}
                  className="mt-4 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
                >
                  Browse unread
                </button>
              </div>
            )}
          </>
        )}

        {activeTab === "read" && (
          <>
            {filteredCompleted.length > 0 ? (
              <div className="space-y-2">
                {filteredCompleted.map(({ bookmark, progress }) => {
                  const idx = continueIdx++;
                  return (
                    <button
                      key={bookmark.tweetId}
                      ref={(el) => {
                        itemRefs.current[idx] = el;
                      }}
                      type="button"
                      onClick={() => onOpenBookmark(bookmark)}
                      className={cn(
                        "bookmark-list-item flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-x-hover",
                        focusedIndex === idx
                          ? "border-accent ring-2 ring-accent/40 bg-x-hover"
                          : "border-x-border bg-x-card",
                      )}
                    >
                      <img
                        src={bookmark.author.profileImageUrl}
                        alt=""
                        className="size-10 shrink-0 rounded-full"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium text-x-text">
                            {pickTitle(bookmark)}
                          </p>
                          {newBookmarkIds.has(bookmark.tweetId) && (
                            <span className="shrink-0 rounded-md bg-accent px-2 py-0.5 text-xs font-medium text-white">
                              New
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-x-text-secondary">
                          @{bookmark.author.screenName} &middot; Finished{" "}
                          {timeAgo(progress.lastReadAt)}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <p className="text-x-text-secondary text-lg text-pretty">
                  Nothing finished yet. Keep reading!
                </p>
                <button
                  type="button"
                  onClick={() => onTabChange("continue")}
                  className="mt-4 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
                >
                  Continue reading
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
