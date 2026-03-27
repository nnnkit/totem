import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Tabs } from "@base-ui/react/tabs";
import { useHotkeys } from "react-hotkeys-hook";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  ArrowLeftIcon,
  ArrowsDownUpIcon,
  MagnifyingGlassIcon,
  PushPinIcon,
} from "@phosphor-icons/react";
import type { Bookmark } from "../types";
import type { ContinueReadingItem } from "../hooks/useContinueReading";
import { useBookmarkSearch } from "../hooks/useBookmarkSearch";
import { pickTitle, inferKindBadge } from "../lib/bookmark-utils";
import { cn } from "../lib/cn";
import { NEW_BADGE_CUTOFF_MS } from "../lib/constants";
import {
  getPinnedTweetIds,
  getPinnedTweetIdsOrdered,
  togglePin,
  subscribeToPinChanges,
} from "../lib/pins";
import {
  readStoredReadingSortPreferences,
  sortContinueReadingItems,
  sortUnreadBookmarks,
  writeStoredReadingSortPreferences,
  type ReadingSort,
  type ReadingSortPreferences,
  type ReadingTab,
} from "../lib/reading-list";
import { sortIndexToTimestamp, timeAgo } from "../lib/time";
import { getHighlightCountsByTweetIds, type HighlightCounts } from "../db";
import { subscribeToReaderActivity } from "../lib/reader-activity";
import {
  useIsOffline,
  useRuntimeActions,
  useSyncButtonState,
  type SyncButtonState,
} from "../stores/selectors";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { OfflineBanner } from "./ui/OfflineBanner";
import { Select, type SelectOption } from "./ui/Select";
import { Toast } from "./ui/Toast";

export type { ReadingTab } from "../lib/reading-list";

interface Props {
  continueReadingItems: ContinueReadingItem[];
  unreadBookmarks: Bookmark[];
  activeTab: ReadingTab;
  onTabChange: (tab: ReadingTab) => void;
  onOpenBookmark: (bookmark: Bookmark) => void;
  getBookmarkHref: (bookmark: Bookmark) => string;
  onSync: () => void;
  onBack: () => void;
  syncButtonStateOverride?: SyncButtonState;
  offlineModeOverride?: boolean;
  onLogin?: () => void;
}

interface BookmarkRow {
  bookmark: Bookmark;
  subtitle?: string;
}

const SORT_OPTIONS: SelectOption[] = [
  { value: "recent", label: "Recent" },
  { value: "oldest", label: "Oldest" },
  { value: "annotated", label: "Annotated" },
];

const ITEM_HEIGHT = 64;

function isReadingSort(value: string): value is ReadingSort {
  return value === "recent" || value === "oldest" || value === "annotated";
}

function getCounts(
  counts: ReadonlyMap<string, HighlightCounts>,
  tweetId: string,
): HighlightCounts | null {
  return counts.get(tweetId) ?? null;
}

function getBookmarkTimestamp(bookmark: Bookmark): number | null {
  try {
    return sortIndexToTimestamp(bookmark.sortIndex);
  } catch {
    return null;
  }
}

