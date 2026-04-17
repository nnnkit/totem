import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ToggleGroup } from "@base-ui/react/toggle-group";
import { Toggle } from "@base-ui/react/toggle";
import { useHotkeys } from "react-hotkeys-hook";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  ArrowLeftIcon,
  CircleNotchIcon,
  DownloadSimpleIcon,
  List,
  MagnifyingGlassIcon,
  SquaresFour,
} from "@phosphor-icons/react";
import type { Bookmark, BookmarkIntent } from "../types";
import { setIntent } from "../db/intent-repo";
import type { ContinueReadingItem } from "../hooks/useContinueReading";
import { useBookmarkSearch } from "../hooks/useBookmarkSearch";
import { pickTitle, inferKindBadge } from "../lib/bookmark-utils";
import { cn } from "../lib/cn";
import type { ReadingTab } from "../lib/reading-list";
import { sortIndexToTimestamp } from "../lib/time";
import { getAllBookmarks } from "../db";
import { articleToMarkdown } from "../lib/export/article-to-markdown";
import { downloadMarkdownFile } from "../lib/export/article-download";
import { resolveReaderExportArticle } from "../lib/export/tweet-export";
import {
  useIsOffline,
  useRuntimeActions,
  type SyncButtonState,
} from "../stores/selectors";
import { runtimeStore } from "../stores/runtime-store";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { OfflineBanner } from "./ui/OfflineBanner";
import { Toast } from "./ui/Toast";

export type { ReadingTab } from "../lib/reading-list";

interface Props {
  continueReadingItems: ContinueReadingItem[];
  unreadBookmarks: Bookmark[];
  activeTab?: ReadingTab;
  onTabChange?: (tab: ReadingTab) => void;
  onOpenBookmark: (bookmark: Bookmark) => void;
  getBookmarkHref: (bookmark: Bookmark) => string;
  onSync: () => void;
  onBack: () => void;
  syncButtonStateOverride?: SyncButtonState;
  offlineModeOverride?: boolean;
  onLogin?: () => void;
}

const ITEM_HEIGHT = 64;

const INTENT_BORDER_COLORS: Record<BookmarkIntent, string> = {
  read_soon: "bg-accent",
  reference: "bg-muted/30",
  act_on: "bg-accent-700 dark:bg-accent-400",
  unsorted: "bg-transparent",
};

const INTENT_LABELS: { intent: BookmarkIntent; label: string }[] = [
  { intent: "read_soon", label: "Read soon" },
  { intent: "reference", label: "Reference" },
  { intent: "act_on", label: "Act on" },
];

const INTENT_DOT_STYLES: Record<BookmarkIntent, string> = {
  read_soon: "bg-accent",
  reference: "bg-muted/50",
  act_on: "bg-accent-700 dark:bg-accent-400",
  unsorted: "",
};

type IntentFilter = BookmarkIntent | "all";
type FormatFilter = "all" | "threads" | "articles";
type ViewMode = "browse" | "list";

function getBookmarkTimestamp(bookmark: Bookmark): number | null {
  try {
    return sortIndexToTimestamp(bookmark.sortIndex);
  } catch {
    return null;
  }
}

