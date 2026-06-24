import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import {
  ArrowsClockwiseIcon,
  CaretLeftIcon,
  CaretRightIcon,
  EnvelopeSimpleIcon,
  GearSixIcon,
  InfoIcon,
  LinkBreakIcon,
  MagnifyingGlassIcon,
  XIcon,
  XLogoIcon,
} from "@phosphor-icons/react";
import { TotemLogo } from "./TotemLogo";
import { SearchEnginePicker } from "./SearchEnginePicker";
import type {
  BackgroundMode,
  Bookmark,
  RecommendationSource,
  SearchEngineId,
} from "../types";
import type { UseTodayQueueResult } from "../hooks/useTodayQueue";
import type { ReadingTab } from "../lib/reading-list";
import { getPinnedTweetIdsOrdered } from "../lib/pins";
import { SEARCH_ENGINES } from "../lib/search-engines";
import { hasChromeSearch } from "../lib/chrome";
import { resolveHomeReadingTab } from "../lib/home-reading-tab";
import { formatClock } from "../lib/time";
import {
  pickTitle,
  pickExcerpt,
  estimateReadingMinutes,
} from "../lib/bookmark-utils";
import { cn } from "../lib/cn";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import {
  SUPPORT_EMAIL_URL,
  SUPPORT_X_HANDLE,
  SUPPORT_X_URL,
} from "../lib/constants/support";
import {
  TODAY_QUEUE_DONE_MESSAGE,
  TODAY_QUEUE_DONE_TITLE,
  TODAY_QUEUE_TWO_MORE_EXHAUSTED,
  TODAY_QUEUE_TWO_MORE_LABEL,
} from "../lib/constants/ui";
import {
  getTodayQueueProgress,
  TodayQueueProgressIndicator,
  type TodayQueueProgress,
} from "./new-tab-home-progress";
import { Popover, PopoverContent } from "./ui/Popover";
import { useWallpaper } from "../hooks/useWallpaper";
import { useTopSites } from "../hooks/useTopSites";
import {
  useFooterState,
  useIsOffline,
  useRuntimeActions,
  useSyncButtonState,
  type FooterState,
  type SyncButtonState,
} from "../stores/selectors";
import {
  getHydrationStore,
  useHydrationStore,
  type HydrationStatus,
} from "../stores/hydration-store";
import { getHydrationProgress } from "../lib/hydration/progress";
import {
  getFullExportReadyDismissalSignature,
  isFullExportReadyForCurrentLibrary,
  readFullExportReadyDismissal,
  writeFullExportReadyDismissal,
} from "../lib/export/full-export-ready-dismissal";

import { CLOCK_UPDATE_MS } from "../lib/constants/timing";

interface Props {
  bookmarks: Bookmark[];
  onSync: () => void;
  detailedTweetIds: Set<string>;
  showTopSites: boolean;
  showSearchBar: boolean;
  searchEngine: SearchEngineId;
  onSearchEngineChange: (engine: SearchEngineId) => void;
  topSitesLimit: number;
  backgroundMode: BackgroundMode;
  openedTweetIds: Set<string>;
  onOpenBookmark: (bookmark: Bookmark) => void;
  getBookmarkHref: (bookmark: Bookmark) => string;
  onOpenSettings: () => void;
  onOpenImport: () => void;
  onOpenExport: () => void;
  recommendationSource: RecommendationSource;
  todayQueue?: UseTodayQueueResult;
  onOpenReading: (tab?: ReadingTab) => void;
  isResetting?: boolean;
  footerStateOverride?: FooterState;
  syncButtonStateOverride?: SyncButtonState;
  offlineModeOverride?: boolean;
  onLogin?: () => void;
}

interface DecoratedBookmark {
  bookmark: Bookmark;
  title: string;
  excerpt: string;
  minutes: number | null;
  isRead: boolean;
}

function decorateBookmark(
  bookmark: Bookmark,
  detailedTweetIds: ReadonlySet<string>,
  openedTweetIds: ReadonlySet<string>,
): DecoratedBookmark {
  return {
    bookmark,
    title: pickTitle(bookmark),
    excerpt: pickExcerpt(bookmark),
    minutes: detailedTweetIds.has(bookmark.tweetId)
      ? estimateReadingMinutes(bookmark)
      : null,
    isRead: openedTweetIds.has(bookmark.tweetId),
  };
}

interface NewTabHomeState {
  now: Date;
  imgLoaded: boolean;
  imgError: boolean;
  cardEngaged: boolean;
  mountSeed: number;
  todayQueueIndex: number;
}

type NewTabHomePatch =
  | Partial<NewTabHomeState>
  | ((state: NewTabHomeState) => Partial<NewTabHomeState>);

function createInitialNewTabHomeState(): NewTabHomeState {
  return {
    now: new Date(),
    imgLoaded: false,
    imgError: false,
    cardEngaged: false,
    mountSeed: Math.random(),
    todayQueueIndex: 0,
  };
}

function newTabHomeReducer(
  state: NewTabHomeState,
  patch: NewTabHomePatch,
): NewTabHomeState {
  return {
    ...state,
    ...(typeof patch === "function" ? patch(state) : patch),
  };
}

interface FooterCardProps {
  footerState: FooterState;
  bookmarkCount: number;
  currentItem: DecoratedBookmark | null;
  getBookmarkHref: (bookmark: Bookmark) => string;
  cardBase: string;
  cardCentered: string;
  cardEngaged: boolean;
  onCardEngagedChange: (engaged: boolean) => void;
  recommendationSource: RecommendationSource;
  offlineMode: boolean;
  onOpenBookmark: () => void;
  onOpenReading: (tab?: ReadingTab) => void;
  todayQueueDone: boolean;
  todayQueueCanAddMore: boolean;
  onAddTwoMore: () => void;
  todayQueueProgress: TodayQueueProgress | null;
  syncButton: SyncButtonState;
  onSync: () => void;
  handleLoginButton: () => void;
  onOpenImport: () => void;
  showTodayQueueNavigation: boolean;
  onMovePrev: () => void;
  onMoveNext: () => void;
}