export function BookmarksList({
  continueReadingItems,
  unreadBookmarks,
  activeTab,
  onTabChange,
  onOpenBookmark,
  getBookmarkHref,
  onSync,
  onBack,
  syncButtonStateOverride,
  offlineModeOverride,
  onLogin,
}: Props) {
  const containerWidthClass = "max-w-3xl";
  const runtimeSyncButton = useSyncButtonState();
  const runtimeOfflineMode = useIsOffline();
  const actions = useRuntimeActions();
  const syncButton = syncButtonStateOverride ?? runtimeSyncButton;
  const offlineMode = offlineModeOverride ?? runtimeOfflineMode;
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [prevActiveTab, setPrevActiveTab] = useState(activeTab);
  const [sortPreferences, setSortPreferences] =
    useState<ReadingSortPreferences>(() => readStoredReadingSortPreferences());
  const [pinnedIds, setPinnedIds] = useState(() => getPinnedTweetIds());
  const [pinnedOrder, setPinnedOrder] = useState(() =>
    getPinnedTweetIdsOrdered(),
  );
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showUnpinButtons, setShowUnpinButtons] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const pinnedCardRefs = useRef<Map<number, HTMLAnchorElement>>(new Map());

  if (prevActiveTab !== activeTab) {
    setPrevActiveTab(activeTab);
    setFocusedIndex(-1);
  }

  useEffect(() => {
    return subscribeToPinChanges(() => {
      setPinnedIds(getPinnedTweetIds());
      setPinnedOrder(getPinnedTweetIdsOrdered());
    });
  }, []);

  useEffect(() => {
    if (!showUnpinButtons) return;
    const timer = setTimeout(() => setShowUnpinButtons(false), 3000);
    return () => clearTimeout(timer);
  }, [showUnpinButtons]);

  const allBookmarks = useMemo(() => {
    const seen = new Set<string>();
    const merged: Bookmark[] = [];
    for (const item of continueReadingItems) {
      if (!seen.has(item.bookmark.tweetId)) {
        seen.add(item.bookmark.tweetId);
        merged.push(item.bookmark);
      }
    }
    for (const bookmark of unreadBookmarks) {
      if (!seen.has(bookmark.tweetId)) {
        seen.add(bookmark.tweetId);
        merged.push(bookmark);
      }
    }
    return merged;
  }, [continueReadingItems, unreadBookmarks]);

  const { query, setQuery, results, isSearching } =
    useBookmarkSearch(allBookmarks);

  const matchingIds = useMemo(() => {
    if (!isSearching) return null;
    return new Set(results.map((bookmark) => bookmark.tweetId));
  }, [isSearching, results]);

  useHotkeys(
    "/",
    () => {
      searchInputRef.current?.focus();
    },
    { preventDefault: true },
  );

  const { inProgress, completed } = useMemo(() => {
    const nextInProgress: ContinueReadingItem[] = [];
    const nextCompleted: ContinueReadingItem[] = [];
    for (const item of continueReadingItems) {
      if (item.progress.completed) {
        nextCompleted.push(item);
      } else {
        nextInProgress.push(item);
      }
    }
    return { inProgress: nextInProgress, completed: nextCompleted };
  }, [continueReadingItems]);

  const newBookmarkIds = useMemo(() => {
    const cutoff = Date.now() - NEW_BADGE_CUTOFF_MS;
    const ids = new Set<string>();
    const merged = [
      ...unreadBookmarks,
      ...continueReadingItems.map((item) => item.bookmark),
    ];
    for (const bookmark of merged) {
      const timestamp = getBookmarkTimestamp(bookmark);
      if (
        timestamp !== null &&
        bookmark.sortIndex !== bookmark.tweetId &&
        timestamp >= cutoff
      ) {
        ids.add(bookmark.tweetId);
      }
    }
    return ids;
  }, [unreadBookmarks, continueReadingItems]);

  const [highlightCounts, setHighlightCounts] = useState<
    Map<string, HighlightCounts>
  >(new Map());

  const visibleTweetIds = useMemo(() => {
    if (activeTab === "continue") {
      return continueReadingItems
        .filter((item) => !item.progress.completed)
        .map((item) => item.bookmark.tweetId);
    }
    if (activeTab === "read") {
      return continueReadingItems
        .filter((item) => item.progress.completed)
        .map((item) => item.bookmark.tweetId);
    }
    return unreadBookmarks.map((bookmark) => bookmark.tweetId);
  }, [activeTab, continueReadingItems, unreadBookmarks]);

  const refreshHighlightCounts = useCallback(() => {
    const tweetIds = visibleTweetIds;
    if (tweetIds.length === 0) {
      setHighlightCounts(new Map());
      return;
    }

    let cancelled = false;
    getHighlightCountsByTweetIds(tweetIds)
      .then((counts) => {
        if (!cancelled) setHighlightCounts(counts);
      })
      .catch(() => {
        if (!cancelled) setHighlightCounts(new Map());
      });

    return () => {
      cancelled = true;
    };
  }, [visibleTweetIds]);

  useEffect(() => {
    return refreshHighlightCounts();
  }, [refreshHighlightCounts]);

  useEffect(() => {
    return subscribeToReaderActivity(() => {
      refreshHighlightCounts();
    });
  }, [refreshHighlightCounts]);

  const { filteredUnread, filteredInProgress, filteredCompleted } =
    useMemo(() => {
      if (!matchingIds) {
        return {
          filteredUnread: unreadBookmarks,
          filteredInProgress: inProgress,
          filteredCompleted: completed,
        };
      }
      return {
        filteredUnread: unreadBookmarks.filter((b) =>
          matchingIds.has(b.tweetId),
        ),
        filteredInProgress: inProgress.filter((item) =>
          matchingIds.has(item.bookmark.tweetId),
        ),
        filteredCompleted: completed.filter((item) =>
          matchingIds.has(item.bookmark.tweetId),
        ),
      };
    }, [unreadBookmarks, inProgress, completed, matchingIds]);

  const sortedUnread = useMemo(
    () =>
      sortUnreadBookmarks(
        filteredUnread,
        sortPreferences.unread,
        highlightCounts,
      ),
    [filteredUnread, sortPreferences.unread, highlightCounts],
  );

  const sortedInProgress = useMemo(
    () =>
      sortContinueReadingItems(
        filteredInProgress,
        sortPreferences.continue,
        highlightCounts,
      ),
    [filteredInProgress, sortPreferences.continue, highlightCounts],
  );

  const sortedCompleted = useMemo(
    () =>
      sortContinueReadingItems(
        filteredCompleted,
        sortPreferences.read,
        highlightCounts,
      ),
    [filteredCompleted, sortPreferences.read, highlightCounts],
  );

  const activeSort = sortPreferences[activeTab];

  const bookmarkRows: BookmarkRow[] = useMemo(() => {
    if (activeTab === "continue") {
      return sortedInProgress.map(({ bookmark, progress }) => ({
        bookmark,
        subtitle: `Last read ${timeAgo(progress.lastReadAt)}`,
      }));
    }
    if (activeTab === "read") {
      return sortedCompleted.map(({ bookmark, progress }) => ({
        bookmark,
        subtitle: `Finished ${timeAgo(progress.lastReadAt)}`,
      }));
    }
    return sortedUnread.map((bookmark) => ({ bookmark }));
  }, [activeTab, sortedUnread, sortedInProgress, sortedCompleted]);

  const pinnedBookmarks = useMemo(() => {
    if (pinnedIds.size === 0) return [];
    const rowByTweetId = new Map<string, BookmarkRow>();
    for (const row of bookmarkRows) {
      rowByTweetId.set(row.bookmark.tweetId, row);
    }
    const result: BookmarkRow[] = [];
    for (const id of pinnedOrder) {
      const row = rowByTweetId.get(id);
      if (row) result.push(row);
    }
    return result;
  }, [bookmarkRows, pinnedIds, pinnedOrder]);

  const pinnedCount = pinnedBookmarks.length;
  const visiblePinnedCount = activeTab === "unread" ? pinnedCount : 0;

  const unpinnedRows = useMemo(
    () => activeTab === "unread"
      ? bookmarkRows.filter((r) => !pinnedIds.has(r.bookmark.tweetId))
      : bookmarkRows,
    [activeTab, bookmarkRows, pinnedIds],
  );

  const visibleBookmarks = useMemo(() => {
    const unpinned = unpinnedRows.map((r) => r.bookmark);
    if (activeTab !== "unread") return unpinned;
    const pinned = pinnedBookmarks.map((r) => r.bookmark);
    return [...pinned, ...unpinned];
  }, [activeTab, pinnedBookmarks, unpinnedRows]);

  const virtualizer = useVirtualizer({
    count: unpinnedRows.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => ITEM_HEIGHT,
    overscan: 10,
  });

  useEffect(() => {
    if (focusedIndex < 0) return;
    if (focusedIndex < visiblePinnedCount) {
      const el = pinnedCardRefs.current.get(focusedIndex);
      if (el) el.scrollIntoView({ block: "nearest" });
    } else {
      const unpinnedIndex = focusedIndex - visiblePinnedCount;
      if (unpinnedIndex < unpinnedRows.length) {
        virtualizer.scrollToIndex(unpinnedIndex, { align: "auto" });
      }
    }
  }, [focusedIndex, visiblePinnedCount, unpinnedRows.length, virtualizer]);

  const ignoreListHotkeys = useCallback((event: KeyboardEvent) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return false;
    return Boolean(
      target.closest(
        "input, textarea, select, button, [role='button'], [role='option'], [role='listbox']",
      ),
    );
  }, []);

  const handleSortChange = useCallback(
    (nextSort: string) => {
      if (!isReadingSort(nextSort)) return;
      setSortPreferences((current) => {
        const next = { ...current, [activeTab]: nextSort };
        writeStoredReadingSortPreferences(next);
        return next;
      });
    },
    [activeTab],
  );

  useHotkeys(
    "j, ArrowDown",
    () => {
      setFocusedIndex((prev) =>
        prev < visibleBookmarks.length - 1 ? prev + 1 : prev,
      );
    },
    { preventDefault: true, ignoreEventWhen: ignoreListHotkeys },
    [visibleBookmarks.length],
  );

  useHotkeys(
    "k, ArrowUp",
    () => {
      setFocusedIndex((prev) => (prev > 0 ? prev - 1 : prev));
    },
    { preventDefault: true, ignoreEventWhen: ignoreListHotkeys },
  );

  useHotkeys(
    "enter, space",
    () => {
      if (focusedIndex >= 0 && focusedIndex < visibleBookmarks.length) {
        onOpenBookmark(visibleBookmarks[focusedIndex]);
      }
    },
    { preventDefault: true, ignoreEventWhen: ignoreListHotkeys },
    [focusedIndex, visibleBookmarks, onOpenBookmark],
  );

  useHotkeys(
    "escape",
    () => onBack(),
    { preventDefault: true, ignoreEventWhen: ignoreListHotkeys },
    [onBack],
  );

  const tabOrder: ReadingTab[] = ["unread", "continue", "read"];

  useHotkeys(
    "tab",
    () => {
      const idx = tabOrder.indexOf(activeTab);
      onTabChange(tabOrder[(idx + 1) % tabOrder.length]);
    },
    { preventDefault: true, ignoreEventWhen: ignoreListHotkeys },
    [activeTab, onTabChange],
  );

  useHotkeys(
    "ArrowRight",
    () => {
      const idx = tabOrder.indexOf(activeTab);
      if (idx < tabOrder.length - 1) onTabChange(tabOrder[idx + 1]);
    },
    { preventDefault: true, ignoreEventWhen: ignoreListHotkeys },
    [activeTab, onTabChange],
  );

  useHotkeys(
    "ArrowLeft",
    () => {
      const idx = tabOrder.indexOf(activeTab);
      if (idx > 0) onTabChange(tabOrder[idx - 1]);
    },
    { preventDefault: true, ignoreEventWhen: ignoreListHotkeys },
    [activeTab, onTabChange],
  );

  const showSyncControls = syncButton.visible;

  const unreadIdSet = useMemo(
    () => new Set(unreadBookmarks.map((b) => b.tweetId)),
    [unreadBookmarks],
  );

  const handleTogglePin = useCallback(
    (tweetId: string, event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const result = togglePin(tweetId, unreadIdSet);
      setPinnedIds(result.ids);
      setPinnedOrder(getPinnedTweetIdsOrdered());
      if (result.hitCap) {
        setToastMessage("You can pin up to 6 bookmarks.");
        setShowUnpinButtons(true);
      }
    },
    [unreadIdSet],
  );

  const hasItems = visibleBookmarks.length > 0;

  const renderEmptyState = () => {
    if (activeTab === "unread") {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-lg text-muted text-balance">
            All caught up! No unread bookmarks.
          </p>
          {showSyncControls && (
            <Button
              variant="ghost"
              onClick={onSync}
              disabled={syncButton.disabled}
              className="mt-4"
            >
              Sync new bookmarks
            </Button>
          )}
        </div>
      );
    }
    if (activeTab === "continue") {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-lg text-muted text-balance">
            No reading in progress. Pick something to read.
          </p>
          <Button
            variant="ghost"
            onClick={() => onTabChange("unread")}
            className="mt-4"
          >
            Start reading
          </Button>
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-lg text-muted text-balance">
          Nothing finished yet. Keep reading!
        </p>
        <Button
          variant="ghost"
          onClick={() => onTabChange("continue")}
          className="mt-4"
        >
          Continue reading
        </Button>
      </div>
    );
  };

  return (
    <div className="flex h-dvh flex-col bg-surface">
      <div className="sticky top-0 z-10 shrink-0 border-b border-border bg-surface/80 backdrop-blur-md">
        <div
          className={cn(
            "mx-auto flex items-center gap-3 px-6 py-2.5",
            containerWidthClass,
          )}
        >
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            aria-label="Back to home"
            title="Back"
          >
            <ArrowLeftIcon className="size-5" />
          </Button>
          <span className="text-lg font-semibold text-foreground">Reading</span>
          <div className="relative ml-auto mr-1 w-40 shrink-0 transition-transform duration-150 ease-out focus-within:-translate-y-px sm:w-52 md:w-60">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted/65" />
            <Input
              ref={searchInputRef}
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setQuery("");
                  searchInputRef.current?.blur();
                }
              }}
              aria-label="Filter bookmarks"
              placeholder="Search bookmarks..."
              className="h-8 border-border/70 bg-surface/45 pl-8 pr-2 text-xs-plus placeholder:text-muted/50 transition-[border-color,background-color] duration-150 ease-out focus:border-foreground/20 focus:bg-surface/55"
            />
          </div>
        </div>

        <Tabs.Root
          value={activeTab}
          onValueChange={(value) => onTabChange(value as ReadingTab)}
          className={cn("mx-auto px-6", containerWidthClass)}
        >
          <Tabs.List className="relative flex">
            <Tabs.Tab
              value="unread"
              className={cn(
                "px-4 py-2.5 text-sm font-medium transition-colors outline-none select-none",
                "text-muted hover:text-foreground data-active:text-foreground",
              )}
            >
              Unread
              {sortedUnread.length > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center rounded px-1.5 text-xs tabular-nums bg-muted/10 text-muted">
                  {sortedUnread.length}
                </span>
              )}
            </Tabs.Tab>
            <Tabs.Tab
              value="continue"
              className={cn(
                "px-4 py-2.5 text-sm font-medium transition-colors outline-none select-none",
                "text-muted hover:text-foreground data-active:text-foreground",
              )}
            >
              Reading
              {sortedInProgress.length > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center rounded px-1.5 text-xs tabular-nums bg-accent-surface text-accent">
                  {sortedInProgress.length}
                </span>
              )}
            </Tabs.Tab>
            <Tabs.Tab
              value="read"
              className={cn(
                "px-4 py-2.5 text-sm font-medium transition-colors outline-none select-none",
                "text-muted hover:text-foreground data-active:text-foreground",
              )}
            >
              Read
              {sortedCompleted.length > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center rounded px-1.5 text-xs tabular-nums bg-success/10 text-success">
                  {sortedCompleted.length}
                </span>
              )}
            </Tabs.Tab>
            <Tabs.Indicator className="absolute bottom-0 h-0.5 w-[var(--active-tab-width)] translate-x-[var(--active-tab-left)] rounded-full bg-accent transition-[width,transform] duration-200 ease-tab" />
          </Tabs.List>
        </Tabs.Root>
      </div>

      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto">
        <main className={cn(containerWidthClass, "mx-auto px-6 pb-16 pt-4")}>
          {hasItems && (
            <div className="mb-4 flex justify-end">
              <Select
                value={activeSort}
                onValueChange={handleSortChange}
                options={SORT_OPTIONS}
                ariaLabel="Sort bookmarks"
                size="sm"
                leadingIcon={
                  <ArrowsDownUpIcon weight="bold" className="size-3.5" />
                }
                className="w-36 shrink-0 border-border/70 bg-surface/45 hover:bg-surface/55"
                popupClassName="w-[7.5rem]"
              />
            </div>
          )}

          {activeTab === "unread" && pinnedCount > 0 && (
            <div className="mb-2">
              <span className="text-2xs font-medium uppercase tracking-extra-wide text-muted/40">
                Pinned
              </span>
            </div>
          )}
          {activeTab === "unread" && pinnedCount > 0 && (
            <div className="mb-4 grid grid-cols-3 gap-3">
              {pinnedBookmarks.map((row, idx) => {
                const { bookmark } = row;
                const isFocused = focusedIndex === idx;
                const counts = getCounts(highlightCounts, bookmark.tweetId);
                const hasAnnotations =
                  (counts?.highlights ?? 0) > 0 || (counts?.notes ?? 0) > 0;

                return (
                  <a
                    key={bookmark.tweetId}
                    ref={(el) => {
                      if (el) pinnedCardRefs.current.set(idx, el);
                      else pinnedCardRefs.current.delete(idx);
                    }}
                    href={getBookmarkHref(bookmark)}
                    className={cn(
                      "group/card relative flex min-w-0 flex-col gap-2 overflow-hidden rounded-lg rounded-tr-5 bg-surface-card p-3 shadow-[inset_0_0_0_1px] shadow-border/60 no-underline transition-[background-color] duration-200",
                      "before:pointer-events-none before:absolute before:top-0 before:right-0 before:z-[3] before:size-6 before:-translate-y-1/2 before:translate-x-1/2 before:rotate-45 before:bg-surface before:shadow-[0_1px_0_0] before:shadow-border before:transition-all before:duration-180 before:content-['']",
                      "after:pointer-events-none after:absolute after:top-0 after:right-0 after:z-[2] after:h-[22px] after:w-[22px] after:-translate-y-1.5 after:translate-x-1.5 after:rounded-bl-md after:border after:border-border after:bg-surface after:shadow-xs after:transition-all after:duration-180 after:content-['']",
                      "hover:rounded-tr-[35px] hover:bg-surface-hover hover:before:size-10 hover:after:h-[34px] hover:after:w-[34px] hover:after:shadow-lg hover:after:shadow-black/5",
                      isFocused && "bg-surface-hover ring-1 ring-accent/30",
                    )}
                  >
                    <div className="absolute top-3 left-0 h-5 w-[3px] rounded-r-sm bg-accent" />
                    <div className="relative flex items-center gap-2">
                      <img
                        src={bookmark.author.profileImageUrl}
                        alt=""
                        className="size-5 shrink-0 cursor-pointer rounded-full shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]"
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          window.open(
                            `https://x.com/${bookmark.author.screenName}`,
                            "_blank",
                            "noopener,noreferrer",
                          );
                        }}
                      />
                      <span
                        className="cursor-pointer truncate text-xs text-muted/70 transition-colors hover:text-foreground"
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          window.open(
                            `https://x.com/${bookmark.author.screenName}`,
                            "_blank",
                            "noopener,noreferrer",
                          );
                        }}
                        role="link"
                        tabIndex={-1}
                      >
                        @{bookmark.author.screenName}
                      </span>
                    </div>
                    <p className="line-clamp-2 text-xs leading-relaxed text-foreground">
                      {pickTitle(bookmark)}
                    </p>
                    {hasAnnotations && (
                      <p className="truncate text-2xs text-muted/40">
                        {(counts?.highlights ?? 0) > 0 && (
                          <span className="text-accent/60">
                            {counts!.highlights}{" "}
                            {counts!.highlights === 1
                              ? "Highlight"
                              : "Highlights"}
                          </span>
                        )}
                        {(counts?.highlights ?? 0) > 0 &&
                          (counts?.notes ?? 0) > 0 && <span> &middot; </span>}
                        {(counts?.notes ?? 0) > 0 && (
                          <span
                            style={{ color: "var(--note-pill-fg)" }}
                            className="opacity-60"
                          >
                            {counts!.notes}{" "}
                            {counts!.notes === 1 ? "Note" : "Notes"}
                          </span>
                        )}
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={(e) => handleTogglePin(bookmark.tweetId, e)}
                      className={cn(
                        "absolute bottom-0.5 right-0.5 z-[4] flex size-10 items-center justify-center rounded text-accent transition-opacity hover:text-accent/80",
                        showUnpinButtons ? "opacity-100" : "opacity-0 group-hover/card:opacity-100",
                      )}
                      aria-label="Unpin bookmark"
                      title="Unpin"
                    >
                      <PushPinIcon weight="fill" className="size-3" />
                    </button>
                  </a>
                );
              })}
            </div>
          )}
          {activeTab === "unread" && pinnedCount > 0 && unpinnedRows.length > 0 && (
            <div className="mb-4 border-t border-dashed border-border/50" />
          )}

          {hasItems ? (
            <div
              style={{
                height: virtualizer.getTotalSize(),
                width: "100%",
                position: "relative",
              }}
            >
              {virtualizer.getVirtualItems().map((virtualItem) => {
                const row = unpinnedRows[virtualItem.index];
                const { bookmark } = row;
                const counts = getCounts(highlightCounts, bookmark.tweetId);
                const isFocused =
                  focusedIndex === virtualItem.index + visiblePinnedCount;

                return (
                  <div
                    key={bookmark.tweetId}
                    ref={virtualizer.measureElement}
                    data-index={virtualItem.index}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      transform: `translateY(${virtualItem.start}px)`,
                    }}
                  >
                    <a
                      href={getBookmarkHref(bookmark)}
                      className={cn(
                        "group/row flex w-full items-center gap-3 py-3 px-3 text-left no-underline transition-colors duration-150",
                        virtualItem.index % 2 === 0
                          ? "bg-surface-alt hover:bg-surface-hover"
                          : "hover:bg-surface-hover",
                        isFocused && "ring-1 ring-accent/20",
                      )}
                    >
                      <img
                        src={bookmark.author.profileImageUrl}
                        alt=""
                        className="size-9 shrink-0 cursor-pointer rounded-full shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]"
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          window.open(
                            `https://x.com/${bookmark.author.screenName}`,
                            "_blank",
                            "noopener,noreferrer",
                          );
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground leading-snug">
                          {pickTitle(bookmark)}
                          {newBookmarkIds.has(bookmark.tweetId) && (
                            <Badge
                              variant="accent"
                              className="ml-2 align-middle"
                            >
                              New
                            </Badge>
                          )}
                        </p>
                        <p className="mt-1 truncate text-xs text-muted/50">
                          <span
                            className="cursor-pointer transition-colors hover:text-foreground"
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              window.open(
                                `https://x.com/${bookmark.author.screenName}`,
                                "_blank",
                                "noopener,noreferrer",
                              );
                            }}
                            role="link"
                            tabIndex={-1}
                          >
                            @{bookmark.author.screenName}
                          </span>
                          {row.subtitle ? (
                            <span className="text-muted/40">
                              {" "}
                              &middot; {row.subtitle}
                            </span>
                          ) : (
                            <span className="text-muted/40">
                              {" "}
                              &middot; {inferKindBadge(bookmark)}
                            </span>
                          )}
                          {(counts?.highlights ?? 0) > 0 && (
                            <span className="text-muted/40">
                              {" "}
                              &middot;{" "}
                              <span className="text-accent/60">
                                {counts!.highlights}{" "}
                                {counts!.highlights === 1
                                  ? "Highlight"
                                  : "Highlights"}
                              </span>
                            </span>
                          )}
                          {(counts?.notes ?? 0) > 0 && (
                            <span className="text-muted/40">
                              {" "}
                              &middot;{" "}
                              <span
                                style={{ color: "var(--note-pill-fg)" }}
                                className="opacity-60"
                              >
                                {counts!.notes}{" "}
                                {counts!.notes === 1 ? "Note" : "Notes"}
                              </span>
                            </span>
                          )}
                        </p>
                      </div>
                      {activeTab === "unread" && (
                        <button
                          type="button"
                          onClick={(e) => handleTogglePin(bookmark.tweetId, e)}
                          className={cn(
                            "flex size-10 shrink-0 items-center justify-center rounded transition-[color,opacity]",
                            pinnedIds.has(bookmark.tweetId)
                              ? "text-accent opacity-100 hover:text-accent/80"
                              : "text-muted/40 opacity-0 group-hover/row:opacity-100 hover:text-muted",
                          )}
                          aria-label={
                            pinnedIds.has(bookmark.tweetId)
                              ? "Unpin bookmark"
                              : "Pin bookmark"
                          }
                          title={
                            pinnedIds.has(bookmark.tweetId) ? "Unpin" : "Pin"
                          }
                        >
                          <PushPinIcon
                            weight={
                              pinnedIds.has(bookmark.tweetId) ? "fill" : "regular"
                            }
                            className="size-3.5"
                          />
                        </button>
                      )}
                      {activeTab !== "unread" && pinnedIds.has(bookmark.tweetId) && (
                        <div
                          className="flex size-10 shrink-0 items-center justify-center text-accent opacity-60"
                          title="Pinned"
                        >
                          <PushPinIcon weight="fill" className="size-3.5" />
                        </div>
                      )}
                    </a>
                  </div>
                );
              })}
            </div>
          ) : (
            renderEmptyState()
          )}

          {offlineMode && (
            <div className="mt-8">
              <OfflineBanner
                onLogin={() => {
                  if (onLogin) {
                    onLogin();
                    return;
                  }
                  void actions.startLogin();
                }}
              />
            </div>
          )}
        </main>
      </div>

      {toastMessage && (
        <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />
      )}
    </div>
  );
}
