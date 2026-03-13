import {
  forwardRef,
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
  ArrowsDownUpIcon,
  MagnifyingGlassIcon,
} from "@phosphor-icons/react";
import type { Bookmark } from "../types";
import type { ContinueReadingItem } from "../hooks/useContinueReading";
import { useBookmarkSearch } from "../hooks/useBookmarkSearch";
import { pickTitle, inferKindBadge } from "../lib/bookmark-utils";
import { cn } from "../lib/cn";
import { NEW_BADGE_CUTOFF_MS } from "../lib/constants";
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

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  countClass: string;
}

interface AnnotationPillProps {
  kind: "highlight" | "note";
  count: number;
}

const SORT_OPTIONS: SelectOption[] = [
  { value: "recent", label: "Recent" },
  { value: "oldest", label: "Oldest" },
  { value: "annotated", label: "Annotated" },
];

const TabButton = forwardRef<HTMLButtonElement, TabButtonProps>(
  ({ active, onClick, label, count, countClass }, ref) => (
    <button
      ref={ref}
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "px-4 py-2.5 text-sm font-medium transition-colors outline-none",
        active ? "text-foreground" : "text-muted hover:text-foreground",
      )}
    >
      {label}
      {count > 0 && (
        <span
          className={cn(
            "ml-1.5 inline-flex items-center justify-center rounded px-1.5 text-xs tabular-nums",
            countClass,
          )}
        >
          {count}
        </span>
      )}
    </button>
  ),
);