function FooterCard({
  footerState,
  bookmarkCount,
  currentItem,
  getBookmarkHref,
  cardBase,
  cardCentered,
  cardEngaged,
  onCardEngagedChange,
  recommendationSource,
  offlineMode,
  onOpenBookmark,
  onOpenReading,
  todayQueueDone,
  todayQueueCanAddMore,
  onAddTwoMore,
  todayQueueProgress,
  syncButton,
  onSync,
  handleLoginButton,
  onOpenImport,
  showTodayQueueNavigation,
  onMovePrev,
  onMoveNext,
}: FooterCardProps) {
  switch (footerState) {
    case "loading":
      return (
        <article className={cn(cardBase, "flex items-center justify-center")}>
          <TotemLogo loading className="size-10" />
        </article>
      );
    case "connecting":
      return (
        <article className={cardCentered}>
          <p className="text-xs font-semibold uppercase tracking-extra-wide text-accent">
            Connecting to X&hellip;
          </p>
          <div className="mt-4 flex justify-center">
            <TotemLogo loading className="size-10" />
          </div>
          <p className="mt-4 text-pretty text-base text-home-empty">
            Syncing your session in the background.
          </p>
        </article>
      );
    case "need_login":
      return (
        <article className={cardCentered}>
          <p className="text-xs font-semibold uppercase tracking-extra-wide text-accent">
            Log in to start reading
          </p>
          <p className="mt-4 text-pretty text-base text-home-empty">
            Sign in to your X account to sync and read your saved posts.
          </p>
          <Button
            className="mt-6 border-0 bg-home-accent text-white hover:opacity-90"
            onClick={handleLoginButton}
          >
            Log in to X
          </Button>
        </article>
      );
    case "bookmark_card": {
      if (!currentItem) return null;
      const isTodayQueue = recommendationSource === "today";
      const cardAriaLabel = `Read ${currentItem.title} by @${
        currentItem.bookmark.author.screenName
      }${currentItem.minutes !== null ? `, ${currentItem.minutes} min read` : ""}`;
      const handleCardBlurCapture = (
        event: React.FocusEvent<HTMLElement>,
      ) => {
        const nextTarget =
          event.relatedTarget instanceof Node ? event.relatedTarget : null;
        if (!nextTarget || !event.currentTarget.contains(nextTarget)) {
          onCardEngagedChange(false);
        }
      };
      const handleCardClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
        if (
          event.defaultPrevented ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        ) {
          return;
        }
        event.preventDefault();
        onOpenBookmark();
      };
      const handleCardKeyDown = (event: React.KeyboardEvent<HTMLAnchorElement>) => {
        if (event.key === " ") {
          event.preventDefault();
          event.stopPropagation();
          onOpenBookmark();
        }
      };
      const cardBody = (
        <div
          className={cn(
            "flex flex-col translate-y-0 opacity-100 transition-[transform,opacity] duration-200 ease-overlay-in",
            isTodayQueue
              ? "min-h-28 px-4 pt-4 pb-3 max-sm:min-h-24"
              : "min-h-32 max-sm:min-h-28",
          )}
        >
          {isTodayQueue ? (
            <div
              className="flex items-center gap-2"
              aria-label={todayQueueProgress?.ariaLabel}
            >
              <p className="shrink-0 text-xs font-semibold uppercase tracking-extra-wide text-accent">
                today's read
              </p>
              {todayQueueProgress && (
                <>
                  <div className="flex w-16 shrink-0 gap-0.5" aria-hidden="true">
                    {Array.from({ length: todayQueueProgress.totalCount }, (_, i) => (
                      <span
                        key={i}
                        className={cn(
                          "h-0.5 flex-1 rounded-full",
                          i < todayQueueProgress.handledCount && "bg-accent",
                        )}
                        style={
                          i >= todayQueueProgress.handledCount
                            ? {
                                backgroundColor: `var(${
                                  i === todayQueueProgress.handledCount
                                    ? "--color-home-step-current"
                                    : "--color-home-step-upcoming"
                                })`,
                              }
                            : undefined
                        }
                      />
                    ))}
                  </div>
                  <span className="shrink-0 tabular-nums text-xs text-home-fg-muted">
                    {todayQueueProgress.handledCount} of {todayQueueProgress.totalCount}
                  </span>
                </>
              )}
              {offlineMode && (
                <span title="Not signed in — showing cached bookmarks">
                  <LinkBreakIcon className="size-4 animate-offline-pulse text-muted" />
                </span>
              )}
            </div>
          ) : (
            <div className="flex justify-between">
              <div className="flex min-w-0 items-center gap-1.5">
                <p className="text-xs font-semibold uppercase tracking-extra-wide text-accent">
                  {recommendationSource === "pinned" ? "pinned" : "your next read"}
                </p>
                {todayQueueProgress && (
                  <p
                    className="text-xs font-medium tabular-nums text-home-fg-secondary"
                    aria-label={todayQueueProgress.ariaLabel}
                  >
                    <span className="text-home-fg-muted">·</span>{" "}
                    {todayQueueProgress.leftLabel}
                  </p>
                )}
                {offlineMode && (
                  <span title="Not signed in — showing cached bookmarks">
                    <LinkBreakIcon className="size-4 animate-offline-pulse text-muted" />
                  </span>
                )}
              </div>
              <div className="ml-2 flex shrink-0 items-center gap-2">
                <kbd className="hidden border-home-secondary-border bg-accent-tint text-home-fg-muted shadow-kbd sm:inline-flex">
                  Space
                </kbd>
              </div>
            </div>
          )}
          {!isTodayQueue && todayQueueProgress && (
            <TodayQueueProgressIndicator progress={todayQueueProgress} />
          )}
          <div className="mt-4 flex flex-col gap-1">
            <h2
              className={cn(
                "capitalize font-serif line-clamp-2 text-balance font-medium leading-snug text-home-fg-secondary",
                isTodayQueue
                  ? "text-xl max-sm:text-lg lg:text-2xl"
                  : "text-lg max-sm:text-base lg:text-xl",
              )}
            >
              {currentItem.title}
            </h2>
            <p
              className={cn(
                "text-xs text-home-description/80",
                isTodayQueue ? "line-clamp-2" : "line-clamp-1",
              )}
            >
              {currentItem.excerpt}
            </p>
          </div>
          {!isTodayQueue && (
            <div className="mt-auto flex items-center gap-2.5 pt-3">
              <img
                src={currentItem.bookmark.author.profileImageUrl}
                alt={`@${currentItem.bookmark.author.screenName}`}
                className="size-6 shrink-0 rounded-full shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]"
              />
              <div className="min-w-0 flex flex-col gap-1">
                <p className="truncate text-xxs font-medium text-home-fg-secondary">
                  {currentItem.bookmark.author.name}
                </p>
                <p className="truncate text-xxs text-home-fg-muted">
                  @{currentItem.bookmark.author.screenName}
                </p>
              </div>
            </div>
          )}
        </div>
      );
      const todayQueueFooter = isTodayQueue ? (
        <div className="flex items-center justify-between gap-2 border-t border-home-secondary-border bg-black/[0.02] px-4 py-2.5 dark:bg-black/[0.07]">
          <div className="flex min-w-0 items-center gap-2">
            <img
              src={currentItem.bookmark.author.profileImageUrl}
              alt={`@${currentItem.bookmark.author.screenName}`}
              className="size-6 shrink-0 rounded-full shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]"
            />
            <div className="min-w-0">
              <p className="truncate text-xxs font-medium text-home-fg-secondary">
                {currentItem.bookmark.author.name}
              </p>
              <p className="truncate text-xxs text-home-fg-muted">
                {currentItem.minutes !== null
                  ? `${currentItem.minutes} min`
                  : `@${currentItem.bookmark.author.screenName}`}
              </p>
            </div>
          </div>
          <div
            className="flex shrink-0 items-center gap-1"
            role="toolbar"
            aria-label="Queue controls"
          >
            <Button
              type="button"
              variant="secondary"
              className="h-8 bg-home-secondary-bg px-2.5 text-xs font-semibold leading-none text-home-secondary-text shadow-glass transition-colors duration-150 ease-hover hover:bg-main-bg-hover"
              onClick={() => onOpenReading()}
            >
              List
              <kbd className="ml-1.5 hidden border-home-secondary-border bg-accent-tint text-home-fg-muted shadow-kbd sm:inline-flex">
                L
              </kbd>
            </Button>
            {showTodayQueueNavigation && (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="size-8 text-home-fg-muted transition-colors duration-150 ease-hover hover:text-home-fg-secondary"
                  aria-label="Previous Today's Read item"
                  onClick={onMovePrev}
                >
                  <CaretLeftIcon className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="size-8 text-home-fg-muted transition-colors duration-150 ease-hover hover:text-home-fg-secondary"
                  aria-label="Next Today's Read item"
                  onClick={onMoveNext}
                >
                  <CaretRightIcon className="size-3.5" />
                </Button>
              </>
            )}
            <Button
              type="button"
              className="h-8 border-0 bg-home-accent px-3 text-xs font-semibold leading-none text-[#18100d] hover:opacity-90"
              onClick={onOpenBookmark}
            >
              Read
              <kbd className="ml-1.5 hidden border-black/20 bg-black/[0.14] text-black/50 shadow-kbd sm:inline-flex">
                Space
              </kbd>
            </Button>
          </div>
        </div>
      ) : null;
      if (isTodayQueue) {
        return (
          <article
            className={cn(
              cardBase,
              "p-0 hover:bg-main-bg-hover max-sm:p-0",
              cardEngaged && "bg-main-bg-hover",
            )}
            onMouseEnter={() => onCardEngagedChange(true)}
            onMouseLeave={() => onCardEngagedChange(false)}
            onFocusCapture={() => onCardEngagedChange(true)}
            onBlurCapture={handleCardBlurCapture}
          >
            <a
              href={getBookmarkHref(currentItem.bookmark)}
              className="block cursor-pointer no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
              onClick={handleCardClick}
              onKeyDown={handleCardKeyDown}
              aria-label={cardAriaLabel}
            >
              {cardBody}
            </a>
            {todayQueueFooter}
          </article>
        );
      }
      return (
        <a
          href={getBookmarkHref(currentItem.bookmark)}
          className={cn(
            cardBase,
            "block cursor-pointer p-4 no-underline hover:bg-main-bg-hover max-sm:py-3.5",
            cardEngaged && "bg-main-bg-hover",
          )}
          onMouseEnter={() => onCardEngagedChange(true)}
          onMouseLeave={() => onCardEngagedChange(false)}
          onFocusCapture={() => onCardEngagedChange(true)}
          onBlurCapture={handleCardBlurCapture}
          onClick={handleCardClick}
          onKeyDown={handleCardKeyDown}
          aria-label={cardAriaLabel}
        >
          {cardBody}
        </a>
      );
    }
    case "empty_can_sync":
      if (todayQueueDone) {
        return (
          <article className={cardCentered}>
            <h2 className="text-balance text-xl font-medium leading-snug text-home-fg-secondary">
              {TODAY_QUEUE_DONE_TITLE}
            </h2>
            <p className="mt-4 text-pretty text-base text-home-empty">
              {TODAY_QUEUE_DONE_MESSAGE}
            </p>
            {todayQueueCanAddMore ? (
              <Button
                type="button"
                onClick={onAddTwoMore}
                className="mt-6 border border-home-empty/25 bg-transparent text-home-fg-secondary hover:bg-white/5"
              >
                {TODAY_QUEUE_TWO_MORE_LABEL}
              </Button>
            ) : (
              <p className="mt-6 text-sm text-home-empty/80">
                {TODAY_QUEUE_TWO_MORE_EXHAUSTED}
              </p>
            )}
            <Button
              type="button"
              onClick={() => onOpenReading("unread")}
              className="mt-3 border-0 bg-home-accent text-white hover:opacity-90"
            >
              Browse unread
            </Button>
          </article>
        );
      }
      return (
        <>
          <article className={cardCentered}>
            <p className="text-xs font-semibold uppercase tracking-extra-wide text-accent">
              Your reading list is quiet
            </p>
            <p className="mt-4 text-pretty text-base text-home-empty">
              No bookmarks yet. Bookmark posts on X, then sync to start reading.
            </p>
            <Button
              type="button"
              onClick={onSync}
              disabled={syncButton.disabled}
              className="mt-6 border-0 bg-home-accent text-white hover:opacity-90"
            >
              Sync bookmarks
            </Button>
          </article>
          <p className="text-center text-xs text-on-bg-ghost">
            Already have a Totem export?{" "}
            <button
              type="button"
              onClick={onOpenImport}
              className="underline hover:text-on-bg-muted"
            >
              Import &rarr;
            </button>
          </p>
        </>
      );
    case "empty_synced_clean":
      return (
        <article className={cardCentered}>
          <p className="text-xs font-semibold uppercase tracking-extra-wide text-accent">
            No bookmarks on this account
          </p>
          <p className="mt-4 text-pretty text-base text-home-empty">
            Your X account has no bookmarks yet. Save posts on X and they&rsquo;ll appear here.
          </p>
          <Button
            type="button"
            onClick={onSync}
            disabled={syncButton.disabled}
            className="mt-6 border-0 bg-home-accent text-white hover:opacity-90"
          >
            Check again
          </Button>
        </article>
      );
    case "syncing_bootstrap":
      return (
        <article className={cardCentered}>
          <p className="text-xs font-semibold uppercase tracking-extra-wide text-accent">
            Syncing your bookmarks&hellip;
          </p>
          <div className="mt-4 flex justify-center">
            <TotemLogo loading className="size-10" />
          </div>
          <p className="mt-4 text-pretty text-base text-home-empty">
            Fetching bookmarks from your account. This may take a moment.
          </p>
        </article>
      );
    case "sync_error":
      return (
        <article className={cardCentered}>
          <p className="text-xs font-semibold uppercase tracking-extra-wide text-accent">
            Sync is interrupted
          </p>
          <p className="mt-4 text-pretty text-base text-home-empty">
            {bookmarkCount > 0
              ? "Your existing bookmarks are safe and available offline. Try again when X is reachable."
              : "Could not sync your bookmarks. Check your connection and try again."}
          </p>
          <Button
            type="button"
            onClick={onSync}
            disabled={syncButton.disabled}
            className="mt-6 border-0 bg-home-accent text-white hover:opacity-90"
          >
            Try again
          </Button>
        </article>
      );
    case "empty_offline":
      return (
        <article className={cardCentered}>
          <p className="text-xs font-semibold uppercase tracking-extra-wide text-accent">
            Cached reading only
          </p>
          <p className="mt-4 text-pretty text-base text-home-empty">
            Log in to X to sync the rest of your bookmarks and refresh this device.
          </p>
          <Button
            type="button"
            onClick={handleLoginButton}
            className="mt-6 border-0 bg-home-accent text-white hover:opacity-90"
          >
            Log in to X
          </Button>
        </article>
      );
    default:
      return (
        <>
          <article className={cardCentered}>
            <p className="text-xs font-semibold uppercase tracking-extra-wide text-accent">
              Your reading list is quiet
            </p>
            <p className="mt-4 text-pretty text-base text-home-empty">
              No bookmarks yet. Bookmark posts on X, then sync to start reading.
            </p>
            <Button
              type="button"
              onClick={onSync}
              disabled={syncButton.disabled}
              className="mt-6 border-0 bg-home-accent text-white hover:opacity-90"
            >
              Sync bookmarks
            </Button>
          </article>
          <p className="text-center text-xs text-on-bg-ghost">
            Already have a Totem export?{" "}
            <button
              type="button"
              onClick={onOpenImport}
              className="underline hover:text-on-bg-muted"
            >
              Import &rarr;
            </button>
          </p>
        </>
      );
  }
}

