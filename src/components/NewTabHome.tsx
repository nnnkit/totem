import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import {
  ArrowsClockwiseIcon,
  EnvelopeSimpleIcon,
  GearSixIcon,
  InfoIcon,
  LinkBreakIcon,
  MagnifyingGlassIcon,
  XLogoIcon,
} from "@phosphor-icons/react";
import { TotemLogo } from "./TotemLogo";
import { SearchEnginePicker } from "./SearchEnginePicker";
import type { BackgroundMode, Bookmark, SearchEngineId } from "../types";
import { SEARCH_ENGINES } from "../lib/search-engines";
import { hasChromeSearch } from "../lib/chrome";
import { formatClock } from "../lib/time";
import {
  pickTitle,
  pickExcerpt,
  estimateReadingMinutes,
} from "../lib/bookmark-utils";
import { cn } from "../lib/cn";
import { Button } from "./ui/Button";
import {
  SUPPORT_EMAIL_URL,
  SUPPORT_X_HANDLE,
  SUPPORT_X_URL,
} from "../lib/constants/support";
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

import { CLOCK_UPDATE_MS } from "../lib/constants";

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
  onOpenReading: () => void;
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

export function NewTabHome({
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
  onOpenReading,
  isResetting,
  footerStateOverride,
  syncButtonStateOverride,
  offlineModeOverride,
  onLogin,
}: Props) {
  const [now, setNow] = useState(() => new Date());
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [cardEngaged, setCardEngaged] = useState(false);
  const [mountSeed] = useState(() => Math.random());
  const searchRef = useRef<HTMLInputElement>(null);
  const prevWallpaperUrlRef = useRef<string | null>(null);
  const { wallpaperUrl, wallpaperCredit, gradientCss } =
    useWallpaper(backgroundMode);
  const { sites: topSites } = useTopSites(topSitesLimit, showTopSites);
  const actions = useRuntimeActions();
  const runtimeSyncButton = useSyncButtonState();
  const runtimeOfflineMode = useIsOffline();

  const { items, unreadItems } = useMemo(() => {
    const allItems: DecoratedBookmark[] = bookmarks.map((bookmark) => ({
      bookmark,
      title: pickTitle(bookmark),
      excerpt: pickExcerpt(bookmark),
      minutes: detailedTweetIds.has(bookmark.tweetId)
        ? estimateReadingMinutes(bookmark)
        : null,
      isRead: openedTweetIds.has(bookmark.tweetId),
    }));
    const unread = allItems.filter((item) => !item.isRead);
    return { items: allItems, unreadItems: unread };
  }, [bookmarks, detailedTweetIds, openedTweetIds]);

  const currentItem = useMemo(() => {
    const pool = unreadItems.length > 0 ? unreadItems : items;
    if (pool.length === 0) return null;
    const index = Math.floor(mountSeed * pool.length);
    return pool[index];
  }, [items, unreadItems, mountSeed]);
  const runtimeFooterState = useFooterState(Boolean(currentItem), isResetting);
  const syncButton = syncButtonStateOverride ?? runtimeSyncButton;
  const offlineMode = offlineModeOverride ?? runtimeOfflineMode;
  const footerState = footerStateOverride ?? runtimeFooterState;

  const showWallpaper = Boolean(wallpaperUrl && !imgError);

  useEffect(() => {
    if (prevWallpaperUrlRef.current === wallpaperUrl) return;
    prevWallpaperUrlRef.current = wallpaperUrl;
    setImgLoaded(false);
    setImgError(false);
  }, [wallpaperUrl]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), CLOCK_UPDATE_MS);
    return () => window.clearInterval(timer);
  }, []);

  const openItem = useCallback(
    (item: DecoratedBookmark | null) => {
      if (!item) return;
      onOpenBookmark(item.bookmark);
    },
    [onOpenBookmark],
  );

  const surpriseMe = useCallback(() => {
    if (items.length === 0) return;
    const pool = unreadItems.length > 0 ? unreadItems : items;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    openItem(pick);
  }, [items, unreadItems, openItem]);

  useHotkeys("/", () => searchRef.current?.focus(), {
    preventDefault: true,
  });

  useHotkeys(
    "space",
    () => openItem(currentItem),
    {
      preventDefault: true,
    },
    [currentItem, openItem],
  );

  useHotkeys(
    "l",
    () => onOpenReading(),
    {
      preventDefault: true,
    },
    [onOpenReading],
  );

  useHotkeys(
    "s",
    () => surpriseMe(),
    {
      preventDefault: true,
    },
    [surpriseMe],
  );

  const showCardButtons = footerState === "bookmark_card";

  const cardBase =
    "relative min-h-40 overflow-hidden rounded px-6 py-6 bg-main-bg shadow-glass backdrop-blur-lg transition-colors duration-150 ease-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-400/80 max-sm:min-h-36 max-sm:px-4 max-sm:py-4";
  const cardCentered = cn(cardBase, "text-center");
  const handleLoginButton = useCallback(() => {
    if (onLogin) {
      onLogin();
      return;
    }
    window.open("https://x.com/i/bookmarks", "_blank", "noopener,noreferrer");
    void actions.startLogin();
  }, [actions, onLogin]);
  const handleLoginHint = useCallback(() => {
    if (onLogin) {
      onLogin();
      return;
    }
    void actions.startLogin();
  }, [actions, onLogin]);

  const renderFooterCard = () => {
    switch (footerState) {
      case "loading":
        return (
          <article className={cn(cardBase, "flex items-center justify-center")}>
            <div className="animate-logo-shine">
              <TotemLogo className="size-10" />
            </div>
          </article>
        );
      case "connecting":
        return (
          <article className={cardCentered}>
            <p className="text-xs font-semibold uppercase tracking-extra-wide text-accent">
              Connecting to X&hellip;
            </p>
            <div className="mt-4 flex justify-center">
              <svg
                viewBox="0 0 24 24"
                className="size-6 animate-spin text-accent"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
              </svg>
            </div>
            <p className="mt-4 text-pretty text-base text-home-empty">
              Syncing your session in the background.
            </p>
          </article>
        );
      case "preparing_sync":
        return (
          <article className={cardCentered}>
            <p className="text-xs font-semibold uppercase tracking-extra-wide text-accent">
              Finishing X setup
            </p>
            <p className="mt-4 text-pretty text-base text-home-empty">
              We found your account, but bookmark sync is not ready yet. Open X
              once to finish connecting bookmarks.
            </p>
            <Button
              className="mt-6 border-0 bg-home-accent text-white hover:opacity-90"
              onClick={handleLoginButton}
            >
              Open X
            </Button>
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
      case "bookmark_card":
        if (!currentItem) return null;
        return (
          <a
            href={getBookmarkHref(currentItem.bookmark)}
            className={cn(
              cardBase,
              "block cursor-pointer p-4 no-underline hover:bg-main-bg-hover max-sm:py-3.5",
              cardEngaged && "bg-main-bg-hover",
            )}
            onMouseEnter={() => setCardEngaged(true)}
            onMouseLeave={() => setCardEngaged(false)}
            onFocusCapture={() => setCardEngaged(true)}
            onBlurCapture={(event) => {
              const nextTarget =
                event.relatedTarget instanceof Node
                  ? event.relatedTarget
                  : null;
              if (!nextTarget || !event.currentTarget.contains(nextTarget)) {
                setCardEngaged(false);
              }
            }}
            onKeyDown={(event) => {
              if (event.key === " ") {
                event.preventDefault();
                event.stopPropagation();
                onOpenBookmark(currentItem.bookmark);
              }
            }}
            aria-label={`Read ${currentItem.title} by @${
              currentItem.bookmark.author.screenName
            }${
              currentItem.minutes !== null
                ? `, ${currentItem.minutes} min read`
                : ""
            }`}
          >
            <div className="flex min-h-32 flex-col translate-y-0 opacity-100 transition-all duration-200 ease-overlay-in max-sm:min-h-28">
              <div className="flex justify-between">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-semibold uppercase tracking-extra-wide text-accent">
                    your next read
                  </p>
                  {offlineMode && (
                    <span title="Not signed in — showing cached bookmarks">
                      <LinkBreakIcon className="size-4 animate-offline-pulse text-muted" />
                    </span>
                  )}
                </div>
                <kbd className="ml-2 border-home-secondary-border bg-accent-tint text-home-fg-muted shadow-kbd">
                  Space
                </kbd>
              </div>
              <div className="mt-4 flex flex-col gap-1">
                <h2 className="capitalize font-serif line-clamp-2 text-balance text-lg font-medium leading-snug text-home-fg-secondary max-sm:text-base lg:text-xl">
                  {currentItem.title}
                </h2>
                <p className="line-clamp-1 text-xs text-home-description/80">
                  {currentItem.excerpt}
                </p>
              </div>
              <div className="mt-auto flex items-center gap-2.5 pt-3">
                <img
                  src={currentItem.bookmark.author.profileImageUrl}
                  alt=""
                  className="size-6 shrink-0 rounded-full"
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
            </div>
          </a>
        );
      case "syncing_bootstrap":
        return (
          <article className={cardCentered}>
            <p className="text-xs font-semibold uppercase tracking-extra-wide text-accent">
              Syncing your bookmarks&hellip;
            </p>
            <div className="mt-4 flex justify-center">
              <svg
                viewBox="0 0 24 24"
                className="size-6 animate-spin text-accent"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
              </svg>
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
              Something went wrong
            </p>
            <p className="mt-4 text-pretty text-base text-home-empty">
              Could not sync your bookmarks. Check your connection and try
              again.
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
              Log in to X to sync the rest of your bookmarks and refresh this
              device.
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
      case "empty_can_sync":
      default:
        return (
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
        );
    }
  };

  return (
    <div className="totem-home relative flex h-dvh flex-col overflow-hidden bg-surface text-home-fg">
      {!showWallpaper && gradientCss && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: gradientCss }}
        />
      )}
      {showWallpaper && (
        <div className="pointer-events-none absolute inset-0 bg-black" />
      )}
      {showWallpaper && (
        <img
          src={wallpaperUrl ?? ""}
          alt=""
          onLoad={() => setImgLoaded(true)}
          onError={() => setImgError(true)}
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
          <button
            type="button"
            onClick={onOpenSettings}
            className="rounded border border-transparent bg-transparent p-2 text-on-bg-muted transition-colors duration-150 ease-hover hover:border-white/15 hover:bg-white/5 hover:text-on-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-400/80"
            aria-label="Open settings"
            title="Settings"
          >
            <GearSixIcon className="size-5" />
          </button>
        </div>
      </header>

      <div className="relative z-10 mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col gap-2 px-5 py-6 sm:px-8">
        <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center">
          <section className="mx-auto w-full max-w-lg space-y-6">
            <div className="text-center">
              <h1
                className="font-serif text-balance text-4xl font-light leading-none tracking-tight text-on-bg tabular-nums sm:text-5xl lg:text-6xl"
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
                    className="relative mx-auto flex max-w-xl items-center rounded bg-main-bg shadow-search backdrop-blur-md"
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
                    <input
                      ref={searchRef}
                      type="text"
                      name={engineConfig?.queryParam ?? "q"}
                      className="w-full appearance-none border-0 bg-transparent px-3 py-3.5 text-base text-home-fg [font-family:inherit] outline-none placeholder:text-home-placeholder"
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
          {renderFooterCard()}

          <div
            className={cn(
              "flex items-center justify-between gap-2.5 max-sm:gap-2",
              !showCardButtons && "invisible pointer-events-none",
            )}
            aria-hidden={!showCardButtons || undefined}
          >
            <Button
              variant="secondary"
              className="bg-home-secondary-bg px-5 py-2.5 font-semibold leading-none text-home-secondary-text transition-all duration-150 ease-hover hover:bg-main-bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-400/80"
              onClick={onOpenReading}
            >
              Open reading list
              <kbd className="ml-2 border-home-secondary-border bg-accent-tint text-home-fg-muted shadow-kbd">
                L
              </kbd>
            </Button>
            <Button
              variant="secondary"
              className="bg-home-secondary-bg px-5 py-2.5 font-semibold leading-none text-home-secondary-text transition-all duration-150 ease-hover hover:bg-main-bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-400/80"
              onClick={surpriseMe}
            >
              Surprise me
              <kbd className="ml-2 border-home-secondary-border bg-accent-tint text-home-fg-muted shadow-kbd">
                S
              </kbd>
            </Button>
          </div>

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

        <div className="fixed right-5 bottom-5 z-20 sm:right-6 sm:bottom-6">
          <Popover.Root>
            <Popover.Trigger
              type="button"
              className="flex size-11 items-center justify-center text-on-bg-ghost transition-colors duration-150 ease-hover hover:text-on-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-400/80"
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