function AnnotationPill({ kind, count }: AnnotationPillProps) {
  if (count <= 0) {
    return null;
  }

  const label = `${count} ${
    count === 1
      ? kind === "highlight"
        ? "Highlight"
        : "Note"
      : kind === "highlight"
        ? "Highlights"
        : "Notes"
  }`;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums",
        kind === "highlight" ? "text-accent" : undefined,
      )}
      style={
        kind === "highlight"
          ? { backgroundColor: "var(--highlight-bg)" }
          : {
              backgroundColor: "var(--note-pill-bg)",
              color: "var(--note-pill-fg)",
            }
      }
    >
      {label}
    </span>
  );
}

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
  const bookmarkItemBase =
    "bookmark-list-item flex w-full items-center gap-3 rounded border p-3 text-left transition-colors hover:bg-surface-hover";
  const runtimeSyncButton = useSyncButtonState();
  const runtimeOfflineMode = useIsOffline();
  const actions = useRuntimeActions();
  const syncButton = syncButtonStateOverride ?? runtimeSyncButton;
  const offlineMode = offlineModeOverride ?? runtimeOfflineMode;
  const isPreparingSync =
    !offlineMode &&
    syncButton.disabled &&
    syncButton.title === "Preparing X API...";
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [sortPreferences, setSortPreferences] =
    useState<ReadingSortPreferences>(() => readStoredReadingSortPreferences());
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const tabListRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const continueTabRef = useRef<HTMLButtonElement>(null);
  const readTabRef = useRef<HTMLButtonElement>(null);
  const unreadTabRef = useRef<HTMLButtonElement>(null);
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  useEffect(() => {
    setFocusedIndex(-1);
  }, [activeTab]);

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

  const refreshHighlightCounts = useCallback(() => {
    const tweetIds = allBookmarks.map((bookmark) => bookmark.tweetId);
    if (tweetIds.length === 0) {
      setHighlightCounts(new Map());
      return;
    }

    let cancelled = false;
    getHighlightCountsByTweetIds(tweetIds)
      .then((counts) => {
        if (!cancelled) {
          setHighlightCounts(counts);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHighlightCounts(new Map());
        }
      });

    return () => {
      cancelled = true;
    };
  }, [allBookmarks]);

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
        filteredUnread: unreadBookmarks.filter((bookmark) =>
          matchingIds.has(bookmark.tweetId),
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

  const visibleBookmarks = useMemo(() => {
    if (activeTab === "continue") {
      return sortedInProgress.map((item) => item.bookmark);
    }
    if (activeTab === "read") {
      return sortedCompleted.map((item) => item.bookmark);
    }
    return sortedUnread;
  }, [activeTab, sortedCompleted, sortedInProgress, sortedUnread]);

  useEffect(() => {
    if (focusedIndex >= 0 && focusedIndex < itemRefs.current.length) {
      itemRefs.current[focusedIndex]?.scrollIntoView({ block: "nearest" });
    }
  }, [focusedIndex]);

  const ignoreListHotkeys = useCallback((event: KeyboardEvent) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return false;
    }

    return Boolean(
      target.closest(
        "input, textarea, select, button, [role='button'], [role='option'], [role='listbox']",
      ),
    );
  }, []);

  const activeSort = sortPreferences[activeTab];

  const handleSortChange = useCallback(
    (nextSort: string) => {
      if (!isReadingSort(nextSort)) {
        return;
      }

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
    {
      preventDefault: true,
      ignoreEventWhen: ignoreListHotkeys,
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
    { preventDefault: true, ignoreEventWhen: ignoreListHotkeys },
    [activeTab, onTabChange],
  );

  useHotkeys(
    "ArrowRight",
    () => {
      const idx = tabOrder.indexOf(activeTab);
      if (idx < tabOrder.length - 1) {
        onTabChange(tabOrder[idx + 1]);
      }
    },
    { preventDefault: true, ignoreEventWhen: ignoreListHotkeys },
    [activeTab, onTabChange],
  );

  useHotkeys(
    "ArrowLeft",
    () => {
      const idx = tabOrder.indexOf(activeTab);
      if (idx > 0) {
        onTabChange(tabOrder[idx - 1]);
      }
    },
    { preventDefault: true, ignoreEventWhen: ignoreListHotkeys },
    [activeTab, onTabChange],
  );

  let readingIdx = 0;
  const showSyncControls = syncButton.visible;

  const handleOpenX = useCallback(() => {
    if (onLogin) {
      onLogin();
      return;
    }
    window.open("https://x.com/i/bookmarks", "_blank", "noopener,noreferrer");
    void actions.startLogin();
  }, [actions, onLogin]);

  return (
    <div className="min-h-dvh bg-surface">
      <div className="sticky top-0 z-10 border-b border-border bg-surface/80 backdrop-blur-md">
        <div
          className={cn(
            "mx-auto flex items-center gap-3 px-4 py-3",
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

        <div
          ref={tabListRef}
          className={cn("relative mx-auto flex px-4", containerWidthClass)}
          role="tablist"
        >
          <TabButton
            ref={unreadTabRef}
            active={activeTab === "unread"}
            onClick={() => onTabChange("unread")}
            label="Unread"
            count={sortedUnread.length}
            countClass="bg-muted/10 text-muted"
          />
          <TabButton
            ref={continueTabRef}
            active={activeTab === "continue"}
            onClick={() => onTabChange("continue")}
            label="Reading"
            count={sortedInProgress.length}
            countClass="bg-accent-surface text-accent"
          />
          <TabButton
            ref={readTabRef}
            active={activeTab === "read"}
            onClick={() => onTabChange("read")}
            label="Read"
            count={sortedCompleted.length}
            countClass="bg-success/10 text-success"
          />
          <span
            className="absolute bottom-0 h-0.5 rounded-full bg-accent transition-all duration-200 ease-tab"
            style={{ left: indicator.left, width: indicator.width }}
          />
        </div>
      </div>

      <main className={cn(containerWidthClass, "mx-auto px-4 pb-16 pt-4")}>
        <div className="mb-4 flex justify-end">
          <Select
            value={activeSort}
            onValueChange={handleSortChange}
            options={SORT_OPTIONS}
            ariaLabel="Sort bookmarks"
            leadingIcon={<ArrowsDownUpIcon weight="bold" className="size-4" />}
            className="w-36 shrink-0 border-border/70 bg-surface/45 hover:bg-surface/55"
            popupClassName="w-36"
          />
        </div>

        {activeTab === "unread" && (
          <>
            {sortedUnread.length > 0 ? (
              <div className="space-y-2">
                {sortedUnread.map((bookmark, idx) => {
                  const counts = getCounts(highlightCounts, bookmark.tweetId);

                  return (
                    <a
                      key={bookmark.tweetId}
                      href={getBookmarkHref(bookmark)}
                      ref={(el) => {
                        itemRefs.current[idx] = el;
                      }}
                      className={cn(
                        "bookmark-list-item flex w-full items-center gap-3 rounded border p-3 text-left no-underline transition-colors hover:bg-surface-hover",
                        focusedIndex === idx
                          ? "border-accent ring-2 ring-accent/40 bg-surface-hover"
                          : "border-border bg-surface-card",
                      )}
                    >
                      <img
                        src={bookmark.author.profileImageUrl}
                        alt=""
                        className="size-10 shrink-0 rounded-full"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium text-foreground">
                            {pickTitle(bookmark)}
                          </p>
                          {newBookmarkIds.has(bookmark.tweetId) && (
                            <Badge variant="accent">New</Badge>
                          )}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                          <span>@{bookmark.author.screenName}</span>
                          <span aria-hidden="true">&middot;</span>
                          <Badge>{inferKindBadge(bookmark)}</Badge>
                          <AnnotationPill
                            kind="highlight"
                            count={counts?.highlights ?? 0}
                          />
                          <AnnotationPill
                            kind="note"
                            count={counts?.notes ?? 0}
                          />
                        </div>
                      </div>
                    </a>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <p className="text-lg text-muted text-pretty">
                  {isPreparingSync
                    ? "Finishing X setup. Open X once to enable bookmark sync."
                    : "All caught up! No unread bookmarks."}
                </p>
                {showSyncControls && (
                  <Button
                    onClick={onSync}
                    disabled={syncButton.disabled}
                    className="mt-4"
                  >
                    Sync new bookmarks
                  </Button>
                )}
                {isPreparingSync && (
                  <Button onClick={handleOpenX} className="mt-4">
                    Open X
                  </Button>
                )}
              </div>
            )}
          </>
        )}

        {activeTab === "continue" && (
          <>
            {sortedInProgress.length > 0 ? (
              <div className="space-y-2">
                {sortedInProgress.map(({ bookmark, progress }) => {
                  const idx = readingIdx++;
                  const counts = getCounts(highlightCounts, bookmark.tweetId);

                  return (
                    <a
                      key={bookmark.tweetId}
                      href={getBookmarkHref(bookmark)}
                      ref={(el) => {
                        itemRefs.current[idx] = el;
                      }}
                      className={cn(
                        bookmarkItemBase,
                        "no-underline",
                        focusedIndex === idx
                          ? "border-accent ring-2 ring-accent/40 bg-surface-hover"
                          : "border-border bg-surface-card",
                      )}
                    >
                      <img
                        src={bookmark.author.profileImageUrl}
                        alt=""
                        className="size-10 shrink-0 rounded-full"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium text-foreground">
                            {pickTitle(bookmark)}
                          </p>
                          {newBookmarkIds.has(bookmark.tweetId) && (
                            <Badge variant="accent">New</Badge>
                          )}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                          <span>@{bookmark.author.screenName}</span>
                          <span aria-hidden="true">&middot;</span>
                          <span>Last read {timeAgo(progress.lastReadAt)}</span>
                          <AnnotationPill
                            kind="highlight"
                            count={counts?.highlights ?? 0}
                          />
                          <AnnotationPill
                            kind="note"
                            count={counts?.notes ?? 0}
                          />
                        </div>
                      </div>
                    </a>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <p className="text-lg text-muted text-pretty">
                  No reading in progress. Pick something to read.
                </p>
                <Button onClick={() => onTabChange("unread")} className="mt-4">
                  Start reading
                </Button>
              </div>
            )}
          </>
        )}

        {activeTab === "read" && (
          <>
            {sortedCompleted.length > 0 ? (
              <div className="space-y-2">
                {sortedCompleted.map(({ bookmark, progress }) => {
                  const idx = readingIdx++;
                  const counts = getCounts(highlightCounts, bookmark.tweetId);

                  return (
                    <a
                      key={bookmark.tweetId}
                      href={getBookmarkHref(bookmark)}
                      ref={(el) => {
                        itemRefs.current[idx] = el;
                      }}
                      className={cn(
                        bookmarkItemBase,
                        "no-underline",
                        focusedIndex === idx
                          ? "border-accent ring-2 ring-accent/40 bg-surface-hover"
                          : "border-border bg-surface-card",
                      )}
                    >
                      <img
                        src={bookmark.author.profileImageUrl}
                        alt=""
                        className="size-10 shrink-0 rounded-full"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium text-foreground">
                            {pickTitle(bookmark)}
                          </p>
                          {newBookmarkIds.has(bookmark.tweetId) && (
                            <Badge variant="accent">New</Badge>
                          )}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                          <span>@{bookmark.author.screenName}</span>
                          <span aria-hidden="true">&middot;</span>
                          <span>Finished {timeAgo(progress.lastReadAt)}</span>
                          <AnnotationPill
                            kind="highlight"
                            count={counts?.highlights ?? 0}
                          />
                          <AnnotationPill
                            kind="note"
                            count={counts?.notes ?? 0}
                          />
                        </div>
                      </div>
                    </a>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <p className="text-lg text-muted text-pretty">
                  Nothing finished yet. Keep reading!
                </p>
                <Button
                  onClick={() => onTabChange("continue")}
                  className="mt-4"
                >
                  Continue reading
                </Button>
              </div>
            )}
          </>
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
  );
}