function formatOldestDate(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

const INTENT_PILL_CONFIG: { value: IntentFilter; label: string; countKey?: BookmarkIntent }[] = [
  { value: "all", label: "all" },
  { value: "read_soon", label: "read soon", countKey: "read_soon" },
  { value: "reference", label: "reference", countKey: "reference" },
  { value: "act_on", label: "act on", countKey: "act_on" },
];

export function BookmarksList({
  continueReadingItems,
  unreadBookmarks,
  onOpenBookmark,
  getBookmarkHref,
  onBack,
  offlineModeOverride,
  onLogin,
}: Props) {
  const containerWidthClass = "max-w-3xl";
  const runtimeOfflineMode = useIsOffline();
  const actions = useRuntimeActions();
  const offlineMode = offlineModeOverride ?? runtimeOfflineMode;

  const [viewMode, setViewMode] = useState<ViewMode>("browse");
  const [intentFilter, setIntentFilter] = useState<IntentFilter>("all");
  const [formatFilter, setFormatFilter] = useState<FormatFilter>("all");
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

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

  const intentCounts = useMemo(() => {
    const counts: Record<BookmarkIntent, number> = {
      read_soon: 0,
      reference: 0,
      act_on: 0,
      unsorted: 0,
    };
    for (const b of allBookmarks) {
      counts[b.intent ?? "unsorted"]++;
    }
    return counts;
  }, [allBookmarks]);

  const formatCounts = useMemo(() => {
    let threads = 0;
    let articles = 0;
    for (const b of allBookmarks) {
      if (b.tweetKind === "thread" || b.isThread) threads++;
      if (b.tweetKind === "article") articles++;
    }
    return { threads, articles };
  }, [allBookmarks]);

  const filteredBookmarks = useMemo(() => {
    let list = isSearching ? results : allBookmarks;
    if (intentFilter !== "all") {
      list = list.filter((b) => (b.intent ?? "unsorted") === intentFilter);
    }
    if (formatFilter === "threads") {
      list = list.filter((b) => b.tweetKind === "thread" || b.isThread);
    } else if (formatFilter === "articles") {
      list = list.filter((b) => b.tweetKind === "article");
    }
    return [...list].sort((a, b) => {
      const tsA = getBookmarkTimestamp(a) ?? 0;
      const tsB = getBookmarkTimestamp(b) ?? 0;
      return tsB - tsA;
    });
  }, [allBookmarks, results, isSearching, intentFilter, formatFilter]);

  const recentlySaved = useMemo(() => {
    const sorted = [...allBookmarks].sort((a, b) => {
      const tsA = getBookmarkTimestamp(a) ?? 0;
      const tsB = getBookmarkTimestamp(b) ?? 0;
      return tsB - tsA;
    });
    return sorted.slice(0, 5);
  }, [allBookmarks]);

  const fromAYearAgo = useMemo(() => {
    const now = new Date();
    const oneYearAgo = new Date(
      now.getFullYear() - 1,
      now.getMonth(),
      now.getDate(),
    );
    const windowMs = 3 * 24 * 60 * 60 * 1000;
    const windowStart = oneYearAgo.getTime() - windowMs;
    const windowEnd = oneYearAgo.getTime() + windowMs;
    return allBookmarks.filter((b) => {
      return b.createdAt >= windowStart && b.createdAt <= windowEnd;
    });
  }, [allBookmarks]);

  const oldestDate = useMemo(() => {
    let oldest = Infinity;
    for (const b of allBookmarks) {
      const ts = getBookmarkTimestamp(b);
      if (ts !== null && ts < oldest) oldest = ts;
    }
    if (!Number.isFinite(oldest)) return null;
    return new Date(oldest);
  }, [allBookmarks]);

  useEffect(() => {
    setFocusedIndex(-1);
  }, [intentFilter, formatFilter, viewMode]);

  const virtualizer = useVirtualizer({
    count: filteredBookmarks.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => ITEM_HEIGHT,
    overscan: 10,
  });

  useHotkeys(
    "/",
    () => {
      searchInputRef.current?.focus();
    },
    { preventDefault: true },
  );

  useHotkeys(
    "mod+k",
    () => {
      searchInputRef.current?.focus();
    },
    { preventDefault: true },
  );

  const ignoreListHotkeys = useCallback((event: KeyboardEvent) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return false;
    return Boolean(
      target.closest(
        "input, textarea, select, button, [role='button'], [role='option'], [role='listbox']",
      ),
    );
  }, []);

  useHotkeys(
    "j, ArrowDown",
    () => {
      setFocusedIndex((prev) =>
        prev < filteredBookmarks.length - 1 ? prev + 1 : prev,
      );
    },
    { preventDefault: true, ignoreEventWhen: ignoreListHotkeys },
    [filteredBookmarks.length],
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
      if (focusedIndex >= 0 && focusedIndex < filteredBookmarks.length) {
        onOpenBookmark(filteredBookmarks[focusedIndex]);
      }
    },
    { preventDefault: true, ignoreEventWhen: ignoreListHotkeys },
    [focusedIndex, filteredBookmarks, onOpenBookmark],
  );

  useHotkeys(
    "escape",
    () => onBack(),
    { preventDefault: true, ignoreEventWhen: ignoreListHotkeys },
    [onBack],
  );

  useEffect(() => {
    if (focusedIndex >= 0 && focusedIndex < filteredBookmarks.length) {
      virtualizer.scrollToIndex(focusedIndex, { align: "auto" });
    }
  }, [focusedIndex, filteredBookmarks.length, virtualizer]);

  const handleExportAll = useCallback(async () => {
    setIsExporting(true);
    try {
      const bookmarks = await getAllBookmarks();
      const now = new Date();
      const exportedAtLabel = now.toLocaleString();
      const header = [
        `# Bookmarks export`,
        `> ${bookmarks.length} bookmarks — exported ${now.toLocaleDateString()}`,
        "",
      ].join("\n");

      const sections = bookmarks
        .map((bookmark) => {
          const article = resolveReaderExportArticle(bookmark, []);
          return articleToMarkdown(article, {
            authorProfileImageUrl: bookmark.author.profileImageUrl,
            metadata: {
              postUrl: `https://x.com/${bookmark.author.screenName}/status/${bookmark.tweetId}`,
              authorName: bookmark.author.name,
              authorHandle: bookmark.author.screenName,
              exportedAtLabel,
            },
          });
        })
        .filter(Boolean);

      const body = `${header}\n${sections.join("\n---\n\n")}`;
      const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      downloadMarkdownFile(body, `bookmarks-${localDate}.md`);
    } catch (err) {
      console.error("Failed to export bookmarks", err);
    } finally {
      setIsExporting(false);
    }
  }, []);

  const handleSetIntent = useCallback(
    (bookmarkId: string, intent: BookmarkIntent, event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const now = new Date().toISOString();
      runtimeStore.setState((state) => ({
        bookmarks: state.bookmarks.map((b) =>
          b.id === bookmarkId
            ? {
                ...b,
                intent,
                intentSource: "manual" as const,
                intentAssignedAt: now,
              }
            : b,
        ),
      }));
      void setIntent(bookmarkId, { intent, intentSource: "manual" });
    },
    [],
  );

  const handleViewModeChange = useCallback((values: string[]) => {
    if (values.length > 0) {
      setViewMode(values[0] as ViewMode);
    }
  }, []);

  const isFiltering =
    intentFilter !== "all" || formatFilter !== "all" || isSearching;
  const hasItems = filteredBookmarks.length > 0;

  const renderRow = useCallback(
    (
      bookmark: Bookmark,
      index: number,
      isFocused: boolean,
    ) => (
      <a
        href={getBookmarkHref(bookmark)}
        className={cn(
          "group/row relative flex w-full items-center gap-3 py-3 px-3 text-left no-underline transition-colors duration-150",
          index % 2 === 0
            ? "bg-surface-alt hover:bg-surface-hover"
            : "hover:bg-surface-hover",
          isFocused && "ring-1 ring-accent/20",
        )}
      >
        <div
          className={cn(
            "absolute left-0 top-1/2 h-8 w-[3px] -translate-y-1/2 rounded-r-sm",
            INTENT_BORDER_COLORS[bookmark.intent ?? "unsorted"],
          )}
        />
        <img
          src={bookmark.author.profileImageUrl}
          alt={`@${bookmark.author.screenName}`}
          className="size-9 shrink-0 rounded-full shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium leading-snug text-foreground">
            {pickTitle(bookmark)}
          </p>
          <p className="mt-1 truncate text-xs text-muted/50">
            <a
              href={`https://x.com/${bookmark.author.screenName}`}
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-foreground"
              onClick={(e) => e.stopPropagation()}
            >
              @{bookmark.author.screenName}
            </a>
            <span className="text-muted/40">
              {" "}
              &middot; {inferKindBadge(bookmark)}
            </span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover/row:opacity-100">
          {INTENT_LABELS.map(({ intent, label }) => (
            <button
              key={intent}
              type="button"
              onClick={(e) => handleSetIntent(bookmark.id, intent, e)}
              className={cn(
                "flex size-6 items-center justify-center rounded-full transition-[transform,opacity] hover:scale-125",
                bookmark.intent === intent
                  ? "opacity-100"
                  : "opacity-60 hover:opacity-100",
              )}
              aria-label={`File as ${label}`}
              title={label}
            >
              <span
                className={cn(
                  "block size-2 rounded-full",
                  INTENT_DOT_STYLES[intent],
                  bookmark.intent === intent && "ring-1 ring-foreground/20",
                )}
              />
            </button>
          ))}
        </div>
      </a>
    ),
    [getBookmarkHref, handleSetIntent],
  );

  return (
    <div className="flex h-dvh flex-col bg-surface">
      <div className="sticky top-0 z-10 shrink-0 border-b border-border bg-surface/80 backdrop-blur-md">
        <div className={cn("mx-auto px-6 pt-4 pb-4", containerWidthClass)}>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              aria-label="Back to home"
              title="Back"
            >
              <ArrowLeftIcon className="size-5" />
            </Button>
            <div className="min-w-0 flex-1">
              <h1 className="font-serif text-xl text-foreground">
                Your library
              </h1>
              <p className="text-xs italic text-muted">
                a quiet record of what&apos;s caught your attention
              </p>
            </div>
            <ToggleGroup
              value={[viewMode]}
              onValueChange={handleViewModeChange}
              className="flex gap-0.5 rounded-md border border-border/70 p-0.5"
            >
              <Toggle
                value="browse"
                className={cn(
                  "flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors",
                  "text-muted hover:text-foreground",
                  "data-[pressed]:bg-surface-alt data-[pressed]:text-foreground",
                )}
              >
                <SquaresFour className="size-3.5" />
                Browse
              </Toggle>
              <Toggle
                value="list"
                className={cn(
                  "flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors",
                  "text-muted hover:text-foreground",
                  "data-[pressed]:bg-surface-alt data-[pressed]:text-foreground",
                )}
              >
                <List className="size-3.5" />
                List
              </Toggle>
            </ToggleGroup>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                void handleExportAll();
              }}
              disabled={isExporting}
              aria-label="Export all bookmarks"
              title={isExporting ? "Exporting…" : "Export all as Markdown"}
              aria-busy={isExporting}
            >
              {isExporting ? (
                <CircleNotchIcon className="size-5 animate-spin" />
              ) : (
                <DownloadSimpleIcon className="size-5" />
              )}
            </Button>
          </div>

          <div className="relative mt-3">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted/65" />
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
              aria-label="Search your library"
              placeholder="Search your library..."
              className="h-9 border-border/70 bg-surface/45 pl-9 pr-12 text-sm placeholder:text-muted/50 transition-[border-color,background-color] duration-150 ease-out focus:border-foreground/20 focus:bg-surface/55"
            />
            <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
              ⌘K
            </kbd>
          </div>

          <p className="mt-2 text-xs text-muted/60">
            {allBookmarks.length} saved
            {oldestDate && <> &middot; oldest from {formatOldestDate(oldestDate)}</>}
            &nbsp;&middot; never leaves this browser
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {INTENT_PILL_CONFIG.map(({ value, label, countKey }) => (
              <button
                key={value}
                type="button"
                onClick={() =>
                  setIntentFilter((prev) =>
                    value === "all"
                      ? "all"
                      : prev === value
                        ? "all"
                        : value,
                  )
                }
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  intentFilter === value
                    ? "bg-foreground text-surface"
                    : "bg-surface-alt text-muted hover:text-foreground",
                )}
              >
                {label}
                {countKey && (
                  <span className="ml-1 tabular-nums">
                    {intentCounts[countKey]}
                  </span>
                )}
              </button>
            ))}

            <span className="mx-1 h-4 w-px bg-border/50" />

            <button
              type="button"
              onClick={() =>
                setFormatFilter((prev) =>
                  prev === "threads" ? "all" : "threads",
                )
              }
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                formatFilter === "threads"
                  ? "bg-foreground text-surface"
                  : "bg-surface-alt text-muted hover:text-foreground",
              )}
            >
              threads{" "}
              <span className="tabular-nums">{formatCounts.threads}</span>
            </button>
            <button
              type="button"
              onClick={() =>
                setFormatFilter((prev) =>
                  prev === "articles" ? "all" : "articles",
                )
              }
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                formatFilter === "articles"
                  ? "bg-foreground text-surface"
                  : "bg-surface-alt text-muted hover:text-foreground",
              )}
            >
              articles{" "}
              <span className="tabular-nums">{formatCounts.articles}</span>
            </button>
          </div>
        </div>
      </div>

      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto">
        <main className={cn(containerWidthClass, "mx-auto px-6 pb-16 pt-4")}>
          {viewMode === "browse" ? (
            <>
              {!isFiltering && recentlySaved.length > 0 && (
                <section className="mb-6">
                  <h2 className="mb-2 text-2xs font-medium uppercase tracking-extra-wide text-muted/40">
                    Recently saved
                  </h2>
                  <div className="divide-y divide-border/30 overflow-hidden rounded-lg border border-border/50">
                    {recentlySaved.map((bookmark, idx) => (
                      <div key={bookmark.tweetId}>
                        {renderRow(bookmark, idx, false)}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {!isFiltering && fromAYearAgo.length > 0 && (
                <section className="mb-6">
                  <h2 className="mb-2 text-2xs font-medium uppercase tracking-extra-wide text-muted/40">
                    From a year ago
                  </h2>
                  <div className="divide-y divide-border/30 overflow-hidden rounded-lg border border-border/50">
                    {fromAYearAgo.map((bookmark, idx) => (
                      <div key={bookmark.tweetId}>
                        {renderRow(bookmark, idx, false)}
                      </div>
                    ))}
                  </div>
                </section>
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
                    const bookmark = filteredBookmarks[virtualItem.index];
                    const isFocused = focusedIndex === virtualItem.index;

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
                        {renderRow(bookmark, virtualItem.index, isFocused)}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <p className="text-balance text-lg text-muted">
                    {isSearching
                      ? "No bookmarks match your search."
                      : "No bookmarks yet."}
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <p className="text-balance text-lg text-muted">
                List view coming soon
              </p>
              <p className="mt-2 text-sm text-muted/60">
                Time-grouped archive with bulk select
              </p>
            </div>
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
