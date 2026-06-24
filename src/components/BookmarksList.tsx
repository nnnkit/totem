import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { Autocomplete } from "@base-ui/react/autocomplete";
import { Tabs } from "@base-ui/react/tabs";
import { useHotkeys } from "react-hotkeys-hook";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  ArrowLeftIcon,
  ArrowCounterClockwiseIcon,
  ArrowsDownUpIcon,
  ArchiveIcon,
  CheckCircleIcon,
  ClockCountdownIcon,
  ClockIcon,
  ListChecksIcon,
  ListPlusIcon,
  MagnifyingGlassIcon,
  PushPinIcon,
  SparkleIcon,
  XIcon,
} from "@phosphor-icons/react";
import type { Bookmark } from "../types";
import type { ContinueReadingItem } from "../hooks/useContinueReading";
import type { UseTodayQueueResult } from "../hooks/useTodayQueue";
import type {
  TodayQueueHandledItem,
  TodayQueueHandledReason,
} from "../lib/today-queue";
import { useBookmarkSearch } from "../hooks/useBookmarkSearch";
import { pickTitle, pickSearchSnippet, inferKindBadge } from "../lib/bookmark-utils";
import { cn } from "../lib/cn";
import { Highlighted } from "./Highlighted";
import {
  pushRecentSearch,
  readRecentSearches,
  removeRecentSearch,
} from "../lib/recent-searches";
import {
  NEW_BADGE_CUTOFF_MS,
  TODAY_QUEUE_DONE_MESSAGE,
  TODAY_QUEUE_DONE_TITLE,
} from "../lib/constants/ui";
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
import { type HighlightCounts } from "../db";
import { subscribeToReaderActivity } from "../lib/reader-activity";
import {
  useAccountDb,
  useIsOffline,
  useRuntimeActions,
  useSyncButtonState,
  type SyncButtonState,
} from "../stores/selectors";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import { OfflineBanner } from "./ui/OfflineBanner";
import { Select, type SelectOption } from "./ui/Select";
import { Toast } from "./ui/Toast";

export type { ReadingTab } from "../lib/reading-list";