function useNewTabHomeModel({
  bookmarks,
  onSync,
  detailedTweetIds,
  showTopSites,
  showSearchBar,
  searchEngine,
  onSearchEngineChange,
  topSitesLimit,
  backgroundMode,
  openedTweetIds,
  onOpenBookmark,
  getBookmarkHref,
  onOpenSettings,
  onOpenImport,
  onOpenExport,
  recommendationSource,
  todayQueue,
  onOpenReading,
  isResetting,
  footerStateOverride,
  syncButtonStateOverride,
  offlineModeOverride,
  onLogin,
}: Props) {
  const [homeState, updateHomeState] = useReducer(
    newTabHomeReducer,
    undefined,
    createInitialNewTabHomeState,
  );
  const {
    now,
    imgLoaded,
    imgError,
    cardEngaged,
    mountSeed,
    todayQueueIndex,
  } = homeState;
  const searchRef = useRef<HTMLInputElement>(null);
  const { wallpaperUrl, wallpaperCredit, gradientCss } =
    useWallpaper(backgroundMode);
  const { sites: topSites } = useTopSites(topSitesLimit, showTopSites);
  const actions = useRuntimeActions();
  const runtimeSyncButton = useSyncButtonState();
  const runtimeOfflineMode = useIsOffline();

  const { items, unreadItems } = useMemo(() => {
    const allItems = bookmarks.map((bookmark) =>
      decorateBookmark(bookmark, detailedTweetIds, openedTweetIds),
    );
    const unread = allItems.filter((item) => !item.isRead);
    return { items: allItems, unreadItems: unread };
  }, [bookmarks, detailedTweetIds, openedTweetIds]);

  const todayQueueItems = useMemo(
    () =>
      (todayQueue?.items ?? []).map((item) =>
        decorateBookmark(item.bookmark, detailedTweetIds, openedTweetIds),
      ),
    [detailedTweetIds, openedTweetIds, todayQueue?.items],
  );

  const currentItem = useMemo(() => {
    if (recommendationSource === "today") {
      return todayQueueItems[todayQueueIndex] ?? todayQueueItems[0] ?? null;
    }

    // When pinned source is selected, pick from pinned bookmarks
    if (recommendationSource === "pinned") {
      const pinnedIds = getPinnedTweetIdsOrdered();
      if (pinnedIds.length > 0) {
        const itemsByTweetId = new Map(
          items.map((item) => [item.bookmark.tweetId, item]),
        );
        const pinnedItems = pinnedIds.flatMap((id) => {
          const item = itemsByTweetId.get(id);
          return item ? [item] : [];
        });
        if (pinnedItems.length > 0) {
          const index = Math.floor(mountSeed * pinnedItems.length);
          return pinnedItems[index];
        }
      }
      // Fall through to random if no pinned items exist
    }

    const pool = unreadItems.length > 0 ? unreadItems : items;
    if (pool.length === 0) return null;
    const index = Math.floor(mountSeed * pool.length);
    return pool[index];
  }, [
    items,
    unreadItems,
    mountSeed,
    recommendationSource,
    todayQueueIndex,
    todayQueueItems,
  ]);
  const hydrationStatus = useHydrationStore((s) => s.status);
  const hydrationTotal = useHydrationStore((s) => s.total);
  const hydrationProcessed = useHydrationStore((s) => s.processed);
  const hydrationPauseUntil = useHydrationStore((s) => s.pauseUntil);

  const todayQueueLoading =
    recommendationSource === "today" && todayQueue?.status === "loading";
  const todayQueueDone =
    recommendationSource === "today" && Boolean(todayQueue?.isDone);
  const todayQueueCanAddMore =
    todayQueueDone && Boolean(todayQueue?.canAddMore);
  const todayQueueProgress =
    recommendationSource === "today" ? getTodayQueueProgress(todayQueue) : null;
  const runtimeFooterState = useFooterState(
    Boolean(currentItem) || todayQueueLoading,
    isResetting,
  );
  const syncButton = syncButtonStateOverride ?? runtimeSyncButton;
  const offlineMode = offlineModeOverride ?? runtimeOfflineMode;
  const footerState =
    footerStateOverride ??
    (todayQueueLoading && !currentItem ? "loading" : runtimeFooterState);
  const openReadingFromHome = useCallback(
    (tab?: ReadingTab) => {
      onOpenReading(
        resolveHomeReadingTab({
          requestedTab: tab,
          recommendationSource,
          todayQueueDone,
        }),
      );
    },
    [onOpenReading, recommendationSource, todayQueueDone],
  );

  const handleAddTwoMore = useCallback(() => {
    void todayQueue?.addTwoMore().catch(() => {});
  }, [todayQueue]);

  const showWallpaper = Boolean(wallpaperUrl && !imgError);

  useEffect(() => {
    updateHomeState({ imgLoaded: false, imgError: false });
  }, [wallpaperUrl]);

  useEffect(() => {
    if (recommendationSource !== "today" || todayQueueItems.length === 0) {
      if (todayQueueIndex !== 0) updateHomeState({ todayQueueIndex: 0 });
      return;
    }

    if (todayQueueIndex >= todayQueueItems.length) {
      updateHomeState({ todayQueueIndex: todayQueueItems.length - 1 });
    }
  }, [recommendationSource, todayQueueIndex, todayQueueItems.length]);

  useEffect(() => {
    const timer = window.setInterval(
      () => updateHomeState({ now: new Date() }),
      CLOCK_UPDATE_MS,
    );
    return () => window.clearInterval(timer);
  }, []);

  const openItem = useCallback(
    (item: DecoratedBookmark | null, recordTodayQueueOpen = true) => {
      if (!item) return;
      if (recordTodayQueueOpen && recommendationSource === "today") {
        const trackedOpen =
          todayQueue?.recordOpen(item.bookmark.tweetId) ?? Promise.resolve();
        void trackedOpen.catch(() => {}).finally(() => {
          onOpenBookmark(item.bookmark);
        });
        return;
      }
      onOpenBookmark(item.bookmark);
    },
    [onOpenBookmark, recommendationSource, todayQueue],
  );

  const surpriseMe = useCallback(() => {
    if (items.length === 0) return;
    const pool = unreadItems.length > 0 ? unreadItems : items;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    openItem(pick, false);
  }, [items, unreadItems, openItem]);

  const moveTodayQueueItem = useCallback(
    (direction: -1 | 1) => {
      if (recommendationSource !== "today" || todayQueueItems.length <= 1) {
        return;
      }

      updateHomeState((state) => ({
        todayQueueIndex:
          (state.todayQueueIndex + direction + todayQueueItems.length) %
          todayQueueItems.length,
        cardEngaged: false,
      }));
    },
    [recommendationSource, todayQueueItems.length],
  );

  useHotkeys("/", () => searchRef.current?.focus(), {
    preventDefault: true,
  });

  useHotkeys(
    "space",
    () => openItem(currentItem ?? null),
    {
      preventDefault: true,
    },
    [currentItem, openItem],
  );

  useHotkeys(
    "l",
    () => openReadingFromHome(),
    {
      preventDefault: true,
    },
    [openReadingFromHome],
  );

  useHotkeys(
    "s",
    () => surpriseMe(),
    {
      preventDefault: true,
    },
    [surpriseMe],
  );

  useHotkeys(
    "left",
    () => moveTodayQueueItem(-1),
    {
      preventDefault: true,
    },
    [moveTodayQueueItem],
  );

  useHotkeys(
    "right",
    () => moveTodayQueueItem(1),
    {
      preventDefault: true,
    },
    [moveTodayQueueItem],
  );

  const showCardButtons = footerState === "bookmark_card";
  const showTodayQueueNavigation =
    recommendationSource === "today" && todayQueueItems.length > 1;

  const cardBase =
    "relative min-h-40 overflow-hidden rounded px-6 py-6 bg-main-bg shadow-glass transition-colors duration-150 ease-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring max-sm:min-h-36 max-sm:px-4 max-sm:py-4";
  const cardCentered = cn(cardBase, "text-center");
  const handleLoginButton = useCallback(() => {
    if (onLogin) {
      onLogin();
      return;
    }
    void actions.startLogin();
  }, [actions, onLogin]);
  const handleLoginHint = useCallback(() => {
    if (onLogin) {
      onLogin();
      return;
    }
    void actions.startLogin();
  }, [actions, onLogin]);
  const handleCancelHydration = useCallback(() => {
    getHydrationStore().getState().stop();
  }, []);

  return {
    bookmarks,
    cardBase,
    cardCentered,
    cardEngaged,
    currentItem,
    detailedTweetIds,
    footerState,
    getBookmarkHref,
    gradientCss,
    handleCancelHydration,
    handleLoginButton,
    handleLoginHint,
    hydrationPauseUntil,
    hydrationProcessed,
    hydrationStatus,
    hydrationTotal,
    imgLoaded,
    now,
    offlineMode,
    openItem,
    onOpenExport,
    onOpenImport,
    onOpenReading: openReadingFromHome,
    onOpenSettings,
    onSearchEngineChange,
    onSync,
    moveTodayQueueItem,
    recommendationSource,
    searchEngine,
    searchRef,
    showCardButtons,
    showSearchBar,
    showWallpaper,
    showTodayQueueNavigation,
    showTopSites,
    surpriseMe,
    syncButton,
    todayQueueDone,
    todayQueueCanAddMore,
    onAddTwoMore: handleAddTwoMore,
    todayQueueProgress,
    topSites,
    updateHomeState,
    wallpaperCredit,
    wallpaperUrl,
  };
}