interface Props {
  continueReadingItems: ContinueReadingItem[];
  unreadBookmarks: Bookmark[];
  todayQueue?: UseTodayQueueResult;
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

type SearchScope = "all" | "unread" | "continue" | "read";

interface BookmarksListState {
  focusedIndex: number;
  sortPreferences: ReadingSortPreferences;
  pinnedIds: Set<string>;
  pinnedOrder: string[];
  toastMessage: string | null;
  showUnpinButtons: boolean;
  searchScope: SearchScope;
  isMac: boolean;
  isSearchFocused: boolean;
  recents: string[];
  highlightCounts: Map<string, HighlightCounts>;
}

type BookmarksListPatch =
  | Partial<BookmarksListState>
  | ((state: BookmarksListState) => Partial<BookmarksListState>);

function createInitialBookmarksListState(): BookmarksListState {
  return {
    focusedIndex: -1,
    sortPreferences: readStoredReadingSortPreferences(),
    pinnedIds: getPinnedTweetIds(),
    pinnedOrder: getPinnedTweetIdsOrdered(),
    toastMessage: null,
    showUnpinButtons: false,
    searchScope: "all",
    isMac: false,
    isSearchFocused: false,
    recents: readRecentSearches(),
    highlightCounts: new Map(),
  };
}

function bookmarksListReducer(
  state: BookmarksListState,
  patch: BookmarksListPatch,
): BookmarksListState {
  return {
    ...state,
    ...(typeof patch === "function" ? patch(state) : patch),
  };
}

const SORT_OPTIONS: SelectOption[] = [
  { value: "recent", label: "Recent" },
  { value: "oldest", label: "Oldest" },
  { value: "annotated", label: "Annotated" },
];

const SUGGESTED_OPERATORS: ReadonlyArray<{ label: string; insert: string }> = [
  { label: "from:", insert: "from:" },
  { label: "has:image", insert: "has:image " },
  { label: "has:link", insert: "has:link " },
  { label: "has:video", insert: "has:video " },
  { label: "filter:thread", insert: "filter:thread " },
  { label: "since:7d", insert: "within:7d " },
  { label: "min_faves:1000", insert: "min_faves:1000 " },
];

const ITEM_HEIGHT = 64;

const HANDLED_TODAY_LABELS: Record<TodayQueueHandledReason, string> = {
  read: "Read",
  snoozed: "Snoozed",
  archived: "Archived",
  action: "Follow-up",
};

const TODAY_COMPLETION_LABELS: Record<TodayQueueHandledReason, string> = {
  read: "Read",
  snoozed: "Snoozed",
  archived: "Archived",
  action: "Action needed",
};

const TODAY_COMPLETION_ORDER: TodayQueueHandledReason[] = [
  "read",
  "snoozed",
  "action",
  "archived",
];

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

function HandledTodayIcon({ reason }: { reason: TodayQueueHandledReason }) {
  switch (reason) {
    case "read":
      return <CheckCircleIcon weight="fill" className="size-3.5" />;
    case "snoozed":
      return <ClockCountdownIcon className="size-3.5" />;
    case "archived":
      return <ArchiveIcon className="size-3.5" />;
    case "action":
      return <ListChecksIcon className="size-3.5" />;
  }
}

function useBookmarksListModel({
  continueReadingItems,
  unreadBookmarks,
  todayQueue,
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
  const db = useAccountDb();
  const runtimeSyncButton = useSyncButtonState();
  const runtimeOfflineMode = useIsOffline();
  const actions = useRuntimeActions();
  const syncButton = syncButtonStateOverride ?? runtimeSyncButton;
  const offlineMode = offlineModeOverride ?? runtimeOfflineMode;
  const [listState, updateListState] = useReducer(
    bookmarksListReducer,
    undefined,
    createInitialBookmarksListState,
  );
  const {
    focusedIndex,
    sortPreferences,
    pinnedIds,
    pinnedOrder,
    toastMessage,
    showUnpinButtons,
    searchScope,
    isMac,
    isSearchFocused,
    recents,
    highlightCounts,
  } = listState;
  const searchInputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const pinnedCardRefs = useRef<Map<number, HTMLAnchorElement>>(new Map());

  const changeTab = useCallback((tab: ReadingTab) => {
    updateListState({ focusedIndex: -1 });
    onTabChange(tab);
  }, [onTabChange]);

  const changeSearchScope = useCallback((scope: SearchScope) => {
    updateListState({ focusedIndex: -1, searchScope: scope });
  }, []);

  useEffect(() => {
    return subscribeToPinChanges(() => {
      updateListState({
        pinnedIds: getPinnedTweetIds(),
        pinnedOrder: getPinnedTweetIdsOrdered(),
      });
    });
  }, []);

  useEffect(() => {
    if (!showUnpinButtons) return;
    const timer = setTimeout(() => updateListState({ showUnpinButtons: false }), 3000);
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
    for (const item of todayQueue?.items ?? []) {
      if (!seen.has(item.bookmark.tweetId)) {
        seen.add(item.bookmark.tweetId);
        merged.push(item.bookmark);
      }
    }
    return merged;
  }, [continueReadingItems, unreadBookmarks, todayQueue?.items]);

  const { query, setQuery, results, queryTerms, isSearching, didYouMean } =
    useBookmarkSearch(allBookmarks);

  const matchingIds = useMemo(() => {
    if (!isSearching) return null;
    return new Set(results.map((bookmark) => bookmark.tweetId));
  }, [isSearching, results]);

  useHotkeys(
    "/, mod+k",
    () => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    },
    { preventDefault: true, enableOnFormTags: ["input"] },
  );

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    updateListState({ isMac: /Mac|iPhone|iPad|iPod/.test(navigator.platform) });
  }, []);
  const showSearchHint = !isSearchFocused && query.length === 0;
  const showSuggestions = isSearchFocused && query.length === 0;

  // Refresh the recent list each time the suggestion popup opens so a query
  // committed in this session shows up without a remount.
  useEffect(() => {
    if (showSuggestions) updateListState({ recents: readRecentSearches() });
  }, [showSuggestions]);

  const handleRemoveRecent = useCallback((q: string) => {
    updateListState({ recents: removeRecentSearch(q) });
  }, []);

  const insertSuggestion = useCallback(
    (insert: string) => {
      setQuery(insert);
      requestAnimationFrame(() => {
        const el = searchInputRef.current;
        if (!el) return;
        el.focus();
        el.setSelectionRange(insert.length, insert.length);
      });
    },
    [setQuery],
  );

  // Persist queries to recent-searches once they've stabilized through the
  // debounce and produced results. We only commit non-trivial queries with
  // at least one matching result so noise / unfinished typing doesn't leak in.
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) return;
    if (results.length === 0) return;
    const id = setTimeout(() => pushRecentSearch(trimmed), 1500);
    return () => clearTimeout(id);
  }, [query, results.length]);

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

  const visibleTweetIds = useMemo(() => {
    if (activeTab === "today") {
      return (todayQueue?.items ?? []).map((item) => item.bookmark.tweetId);
    }
    if (activeTab === "continue") {
      return continueReadingItems.flatMap((item) =>
        item.progress.completed ? [] : [item.bookmark.tweetId],
      );
    }
    if (activeTab === "read") {
      return continueReadingItems.flatMap((item) =>
        item.progress.completed ? [item.bookmark.tweetId] : [],
      );
    }
    return unreadBookmarks.map((bookmark) => bookmark.tweetId);
  }, [activeTab, continueReadingItems, todayQueue?.items, unreadBookmarks]);

  const refreshHighlightCounts = useCallback(() => {
    const tweetIds = visibleTweetIds;
    if (tweetIds.length === 0) {
      updateListState({ highlightCounts: new Map() });
      return;
    }

    let cancelled = false;
    db.getHighlightCountsByTweetIds(tweetIds)
      .then((counts) => {
        if (!cancelled) updateListState({ highlightCounts: counts });
      })
      .catch(() => {
        if (!cancelled) updateListState({ highlightCounts: new Map() });
      });

    return () => {
      cancelled = true;
    };
  }, [visibleTweetIds, db]);

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

  const todayRows: BookmarkRow[] = useMemo(
    () =>
      (todayQueue?.items ?? []).map(({ bookmark, progress, metadata }) => {
        if (progress && !progress.completed) {
          return {
            bookmark,
            subtitle: `Today's Read · last read ${timeAgo(progress.lastReadAt)}`,
          };
        }
        if (metadata?.intent === "read_soon") {
          return { bookmark, subtitle: "Today's Read · read soon" };
        }
        return { bookmark, subtitle: "Today's Read" };
      }),
    [todayQueue?.items],
  );
  const todayTweetIdSet = useMemo(
    () => new Set((todayQueue?.items ?? []).map((item) => item.bookmark.tweetId)),
    [todayQueue?.items],
  );

  const handledTodayItems: TodayQueueHandledItem[] = todayQueue?.handledItems ?? [];
  const actionTodayItems = useMemo(
    () => handledTodayItems.filter((item) => item.reason === "action"),
    [handledTodayItems],
  );
  const passiveHandledTodayItems = useMemo(
    () => handledTodayItems.filter((item) => item.reason !== "action"),
    [handledTodayItems],
  );
  const todayCompletionSummary = useMemo(() => {
    const counts = new Map<TodayQueueHandledReason, number>();
    for (const item of handledTodayItems) {
      counts.set(item.reason, (counts.get(item.reason) ?? 0) + 1);
    }
    return TODAY_COMPLETION_ORDER.flatMap((reason) => {
      const count = counts.get(reason) ?? 0;
      return count > 0
        ? [{ reason, label: TODAY_COMPLETION_LABELS[reason], count }]
        : [];
    });
  }, [handledTodayItems]);
  const activeSort = activeTab === "today" ? "recent" : sortPreferences[activeTab];

  // Map tweetId → progress so search results across all tabs can show their
  // current read state in the row subtitle.
  const progressByTweetId = useMemo(() => {
    const m = new Map<string, ContinueReadingItem["progress"]>();
    for (const item of continueReadingItems) {
      m.set(item.bookmark.tweetId, item.progress);
    }
    return m;
  }, [continueReadingItems]);

  // Reset search scope to "all" whenever the user exits search mode so the
  // next query starts from a global view.
  useEffect(() => {
    if (!isSearching) updateListState({ searchScope: "all" });
  }, [isSearching]);

  // Match counts per state for the tab strip in search mode.
  const searchMatchCounts = useMemo(() => {
    if (!isSearching) {
      return { all: 0, unread: 0, continue: 0, read: 0 };
    }
    const counts = { all: results.length, unread: 0, continue: 0, read: 0 };
    for (const b of results) {
      const p = progressByTweetId.get(b.tweetId);
      if (!p) counts.unread += 1;
      else if (p.completed) counts.read += 1;
      else counts.continue += 1;
    }
    return counts;
  }, [isSearching, results, progressByTweetId]);

  const bookmarkRows: BookmarkRow[] = useMemo(() => {
    // Global search: ignore the active tab, render all matches in rank order
    // and label each row with its current read state. `searchScope` lets
    // the user narrow without leaving search mode.
    if (isSearching) {
      const filtered = results.filter((bookmark) => {
        if (searchScope === "all") return true;
        const p = progressByTweetId.get(bookmark.tweetId);
        if (searchScope === "unread") return !p;
        if (searchScope === "read") return p?.completed === true;
        return p != null && p.completed === false; // "continue"
      });
      return filtered.map((bookmark) => {
        const progress = progressByTweetId.get(bookmark.tweetId);
        if (!progress) {
          return { bookmark, subtitle: "Unread" };
        }
        if (progress.completed) {
          return {
            bookmark,
            subtitle: `Read · finished ${timeAgo(progress.lastReadAt)}`,
          };
        }
        return {
          bookmark,
          subtitle: `Reading · last read ${timeAgo(progress.lastReadAt)}`,
        };
      });
    }
    if (activeTab === "today") {
      return todayRows;
    }
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
  }, [
    isSearching,
    searchScope,
    results,
    progressByTweetId,
    activeTab,
    todayRows,
    sortedUnread,
    sortedInProgress,
    sortedCompleted,
  ]);

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
  // Pinned grid is only meaningful on the Unread tab outside of search.
  const visiblePinnedCount =
    !isSearching && activeTab === "unread" ? pinnedCount : 0;

  const unpinnedRows = useMemo(
    () =>
      !isSearching && activeTab === "unread"
        ? bookmarkRows.filter((r) => !pinnedIds.has(r.bookmark.tweetId))
        : bookmarkRows,
    [isSearching, activeTab, bookmarkRows, pinnedIds],
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
      if (activeTab === "today") return;
      if (!isReadingSort(nextSort)) return;
      updateListState((current) => {
        const next = { ...current.sortPreferences, [activeTab]: nextSort };
        writeStoredReadingSortPreferences(next);
        return { sortPreferences: next };
      });
    },
    [activeTab],
  );

  const openBookmark = useCallback(
    (bookmark: Bookmark) => {
      if (!isSearching && activeTab === "today") {
        const trackedOpen =
          todayQueue?.recordOpen(bookmark.tweetId) ?? Promise.resolve();
        void trackedOpen.catch(() => {}).finally(() => {
          onOpenBookmark(bookmark);
        });
        return;
      }
      onOpenBookmark(bookmark);
    },
    [activeTab, isSearching, onOpenBookmark, todayQueue],
  );

  useHotkeys(
    "j, ArrowDown",
    () => {
      updateListState((current) => ({
        focusedIndex:
          current.focusedIndex < visibleBookmarks.length - 1
            ? current.focusedIndex + 1
            : current.focusedIndex,
      }));
    },
    { preventDefault: true, ignoreEventWhen: ignoreListHotkeys },
    [visibleBookmarks.length],
  );

  useHotkeys(
    "k, ArrowUp",
    () => {
      updateListState((current) => ({
        focusedIndex: current.focusedIndex > 0 ? current.focusedIndex - 1 : current.focusedIndex,
      }));
    },
    { preventDefault: true, ignoreEventWhen: ignoreListHotkeys },
  );

  useHotkeys(
    "enter, space",
    () => {
      if (focusedIndex >= 0 && focusedIndex < visibleBookmarks.length) {
        openBookmark(visibleBookmarks[focusedIndex]);
      }
    },
    { preventDefault: true, ignoreEventWhen: ignoreListHotkeys },
    [focusedIndex, visibleBookmarks, openBookmark],
  );

  useHotkeys(
    "escape",
    () => onBack(),
    { preventDefault: true, ignoreEventWhen: ignoreListHotkeys },
    [onBack],
  );

  const tabOrder: ReadingTab[] = ["today", "unread", "continue", "read"];

  useHotkeys(
    "tab",
    () => {
      const idx = tabOrder.indexOf(activeTab);
      changeTab(tabOrder[(idx + 1) % tabOrder.length]);
    },
    { preventDefault: true, ignoreEventWhen: ignoreListHotkeys },
    [activeTab, changeTab],
  );

  useHotkeys(
    "ArrowRight",
    () => {
      const idx = tabOrder.indexOf(activeTab);
      if (idx < tabOrder.length - 1) changeTab(tabOrder[idx + 1]);
    },
    { preventDefault: true, ignoreEventWhen: ignoreListHotkeys },
    [activeTab, changeTab],
  );

  useHotkeys(
    "ArrowLeft",
    () => {
      const idx = tabOrder.indexOf(activeTab);
      if (idx > 0) changeTab(tabOrder[idx - 1]);
    },
    { preventDefault: true, ignoreEventWhen: ignoreListHotkeys },
    [activeTab, changeTab],
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
      if (activeTab === "today") {
        void todayQueue?.recordPinned(tweetId).catch(() => {});
      }
      updateListState({
        pinnedIds: result.ids,
        pinnedOrder: getPinnedTweetIdsOrdered(),
        ...(result.hitCap
          ? {
              toastMessage: "You can pin up to 6 bookmarks.",
              showUnpinButtons: true,
            }
          : {}),
      });
    },
    [activeTab, todayQueue, unreadIdSet],
  );

  const handleAddToToday = useCallback(
    (tweetId: string, event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (todayTweetIdSet.has(tweetId)) {
        updateListState({ toastMessage: "Already in Today's Read." });
        return;
      }
      void todayQueue
        ?.addToTodayQueue(tweetId)
        .then(() =>
          updateListState({ toastMessage: "Added to Today's Read." }),
        )
        .catch(() =>
          updateListState({ toastMessage: "Couldn't add to Today's Read." }),
        );
    },
    [todayQueue, todayTweetIdSet],
  );

  const handleTodaySnooze = useCallback(
    (tweetId: string, event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      void todayQueue?.snooze(tweetId).catch(() => {});
    },
    [todayQueue],
  );

  const handleTodayIntent = useCallback(
    (
      tweetId: string,
      intent: "reference" | "act",
      event: React.MouseEvent,
    ) => {
      event.preventDefault();
      event.stopPropagation();
      void todayQueue?.setIntent(tweetId, intent).catch(() => {});
    },
    [todayQueue],
  );

  const handleTodayUndo = useCallback(
    (
      tweetId: string,
      reason: TodayQueueHandledReason,
      event: React.MouseEvent,
    ) => {
      event.preventDefault();
      event.stopPropagation();
      void todayQueue?.undoHandled(tweetId, reason).catch(() => {});
    },
    [todayQueue],
  );

  const handleLogin = useCallback(() => {
    if (onLogin) {
      onLogin();
      return;
    }
    void actions.startLogin();
  }, [actions, onLogin]);

  const hasItems = visibleBookmarks.length > 0;

  const renderEmptyState = () => {
    if (activeTab === "today") {
      if (todayQueue?.isDone) {
        return (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-5 flex size-12 items-center justify-center rounded-full bg-accent-surface text-accent shadow-[0_0_0_1px] shadow-accent/15">
              <CheckCircleIcon weight="fill" className="size-6" />
            </div>
            <h2 className="text-xl font-medium text-foreground text-balance">
              {TODAY_QUEUE_DONE_TITLE}
            </h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-subtle text-balance">
              {TODAY_QUEUE_DONE_MESSAGE}
            </p>
            {todayCompletionSummary.length > 0 && (
              <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                {todayCompletionSummary.map((item) => (
                  <span
                    key={item.reason}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border-soft bg-surface-card/70 px-2.5 py-1 text-xs text-subtle"
                  >
                    <span className="font-medium tabular-nums text-foreground/75">
                      {item.count}
                    </span>
                    {item.label}
                  </span>
                ))}
              </div>
            )}
            <Button
              variant="ghost"
              onClick={() => onTabChange("unread")}
              className="mt-5"
            >
              Browse unread
            </Button>
          </div>
        );
      }

      return (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-lg text-muted text-balance">
            Nothing queued for Today's Read.
          </p>
          <Button
            variant="ghost"
            onClick={() => onTabChange("unread")}
            className="mt-4"
          >
            Browse unread
          </Button>
        </div>
      );
    }
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

  return {
    activeSort,
    activeTab,
    changeSearchScope,
    changeTab,
    containerWidthClass,
    didYouMean,
    focusedIndex,
    getBookmarkHref,
    handleLogin,
    handleRemoveRecent,
    handleSortChange,
    handleAddToToday,
    handleTodayIntent,
    handleTodaySnooze,
    handleTogglePin,
    handleTodayUndo,
    hasItems,
    actionTodayItems,
    highlightCounts,
    insertSuggestion,
    isMac,
    isSearching,
    newBookmarkIds,
    offlineMode,
    onBack,
    openBookmark,
    pinnedBookmarks,
    pinnedCardRefs,
    pinnedCount,
    pinnedIds,
    query,
    queryTerms,
    recents,
    renderEmptyState,
    scrollContainerRef,
    searchInputRef,
    searchMatchCounts,
    searchScope,
    setQuery,
    showSearchHint,
    showSuggestions,
    showUnpinButtons,
    sortedCompleted,
    sortedInProgress,
    sortedUnread,
    passiveHandledTodayItems,
    toastMessage,
    todayQueue,
    todayTweetIdSet,
    unpinnedRows,
    updateListState,
    virtualizer,
    visibleBookmarks,
    visiblePinnedCount,
  };
}