export function NewTabHome(props: Props) {
  return renderNewTabHome(useNewTabHomeModel(props));
}

function renderNewTabHome({
  bookmarks,
  cardBase,
  cardCentered,
  cardEngaged,
  currentItem,
  detailedTweetIds,
  footerState,
  getBookmarkHref,
  gradientCss,
  handleCancelHydration,
  handleLoginButton,
  handleLoginHint,
  hydrationPauseUntil,
  hydrationProcessed,
  hydrationStatus,
  hydrationTotal,
  imgLoaded,
  moveTodayQueueItem,
  now,
  offlineMode,
  openItem,
  onOpenExport,
  onOpenImport,
  onOpenReading,
  onOpenSettings,
  onSearchEngineChange,
  onSync,
  recommendationSource,
  searchEngine,
  searchRef,
  showCardButtons,
  showSearchBar,
  showWallpaper,
  showTodayQueueNavigation,
  showTopSites,
  surpriseMe,
  syncButton,
  todayQueueDone,
  todayQueueCanAddMore,
  onAddTwoMore,
  todayQueueProgress,
  topSites,
  updateHomeState,
  wallpaperCredit,
  wallpaperUrl,
}: ReturnType<typeof useNewTabHomeModel>) {
  return (
    <div className="totem-home relative flex h-dvh flex-col overflow-hidden bg-surface text-home-fg">
      {!showWallpaper && gradientCss && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: gradientCss }}
        />
      )}
      {showWallpaper && (
        <div className="pointer-events-none absolute inset-0 bg-gray-950" />
      )}
      {showWallpaper && (
        <img
          src={wallpaperUrl ?? ""}
          alt=""
          onLoad={() => updateHomeState({ imgLoaded: true })}
          onError={() => updateHomeState({ imgError: true })}
          className="pointer-events-none absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ease-overlay-in brightness-75"
          style={{ opacity: imgLoaded ? 0.6 : 0 }}
        />
      )}
      <div className="totem-ambient pointer-events-none absolute inset-0" />
      <div className="totem-grain pointer-events-none absolute inset-0" />

      <header className="relative z-20 flex w-full items-center justify-between px-6 pt-5 sm:px-8">
        <TotemLogo className="size-8" />
        <div className="flex items-center gap-2">
          {syncButton.visible && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onSync}
              disabled={syncButton.disabled}
              className="border border-transparent bg-transparent text-on-bg-muted hover:border-white/15 hover:bg-white/5 hover:text-on-bg disabled:cursor-default disabled:opacity-60"
              aria-label="Sync bookmarks"
              title={syncButton.title}
            >
              <span className={cn(syncButton.syncing && "animate-spin")}>
                <ArrowsClockwiseIcon className="size-5" />
              </span>
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={onOpenSettings}
            className="border border-transparent bg-transparent text-on-bg-muted hover:border-white/15 hover:bg-white/5 hover:text-on-bg"
            aria-label="Open settings"
            title="Settings"
          >
            <GearSixIcon className="size-5" />
          </Button>
        </div>
      </header>

      <div className="relative z-10 mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col gap-2 px-5 py-6 sm:px-8">
        <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center">
          <section className="mx-auto w-full max-w-lg space-y-6">
            <div className="text-center">
              <h1
                className="font-serif text-balance text-4xl font-light leading-none tracking-tight text-on-bg tabular-nums sm:text-5xl lg:text-6xl"
                style={{
                  textShadow:
                    "0 1px 8px rgba(0,0,0,0.3), 0 2px 24px rgba(0,0,0,0.15)",
                }}
                aria-label={`Current time: ${formatClock(now)}`}
              >
                {formatClock(now)}
              </h1>
            </div>

            {showSearchBar &&
              (() => {
                const engineConfig =
                  searchEngine !== "default"
                    ? SEARCH_ENGINES[searchEngine]
                    : null;
                const isDefault = searchEngine === "default";

                const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
                  if (!isDefault) return;
                  e.preventDefault();
                  const form = e.currentTarget;
                  const input = form.elements.namedItem(
                    "q",
                  ) as HTMLInputElement;
                  const query = input.value.trim();
                  if (!query) return;
                  if (hasChromeSearch()) {
                    chrome.search.query({
                      text: query,
                      disposition: "NEW_TAB",
                    });
                  } else {
                    window.open(
                      `https://www.google.com/search?q=${encodeURIComponent(query)}`,
                      "_blank",
                    );
                  }
                };

                return (
                  <form
                    className="relative mx-auto flex max-w-xl items-center rounded bg-main-bg shadow-search"
                    action={engineConfig?.searchUrl}
                    method={isDefault ? undefined : "GET"}
                    target={isDefault ? undefined : "_blank"}
                    role="search"
                    onSubmit={handleSubmit}
                  >
                    <span className="flex items-center pl-2">
                      <SearchEnginePicker
                        value={searchEngine}
                        onChange={onSearchEngineChange}
                      />
                    </span>
                    <Input
                      ref={searchRef}
                      type="text"
                      name={engineConfig?.queryParam ?? "q"}
                      className="w-full appearance-none rounded-none border-0 bg-transparent px-3 py-3.5 text-base text-home-fg font-[inherit] outline-none placeholder:text-home-placeholder focus:border-0 focus-visible:outline-none focus-visible:shadow-none"
                      placeholder="Search the web"
                      autoComplete="off"
                    />
                    <span className="pointer-events-none flex items-center pr-4 text-home-fg">
                      <MagnifyingGlassIcon className="size-4 opacity-50" />
                    </span>
                  </form>
                );
              })()}

            {showTopSites && topSites.length > 0 && (
              <nav
                className="flex items-center justify-center gap-4 flex-wrap"
                aria-label="Quick links"
              >
                {topSites.map((site) => (
                  <a
                    key={site.url}
                    href={site.url}
                    className="group flex flex-col items-center gap-1.5 no-underline transition-opacity duration-150 ease-hover"
                    title={site.title}
                  >
                    <span className="flex size-10 items-center justify-center rounded border border-overlay-edge bg-overlay transition-colors duration-150 ease-hover group-hover:border-overlay-hover-edge group-hover:bg-overlay-hover">
                      <img
                        src={site.faviconUrl}
                        alt=""
                        width={20}
                        height={20}
                        loading="lazy"
                        className="rounded"
                      />
                    </span>
                    <span className="max-w-18 overflow-hidden text-ellipsis whitespace-nowrap text-center text-xxs text-on-bg-ghost group-hover:text-on-bg-muted">
                      {site.hostname.replace(/^www\./, "")}
                    </span>
                  </a>
                ))}
              </nav>
            )}
          </section>
        </main>

        <footer className="mx-auto w-full max-w-lg space-y-6 pb-6">
          <FooterCard
            footerState={footerState}
            bookmarkCount={bookmarks.length}
            currentItem={currentItem}
            getBookmarkHref={getBookmarkHref}
            cardBase={cardBase}
            cardCentered={cardCentered}
            cardEngaged={cardEngaged}
            onCardEngagedChange={(engaged) => updateHomeState({ cardEngaged: engaged })}
            recommendationSource={recommendationSource}
            offlineMode={offlineMode}
            onOpenBookmark={() => openItem(currentItem)}
            onOpenReading={onOpenReading}
            todayQueueDone={todayQueueDone}
            todayQueueCanAddMore={todayQueueCanAddMore}
            onAddTwoMore={onAddTwoMore}
            todayQueueProgress={todayQueueProgress}
            syncButton={syncButton}
            onSync={onSync}
            handleLoginButton={handleLoginButton}
            onOpenImport={onOpenImport}
            showTodayQueueNavigation={showTodayQueueNavigation}
            onMovePrev={() => moveTodayQueueItem(-1)}
            onMoveNext={() => moveTodayQueueItem(1)}
          />

          {recommendationSource !== "today" && (
            <div
              className={cn(
                "flex items-center justify-between gap-2.5 max-sm:flex-wrap max-sm:justify-center max-sm:gap-2",
                !showCardButtons && "invisible pointer-events-none",
              )}
              aria-hidden={!showCardButtons || undefined}
            >
              <Button
                variant="secondary"
                className="bg-home-secondary-bg px-5 py-2.5 font-semibold leading-none text-home-secondary-text shadow-glass transition-colors duration-150 ease-hover hover:bg-main-bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring max-sm:px-3"
                onClick={() => onOpenReading()}
              >
                Open reading list
                <kbd className="ml-2 hidden border-home-secondary-border bg-accent-tint text-home-fg-muted shadow-kbd sm:inline-flex">
                  L
                </kbd>
              </Button>
              {showTodayQueueNavigation && (
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon-sm"
                    onClick={() => moveTodayQueueItem(-1)}
                    className="size-10 bg-home-secondary-bg text-home-secondary-text shadow-glass transition-colors duration-150 ease-hover hover:bg-main-bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring max-sm:size-9"
                    aria-label="Previous Today's Read item"
                    title="Previous Today's Read item"
                  >
                    <CaretLeftIcon className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon-sm"
                    onClick={() => moveTodayQueueItem(1)}
                    className="size-10 bg-home-secondary-bg text-home-secondary-text shadow-glass transition-colors duration-150 ease-hover hover:bg-main-bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring max-sm:size-9"
                    aria-label="Next Today's Read item"
                    title="Next Today's Read item"
                  >
                    <CaretRightIcon className="size-4" />
                  </Button>
                </div>
              )}
              <Button
                variant="secondary"
                className="bg-home-secondary-bg px-5 py-2.5 font-semibold leading-none text-home-secondary-text shadow-glass transition-colors duration-150 ease-hover hover:bg-main-bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring max-sm:px-3"
                onClick={surpriseMe}
              >
                Surprise me
                <kbd className="ml-2 hidden border-home-secondary-border bg-accent-tint text-home-fg-muted shadow-kbd sm:inline-flex">
                  S
                </kbd>
              </Button>
            </div>
          )}

          <p
            className={cn(
              "text-center text-xs text-on-bg-ghost",
              (!offlineMode || !showCardButtons) && "invisible",
            )}
          >
            Offline mode.{" "}
            <a
              href="https://x.com/i/bookmarks"
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleLoginHint}
              className="underline hover:text-muted"
            >
              Log in
            </a>{" "}
            to see all your bookmarks.
          </p>
        </footer>

        {showWallpaper && wallpaperCredit && (
          <p className="fixed bottom-6 left-6 z-20 text-xs text-on-bg-ghost">
            Photo by{" "}
            <a
              href={wallpaperCredit.url}
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-on-bg-muted"
            >
              {wallpaperCredit.name}
            </a>
          </p>
        )}

        <div className="fixed right-5 bottom-5 z-20 flex items-center gap-2 sm:right-6 sm:bottom-6">
          <HydrationFloatingStatus
            status={hydrationStatus}
            total={hydrationTotal}
            processed={hydrationProcessed}
            bookmarkCount={bookmarks.length}
            readyCount={detailedTweetIds.size}
            pauseUntil={hydrationPauseUntil}
            onOpenExport={onOpenExport}
            onCancel={handleCancelHydration}
            onLogin={handleLoginButton}
          />
          <Popover.Root>
            <Popover.Trigger
              type="button"
              className="flex size-11 items-center justify-center text-on-bg-ghost transition-colors duration-150 ease-hover hover:text-on-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
              aria-label="Support"
              title="Support"
            >
              <InfoIcon className="size-4" />
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Positioner
                side="top"
                align="end"
                sideOffset={10}
                positionMethod="fixed"
                className="z-30"
              >
                <PopoverContent className="w-44 p-1.5 backdrop-blur-md">
                  <p className="px-3 py-2 text-xs font-semibold uppercase tracking-extra-wide text-muted">
                    Support
                  </p>
                  <a
                    href={SUPPORT_EMAIL_URL}
                    className="flex min-h-10 items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover:bg-surface-hover"
                  >
                    <EnvelopeSimpleIcon className="size-4 text-muted" />
                    <span>Email</span>
                  </a>
                  <a
                    href={SUPPORT_X_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-h-10 items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover:bg-surface-hover"
                  >
                    <XLogoIcon className="size-4 text-muted" />
                    <span>{SUPPORT_X_HANDLE}</span>
                  </a>
                </PopoverContent>
              </Popover.Positioner>
            </Popover.Portal>
          </Popover.Root>
        </div>
      </div>
    </div>
  );
}

function formatFooterDuration(ms: number): string {
  const totalMinutes = Math.ceil(ms / 60_000);
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

function HydrationFloatingStatus({
  status,
  total,
  processed,
  bookmarkCount,
  readyCount,
  pauseUntil,
  onOpenExport,
  onCancel,
  onLogin,
}: {
  status: HydrationStatus;
  total: number;
  processed: number;
  bookmarkCount: number;
  readyCount: number;
  pauseUntil: number;
  onOpenExport: () => void;
  onCancel: () => void;
  onLogin: () => void;
}) {
  const [dismissedReadySignature, setDismissedReadySignature] = useState(
    readFullExportReadyDismissal,
  );

  if (status === "idle") return null;

  const progress = getHydrationProgress({
    bookmarkCount,
    readyCount,
    queueTotal: total,
    processed,
  });

  if (status === "done") {
    if (!isFullExportReadyForCurrentLibrary({ bookmarkCount, readyCount })) {
      return null;
    }

    const readySignature = getFullExportReadyDismissalSignature({
      bookmarkCount,
      readyCount,
    });
    if (dismissedReadySignature === readySignature) return null;

    const handleDismissReady = () => {
      writeFullExportReadyDismissal(readySignature);
      setDismissedReadySignature(readySignature);
    };

    return (
      <div className="flex min-h-11 items-center gap-2 rounded border border-overlay-edge bg-overlay px-3 py-2 text-xs text-on-bg shadow-glass backdrop-blur-md">
        <span className="tabular-nums">Full export ready</span>
        <button
          type="button"
          onClick={onOpenExport}
          className="font-medium text-accent hover:text-accent/80"
        >
          Download
        </button>
        <button
          type="button"
          onClick={handleDismissReady}
          className="-mr-1 flex size-7 items-center justify-center rounded text-on-bg-ghost transition-colors hover:bg-white/10 hover:text-on-bg"
          aria-label="Hide full export ready"
          title="Hide full export ready"
        >
          <XIcon className="size-4" />
        </button>
      </div>
    );
  }

  if (status === "paused-auth") {
    return (
      <div className="flex min-h-11 items-center gap-2 rounded border border-overlay-edge bg-overlay px-3 py-2 text-xs text-on-bg shadow-glass backdrop-blur-md">
        <span>Full export paused</span>
        <button
          type="button"
          onClick={onLogin}
          className="font-medium text-accent hover:text-accent/80"
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="-mr-1 flex size-7 items-center justify-center rounded text-on-bg-ghost transition-colors hover:bg-white/10 hover:text-on-bg"
          aria-label="Cancel full export"
          title="Cancel full export"
        >
          <XIcon className="size-4" />
        </button>
      </div>
    );
  }

  if (status === "paused-storage") {
    return (
      <div className="flex min-h-11 items-center gap-2 rounded border border-overlay-edge bg-overlay px-3 py-2 text-xs text-on-bg shadow-glass backdrop-blur-md">
        <button
          type="button"
          onClick={onOpenExport}
          className="text-left hover:text-on-bg-muted"
        >
          Full export paused: out of storage
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="-mr-1 flex size-7 items-center justify-center rounded text-on-bg-ghost transition-colors hover:bg-white/10 hover:text-on-bg"
          aria-label="Cancel full export"
          title="Cancel full export"
        >
          <XIcon className="size-4" />
        </button>
      </div>
    );
  }

  const resumeMs = pauseUntil > Date.now() ? pauseUntil - Date.now() : 0;
  const statusText = status === "paused-429" && resumeMs > 0
    ? `Resumes in ${formatFooterDuration(resumeMs)}`
    : "Preparing export";

  return (
    <div className="flex min-h-11 items-center gap-3 rounded border border-overlay-edge bg-overlay px-3 py-2 text-xs text-on-bg shadow-glass backdrop-blur-md">
      <button
        type="button"
        onClick={onOpenExport}
        className="min-w-0 text-left"
        title="Open export progress"
      >
        <span className="block max-w-36 truncate text-on-bg-ghost">
          {statusText}
        </span>
        <span className="block tabular-nums">
          {progress.done.toLocaleString("en-US")} / {progress.total.toLocaleString("en-US")}
        </span>
      </button>
      <div className="h-1 w-16 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-300 ease-out"
          style={{ width: `${Math.min(100, Math.max(0, progress.pct))}%` }}
        />
      </div>
      <button
        type="button"
        onClick={onCancel}
        className="-mr-1 flex size-7 items-center justify-center rounded text-on-bg-ghost transition-colors hover:bg-white/10 hover:text-on-bg"
        aria-label="Cancel full export"
        title="Cancel full export"
      >
        <XIcon className="size-4" />
      </button>
    </div>
  );
}