export function BookmarksList(props: Props) {
  return renderBookmarksList(useBookmarksListModel(props));
}

function renderBookmarksList({
  activeSort,
  activeTab,
  changeSearchScope,
  changeTab,
  containerWidthClass,
  didYouMean,
  focusedIndex,
  getBookmarkHref,
  handleAddToToday,
  handleLogin,
  handleRemoveRecent,
  handleSortChange,
  handleTodayIntent,
  handleTodaySnooze,
  handleTogglePin,
  handleTodayUndo,
  hasItems,
  actionTodayItems,
  highlightCounts,
  insertSuggestion,
  isMac,
  isSearching,
  newBookmarkIds,
  offlineMode,
  onBack,
  openBookmark,
  pinnedBookmarks,
  pinnedCardRefs,
  pinnedCount,
  pinnedIds,
  query,
  queryTerms,
  recents,
  renderEmptyState,
  scrollContainerRef,
  searchInputRef,
  searchMatchCounts,
  searchScope,
  setQuery,
  showSearchHint,
  showSuggestions,
  showUnpinButtons,
  sortedCompleted,
  sortedInProgress,
  sortedUnread,
  passiveHandledTodayItems,
  toastMessage,
  todayQueue,
  todayTweetIdSet,
  unpinnedRows,
  updateListState,
  virtualizer,
  visiblePinnedCount,
}: ReturnType<typeof useBookmarksListModel>) {
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
          <Autocomplete.Root
            mode="none"
            value={query}
            onValueChange={(value) => setQuery(value)}
            open={showSuggestions}
            onOpenChange={(nextOpen) => {
              if (!nextOpen) searchInputRef.current?.blur();
            }}
            openOnInputClick
          >
            <div className="relative ml-auto mr-1 w-40 shrink-0 transition-transform duration-150 ease-out focus-within:-translate-y-px sm:w-52 md:w-60">
              <MagnifyingGlassIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-control-muted" />
              <Autocomplete.Input
                ref={searchInputRef}
                onFocus={() => updateListState({ isSearchFocused: true })}
                onBlur={() => updateListState({ isSearchFocused: false })}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    setQuery("");
                    searchInputRef.current?.blur();
                  }
                }}
                aria-label="Filter bookmarks"
                placeholder="Search bookmarks..."
                className={cn(
                  "h-8 w-full rounded border border-border bg-surface-card/55 pl-8 text-xs-plus text-foreground placeholder:text-placeholder transition-[border-color,background-color] duration-150 ease-out focus:border-foreground/25 focus:bg-surface-card/75 focus:outline-none",
                  showSearchHint ? "pr-12" : "pr-2",
                )}
              />
              {showSearchHint && (
                <kbd
                  aria-hidden="true"
                  className="pointer-events-none absolute right-1.5 top-1/2 flex -translate-y-1/2 select-none items-center gap-0.5 rounded border border-border-soft bg-surface-card/90 px-1 py-px font-sans text-[10px] font-medium text-subtle shadow-[inset_0_-1px_0_0] shadow-border-soft"
                >
                  {isMac ? <span className="text-xs leading-none">⌘</span> : <span>Ctrl</span>}
                  <span>K</span>
                </kbd>
              )}
            </div>
            <Autocomplete.Portal>
              <Autocomplete.Positioner sideOffset={4} align="end" className="z-30">
                <Autocomplete.Popup className="w-72 overflow-hidden rounded-md border border-border/70 bg-surface-card shadow-xl outline-none">
                  <Autocomplete.List>
                    {recents.length > 0 && (
                      <Autocomplete.Group className="px-3 pt-2.5 pb-1.5">
                        <Autocomplete.GroupLabel className="block text-2xs font-medium uppercase tracking-extra-wide text-faint">
                          Recent
                        </Autocomplete.GroupLabel>
                        <div className="mt-1.5 flex flex-col">
                          {recents.map((q) => (
                            <Autocomplete.Item
                              key={q}
                              value={q}
                              onClick={() => insertSuggestion(q)}
                              className="group/recent flex cursor-pointer items-center gap-2 rounded py-1 pl-1 pr-1 text-xs text-muted outline-none transition-colors data-highlighted:bg-foreground/5 data-highlighted:text-foreground"
                            >
                              <ClockIcon className="size-3.5 shrink-0 text-control-muted" />
                              <span className="min-w-0 flex-1 truncate text-left">{q}</span>
                              <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveRecent(q);
                                }}
                                className="flex size-5 shrink-0 items-center justify-center rounded text-control-muted transition-colors hover:bg-foreground/5 hover:text-foreground"
                                aria-label={`Forget search ${q}`}
                                title="Forget"
                              >
                                <XIcon className="size-3" />
                              </button>
                            </Autocomplete.Item>
                          ))}
                        </div>
                      </Autocomplete.Group>
                    )}
                    {recents.length > 0 && (
                      <div className="border-t border-border-soft" />
                    )}
                    <Autocomplete.Group className="px-3 pt-2 pb-2.5">
                      <Autocomplete.GroupLabel className="block text-2xs font-medium uppercase tracking-extra-wide text-faint">
                        Try
                      </Autocomplete.GroupLabel>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {SUGGESTED_OPERATORS.map((op) => (
                          <Autocomplete.Item
                            key={op.label}
                            value={op.insert}
                            onClick={() => insertSuggestion(op.insert)}
                            className="inline-flex cursor-pointer items-center gap-1 rounded border border-border-soft bg-surface-card/55 px-1.5 py-0.5 text-2xs text-subtle outline-none transition-colors data-highlighted:border-foreground/25 data-highlighted:bg-surface-card data-highlighted:text-foreground"
                          >
                            <SparkleIcon className="size-2.5" />
                            <span>{op.label}</span>
                          </Autocomplete.Item>
                        ))}
                      </div>
                    </Autocomplete.Group>
                  </Autocomplete.List>
                </Autocomplete.Popup>
              </Autocomplete.Positioner>
            </Autocomplete.Portal>
          </Autocomplete.Root>
        </div>

        <Tabs.Root
          value={isSearching ? searchScope : activeTab}
          onValueChange={(value) => {
            if (isSearching) {
              changeSearchScope(value as "all" | "unread" | "continue" | "read");
            } else {
              changeTab(value as ReadingTab);
            }
          }}
          className={cn("mx-auto px-6", containerWidthClass)}
        >
          <Tabs.List className="relative flex">
            {isSearching && (
              <Tabs.Tab
                value="all"
                className={cn(
                  "px-4 py-2.5 text-sm font-medium transition-colors outline-none select-none",
                  "text-muted hover:text-foreground data-active:text-foreground",
                )}
              >
                All
                <span className="ml-1.5 inline-flex items-center justify-center rounded px-1.5 text-xs tabular-nums bg-muted/10 text-muted">
                  {searchMatchCounts.all}
                </span>
              </Tabs.Tab>
            )}
            {!isSearching && (
              <Tabs.Tab
                value="today"
                className={cn(
                  "px-4 py-2.5 text-sm font-medium transition-colors outline-none select-none",
                  "text-muted hover:text-foreground data-active:text-foreground",
                )}
              >
                <span className="inline-flex items-center gap-1.5">
                  <SparkleIcon
                    weight="fill"
                    className="size-3.5 text-accent/75"
                  />
                  Today's Read
                </span>
                {(todayQueue?.activeCount ?? 0) > 0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center rounded px-1.5 text-xs tabular-nums bg-accent-surface text-accent">
                    {todayQueue?.activeCount}
                  </span>
                )}
              </Tabs.Tab>
            )}
            <Tabs.Tab
              value="unread"
              className={cn(
                "px-4 py-2.5 text-sm font-medium transition-colors outline-none select-none",
                "text-muted hover:text-foreground data-active:text-foreground",
              )}
            >
              Unread
              {(isSearching
                ? searchMatchCounts.unread
                : sortedUnread.length) > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center rounded px-1.5 text-xs tabular-nums bg-muted/10 text-muted">
                  {isSearching ? searchMatchCounts.unread : sortedUnread.length}
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
              {(isSearching
                ? searchMatchCounts.continue
                : sortedInProgress.length) > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center rounded px-1.5 text-xs tabular-nums bg-accent-surface text-accent">
                  {isSearching
                    ? searchMatchCounts.continue
                    : sortedInProgress.length}
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
              {(isSearching
                ? searchMatchCounts.read
                : sortedCompleted.length) > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center rounded px-1.5 text-xs tabular-nums bg-success/10 text-success">
                  {isSearching
                    ? searchMatchCounts.read
                    : sortedCompleted.length}
                </span>
              )}
            </Tabs.Tab>
            <Tabs.Indicator className="absolute bottom-0 h-0.5 w-[var(--active-tab-width)] translate-x-[var(--active-tab-left)] rounded-full bg-accent transition-[width,translate] duration-200 ease-tab" />
          </Tabs.List>
        </Tabs.Root>
      </div>

      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto">
        <main className={cn(containerWidthClass, "mx-auto px-6 pb-16 pt-4")}>
          {isSearching && didYouMean && (
            <div className="mb-3 rounded border border-border-soft bg-surface-card/55 px-3 py-2 text-xs text-subtle">
              Did you mean{" "}
              <button
                type="button"
                onClick={() => {
                  setQuery(didYouMean);
                  searchInputRef.current?.focus();
                }}
                className="font-medium text-foreground underline decoration-foreground/30 underline-offset-2 hover:decoration-foreground/60"
              >
                {didYouMean}
              </button>
              ?
            </div>
          )}
          {hasItems && !isSearching && activeTab !== "today" && (
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
                className="w-36 shrink-0 border-border bg-surface-card/55 hover:bg-surface-card/75"
                popupClassName="w-[7.5rem]"
              />
            </div>
          )}

          {!isSearching && activeTab === "unread" && pinnedCount > 0 && (
            <div className="mb-2">
              <span className="text-2xs font-medium uppercase tracking-extra-wide text-faint">
                Pinned
              </span>
            </div>
          )}
          {!isSearching && activeTab === "unread" && pinnedCount > 0 && (
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
                      "before:pointer-events-none before:absolute before:top-0 before:right-0 before:z-[3] before:size-6 before:-translate-y-1/2 before:translate-x-1/2 before:rotate-45 before:bg-surface before:shadow-[0_1px_0_0] before:shadow-border before:transition-[width,height,box-shadow] before:duration-180 before:ease-[var(--ease-hover)] before:content-['']",
                      "after:pointer-events-none after:absolute after:top-0 after:right-0 after:z-[2] after:h-[22px] after:w-[22px] after:-translate-y-1.5 after:translate-x-1.5 after:rounded-bl-md after:border after:border-border after:bg-surface after:shadow-xs after:transition-[width,height,box-shadow] after:duration-180 after:ease-[var(--ease-hover)] after:content-['']",
                      "hover:rounded-tr-[35px] hover:bg-surface-hover hover:before:size-10 hover:after:h-[34px] hover:after:w-[34px] hover:after:shadow-lg hover:after:shadow-black/5",
                      isFocused && "bg-surface-hover ring-1 ring-accent/30",
                    )}
                  >
                    <div className="absolute top-3 left-0 h-5 w-[3px] rounded-r-sm bg-accent" />
                    <div className="relative flex items-center gap-2">
                      <img
                        src={bookmark.author.profileImageUrl}
                        alt={`@${bookmark.author.screenName}`}
                        role="button"
                        tabIndex={0}
                        aria-label={`Open @${bookmark.author.screenName} on X`}
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
                        onKeyDown={(e) => {
                          if (e.key !== "Enter" && e.key !== " ") return;
                          e.stopPropagation();
                          e.preventDefault();
                          window.open(
                            `https://x.com/${bookmark.author.screenName}`,
                            "_blank",
                            "noopener,noreferrer",
                          );
                        }}
                      />
                      <a
                        href={`https://x.com/${bookmark.author.screenName}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="truncate text-xs text-subtle transition-colors hover:text-foreground"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Highlighted
                          as="span"
                          text={`@${bookmark.author.screenName}`}
                          terms={queryTerms}
                        />
                      </a>
                    </div>
                    <Highlighted
                      as="p"
                      text={pickTitle(bookmark)}
                      terms={queryTerms}
                      className="line-clamp-2 text-xs leading-relaxed text-foreground"
                    />
                    {hasAnnotations && (
                      <p className="truncate text-2xs text-faint">
                        {(counts?.highlights ?? 0) > 0 && (
                          <span className="text-accent">
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
                            className="opacity-80"
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
          {!isSearching && activeTab === "unread" && pinnedCount > 0 && unpinnedRows.length > 0 && (
            <div className="mb-4 border-t border-dashed border-border-soft" />
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
                      onClick={(event) => {
                        if (
                          event.defaultPrevented ||
                          event.metaKey ||
                          event.ctrlKey ||
                          event.shiftKey ||
                          event.altKey ||
                          isSearching ||
                          activeTab !== "today"
                        ) {
                          return;
                        }
                        event.preventDefault();
                        openBookmark(bookmark);
                      }}
                      className={cn(
                        "group/row flex w-full items-center gap-3 py-3 px-3 text-left no-underline transition-colors duration-150",
                        virtualItem.index % 2 === 0
                          ? "bg-surface-alt hover:bg-surface-alt-hover"
                          : "hover:bg-surface-hover",
                        isFocused && "ring-1 ring-accent/20",
                      )}
                    >
                      <img
                        src={bookmark.author.profileImageUrl}
                        alt={`@${bookmark.author.screenName}`}
                        role="button"
                        tabIndex={0}
                        aria-label={`Open @${bookmark.author.screenName} on X`}
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
                        onKeyDown={(e) => {
                          if (e.key !== "Enter" && e.key !== " ") return;
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
                          <Highlighted
                            as="span"
                            text={pickTitle(bookmark)}
                            terms={queryTerms}
                          />
                          {newBookmarkIds.has(bookmark.tweetId) && (
                            <Badge
                              variant="accent"
                              className="ml-2 align-middle"
                            >
                              New
                            </Badge>
                          )}
                        </p>
                        {isSearching && (
                          <Highlighted
                            as="p"
                            text={pickSearchSnippet(bookmark)}
                            terms={queryTerms}
                            windowTokens={20}
                            hideOnNoMatch
                            className="mt-0.5 line-clamp-1 text-xs text-subtle"
                          />
                        )}
                        <p className="mt-1 truncate text-xs text-subtle">
                          <a
                            href={`https://x.com/${bookmark.author.screenName}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="transition-colors hover:text-foreground"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Highlighted
                              as="span"
                              text={`@${bookmark.author.screenName}`}
                              terms={queryTerms}
                            />
                          </a>
                          {row.subtitle ? (
                            <span className="text-faint">
                              {" "}
                              &middot; {row.subtitle}
                            </span>
                          ) : (
                            <span className="text-faint">
                              {" "}
                              &middot; {inferKindBadge(bookmark)}
                            </span>
                          )}
                          {(counts?.highlights ?? 0) > 0 && (
                            <span className="text-faint">
                              {" "}
                              &middot;{" "}
                              <span className="text-accent">
                                {counts!.highlights}{" "}
                                {counts!.highlights === 1
                                  ? "Highlight"
                                  : "Highlights"}
                              </span>
                            </span>
                          )}
                          {(counts?.notes ?? 0) > 0 && (
                            <span className="text-faint">
                              {" "}
                              &middot;{" "}
                              <span
                                style={{ color: "var(--note-pill-fg)" }}
                                className="opacity-80"
                              >
                                {counts!.notes}{" "}
                                {counts!.notes === 1 ? "Note" : "Notes"}
                              </span>
                            </span>
                          )}
                        </p>
                      </div>
                      {!isSearching && activeTab === "today" && (
                        <div className="flex shrink-0 items-center gap-0.5">
                          <button
                            type="button"
                            onClick={(e) =>
                              handleTodaySnooze(bookmark.tweetId, e)
                            }
                            className="flex size-8 items-center justify-center rounded text-control-muted transition-colors hover:bg-foreground/5 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus-ring"
                            aria-label="Snooze"
                            title="Snooze"
                          >
                            <ClockCountdownIcon className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) =>
                              handleTodayIntent(
                                bookmark.tweetId,
                                "reference",
                                e,
                              )
                            }
                            className="flex size-8 items-center justify-center rounded text-control-muted transition-colors hover:bg-foreground/5 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus-ring"
                            aria-label="Archive"
                            title="Archive"
                          >
                            <ArchiveIcon className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) =>
                              handleTodayIntent(bookmark.tweetId, "act", e)
                            }
                            className="flex size-8 items-center justify-center rounded text-control-muted transition-colors hover:bg-foreground/5 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus-ring"
                            aria-label="Act on this"
                            title="Act on this"
                          >
                            <ListChecksIcon className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleTogglePin(bookmark.tweetId, e)}
                            className={cn(
                              "flex size-8 items-center justify-center rounded transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus-ring",
                              pinnedIds.has(bookmark.tweetId)
                                ? "text-accent hover:bg-accent-surface"
                                : "text-control-muted hover:bg-foreground/5 hover:text-foreground",
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
                                pinnedIds.has(bookmark.tweetId)
                                  ? "fill"
                                  : "regular"
                              }
                              className="size-3.5"
                            />
                          </button>
                        </div>
                      )}
                      {activeTab === "unread" && (
                        <div className="flex shrink-0 items-center gap-0.5">
                          {!isSearching && todayQueue && (
                            <button
                              type="button"
                              onClick={(e) =>
                                handleAddToToday(bookmark.tweetId, e)
                              }
                              disabled={todayTweetIdSet.has(bookmark.tweetId)}
                              className={cn(
                                "flex size-8 shrink-0 items-center justify-center rounded transition-[background-color,color,opacity]",
                                todayTweetIdSet.has(bookmark.tweetId)
                                  ? "cursor-default text-accent opacity-100"
                                  : "text-control-muted opacity-0 hover:bg-foreground/5 hover:text-muted group-hover/row:opacity-100",
                              )}
                              aria-label={
                                todayTweetIdSet.has(bookmark.tweetId)
                                  ? "In Today's Read"
                                  : "Add to Today's Read"
                              }
                              title={
                                todayTweetIdSet.has(bookmark.tweetId)
                                  ? "In Today's Read"
                                  : "Add to Today's Read"
                              }
                            >
                              <ListPlusIcon
                                weight={
                                  todayTweetIdSet.has(bookmark.tweetId)
                                    ? "fill"
                                    : "regular"
                                }
                                className="size-3.5"
                              />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={(e) => handleTogglePin(bookmark.tweetId, e)}
                            className={cn(
                              "flex size-10 shrink-0 items-center justify-center rounded transition-[color,opacity]",
                              pinnedIds.has(bookmark.tweetId)
                                ? "text-accent opacity-100 hover:text-accent/80"
                                : "text-control-muted opacity-0 group-hover/row:opacity-100 hover:text-muted",
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
                                pinnedIds.has(bookmark.tweetId)
                                  ? "fill"
                                  : "regular"
                              }
                              className="size-3.5"
                            />
                          </button>
                        </div>
                      )}
                      {activeTab !== "unread" &&
                        activeTab !== "today" &&
                        pinnedIds.has(bookmark.tweetId) && (
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

          {!isSearching &&
            activeTab === "today" &&
            actionTodayItems.length > 0 && (
              <section
                className={cn(
                  "mt-8 border-t border-border-soft pt-4",
                  !hasItems && "mt-4",
                )}
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-2xs font-medium uppercase tracking-extra-wide text-faint">
                    Action needed
                  </span>
                  <span className="text-xs tabular-nums text-faint">
                    {actionTodayItems.length}
                  </span>
                </div>
                <div className="divide-y divide-border-soft">
                  {actionTodayItems.map((item) => {
                    const title = pickTitle(item.bookmark);

                    return (
                      <div
                        key={`${item.bookmark.tweetId}:${item.reason}`}
                        className="flex items-center gap-3 py-2.5"
                      >
                        <span className="flex size-7 shrink-0 items-center justify-center rounded bg-accent-surface text-accent">
                          <ListChecksIcon className="size-3.5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-secondary">
                            {title}
                          </p>
                          <p className="mt-0.5 truncate text-2xs text-subtle">
                            Follow-up
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={(e) =>
                            handleTodayUndo(
                              item.bookmark.tweetId,
                              item.reason,
                              e,
                            )
                          }
                          className="h-7 shrink-0 px-2 text-xs text-control-muted hover:text-foreground"
                        >
                          <ArrowCounterClockwiseIcon className="size-3" />
                          Undo
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

          {!isSearching &&
            activeTab === "today" &&
            passiveHandledTodayItems.length > 0 && (
              <section
                className={cn(
                  "border-t border-border-soft pt-4",
                  actionTodayItems.length > 0 ? "mt-6" : "mt-8",
                  !hasItems && actionTodayItems.length === 0 && "mt-4",
                )}
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-2xs font-medium uppercase tracking-extra-wide text-faint">
                    Handled today
                  </span>
                  <span className="text-xs tabular-nums text-faint">
                    {passiveHandledTodayItems.length}
                  </span>
                </div>
                <div className="divide-y divide-border-soft">
                  {passiveHandledTodayItems.map((item) => {
                    const label = HANDLED_TODAY_LABELS[item.reason];
                    const title = pickTitle(item.bookmark);

                    return (
                      <div
                        key={`${item.bookmark.tweetId}:${item.reason}`}
                        className="flex items-center gap-3 py-2.5"
                      >
                        <span className="flex size-7 shrink-0 items-center justify-center rounded bg-surface-alt text-control-muted">
                          <HandledTodayIcon reason={item.reason} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-secondary">
                            {title}
                          </p>
                          <p className="mt-0.5 truncate text-2xs text-subtle">
                            {label}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={(e) =>
                            handleTodayUndo(
                              item.bookmark.tweetId,
                              item.reason,
                              e,
                            )
                          }
                          className="h-7 shrink-0 px-2 text-xs text-control-muted hover:text-foreground"
                        >
                          <ArrowCounterClockwiseIcon className="size-3" />
                          Undo
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

          {offlineMode && (
            <div className="mt-8">
              <OfflineBanner onLogin={handleLogin} />
            </div>
          )}
        </main>
      </div>

      {toastMessage && (
        <Toast message={toastMessage} onDismiss={() => updateListState({ toastMessage: null })} />
      )}
    </div>
  );
}
