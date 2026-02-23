import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { GearSixIcon, MagnifyingGlassIcon } from "@phosphor-icons/react";
import { TotemLogo } from "./TotemLogo";
import type { BackgroundMode, Bookmark, SyncState } from "../types";
import { formatClock } from "../lib/time";
import {
  pickTitle,
  pickExcerpt,
  estimateReadingMinutes,
} from "../lib/bookmark-utils";
import { cn } from "../lib/cn";
import { useWallpaper } from "../hooks/useWallpaper";
import { useTopSites } from "../hooks/useTopSites";
import { useProductTour } from "../hooks/useProductTour";
import { CLOCK_UPDATE_MS } from "../lib/constants";

interface Props {
  bookmarks: Bookmark[];
  syncState: SyncState;
  onSync: () => void;
  detailedTweetIds: Set<string>;
  showTopSites: boolean;
  showSearchBar: boolean;
  topSitesLimit: number;
  backgroundMode: BackgroundMode;
  openedTweetIds: Set<string>;
  onOpenBookmark: (bookmark: Bookmark) => void;
  onOpenSettings: () => void;
  onOpenReading: () => void;
}

interface DecoratedBookmark {
  bookmark: Bookmark;
  title: string;
  excerpt: string;
  minutes: number | null;
  isRead: boolean;
}

const SETTINGS_ICON = <GearSixIcon className="size-5" />;

const SEARCH_ICON = <MagnifyingGlassIcon className="size-4 opacity-50" />;

const GOOGLE_LOGO = (
  <svg
    viewBox="0 0 24 24"
    className="size-5 shrink-0"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
      fill="#4285F4"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      fill="#FBBC05"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      fill="#EA4335"
    />
  </svg>
);

export function NewTabHome({
  bookmarks,
  syncState,
  onSync,
  detailedTweetIds,
  showTopSites,
  showSearchBar,
  topSitesLimit,
  backgroundMode,
  openedTweetIds,
  onOpenBookmark,
  onOpenSettings,
  onOpenReading,
}: Props) {
  const [now, setNow] = useState(() => new Date());
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [cardEngaged, setCardEngaged] = useState(false);
  const [mountSeed] = useState(() => Math.random());
  const searchRef = useRef<HTMLInputElement>(null);
  const { wallpaperUrl, wallpaperCredit, gradientCss, curatorHud } =
    useWallpaper(backgroundMode);
  const { sites: topSites } = useTopSites(topSitesLimit, showTopSites);

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

  useProductTour({
    enabled: true,
    hasBookmarks: currentItem !== null,
  });

  const [prevWallpaperUrl, setPrevWallpaperUrl] = useState(wallpaperUrl);
  if (wallpaperUrl !== prevWallpaperUrl) {
    setPrevWallpaperUrl(wallpaperUrl);
    setImgLoaded(false);
    setImgError(false);
  }

  const showWallpaper = Boolean(wallpaperUrl && !imgError);

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
    "enter, o",
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

  return (
    <div className="breath-home relative flex h-dvh flex-col overflow-hidden">
      {!showWallpaper && gradientCss && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: gradientCss }}
        />
      )}
      {showWallpaper && (
        <img
          src={wallpaperUrl ?? ""}
          alt=""
          onLoad={() => setImgLoaded(true)}
          onError={() => setImgError(true)}
          className="breath-wallpaper pointer-events-none absolute inset-0 h-full w-full object-cover"
          style={{ opacity: imgLoaded ? 0.6 : 0 }}
        />
      )}
      <div className="breath-ambient pointer-events-none absolute inset-0" />
      <div className="breath-grain pointer-events-none absolute inset-0" />

      <header className="relative z-20 flex w-full items-center justify-between px-6 pt-5 sm:px-8">
        <TotemLogo className="size-8" />
        <button
          data-tour="settings-btn"
          type="button"
          onClick={onOpenSettings}
          className="breath-icon-btn"
          aria-label="Open settings"
          title="Settings"
        >
          {SETTINGS_ICON}
        </button>
      </header>

      <div className="relative z-10 mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col px-5 py-6 sm:px-8">
        <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center">
          <section className="mx-auto w-full max-w-lg space-y-6">
            <div className="text-center">
              <h1
                className="breath-clock text-balance tabular-nums"
                aria-label={`Current time: ${formatClock(now)}`}
              >
                {formatClock(now)}
              </h1>
            </div>

            {showSearchBar && (
              <form
                className="breath-search"
                action="https://www.google.com/search"
                method="GET"
                role="search"
              >
                <span className="breath-search-logo">{GOOGLE_LOGO}</span>
                <input
                  ref={searchRef}
                  type="text"
                  name="q"
                  className="breath-search-input"
                  placeholder="Search the web"
                  autoComplete="off"
                />
                <span className="breath-search-trail">{SEARCH_ICON}</span>
              </form>
            )}

            {showTopSites && topSites.length > 0 && (
              <nav
                className="flex items-center justify-center gap-4 flex-wrap"
                aria-label="Quick links"
              >
                {topSites.map((site) => (
                  <a
                    key={site.url}
                    href={site.url}
                    className="breath-quick-link"
                    title={site.title}
                  >
                    <span className="breath-quick-link-icon">
                      <img
                        src={site.faviconUrl}
                        alt=""
                        width={20}
                        height={20}
                        loading="lazy"
                      />
                    </span>
                    <span className="breath-quick-link-label">
                      {site.hostname.replace(/^www\./, "")}
                    </span>
                  </a>
                ))}
              </nav>
            )}
          </section>
        </main>

        <footer className="mx-auto w-full max-w-lg pb-12">
          {currentItem ? (
            <div className="space-y-4">
              <article
                data-tour="bookmark-card"
                className={cn(
                  "breath-card breath-card--zen",
                  cardEngaged && "is-engaged",
                )}
                onMouseEnter={() => setCardEngaged(true)}
                onMouseLeave={() => setCardEngaged(false)}
                onFocusCapture={() => setCardEngaged(true)}
                onBlurCapture={(event) => {
                  const nextTarget =
                    event.relatedTarget instanceof Node
                      ? event.relatedTarget
                      : null;
                  if (
                    !nextTarget ||
                    !event.currentTarget.contains(nextTarget)
                  ) {
                    setCardEngaged(false);
                  }
                }}
                onClick={() => openItem(currentItem)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    event.stopPropagation();
                    openItem(currentItem);
                  }
                }}
                tabIndex={0}
                role="button"
                aria-label={`Read ${currentItem.title} by @${
                  currentItem.bookmark.author.screenName
                }${
                  currentItem.minutes !== null
                    ? `, ${currentItem.minutes} min read`
                    : ""
                }`}
              >
                <div className="breath-card-content">
                  <div className="flex justify-between">
                    <p className="breath-eyebrow uppercase">recommended</p>
                    <kbd className="breath-kbd">O</kbd>
                  </div>

                  <h2 className="breath-title mt-4 text-balance">
                    {currentItem.title}
                  </h2>
                  <p className="breath-description mt-2.5 text-pretty">
                    {currentItem.excerpt}
                  </p>
                  <div className="mt-3 flex items-end justify-between gap-3">
                    <p className="breath-meta">
                      @{currentItem.bookmark.author.screenName}
                    </p>
                  </div>
                </div>
              </article>

              <div className="breath-actions">
                <button
                  data-tour="open-all-btn"
                  type="button"
                  className="breath-btn breath-btn--secondary"
                  onClick={onOpenReading}
                >
                  Open all bookmarks
                  <kbd className="breath-kbd">L</kbd>
                </button>
                <button
                  data-tour="surprise-btn"
                  type="button"
                  className="breath-btn breath-btn--secondary"
                  onClick={surpriseMe}
                >
                  Surprise me
                  <kbd className="breath-kbd">S</kbd>
                </button>
              </div>
            </div>
          ) : syncState.phase === "syncing" ? (
            <article className="breath-card text-center">
              <p className="breath-eyebrow">Syncing your bookmarks&hellip;</p>
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
              <p className="breath-empty mt-4 text-pretty">
                Fetching bookmarks from your account. This may take a moment.
              </p>
            </article>
          ) : syncState.phase === "error" ? (
            <article className="breath-card text-center">
              <p className="breath-eyebrow">Something went wrong</p>
              <p className="breath-empty mt-4 text-pretty">
                {syncState.error === "reconnecting"
                  ? "Reconnecting to your account\u2026"
                  : "Could not sync your bookmarks. Check your connection and try again."}
              </p>
              {syncState.error !== "reconnecting" && (
                <button
                  type="button"
                  onClick={onSync}
                  className="breath-btn breath-btn--primary mt-6"
                >
                  Try again
                </button>
              )}
            </article>
          ) : (
            <article className="breath-card text-center">
              <p className="breath-eyebrow">Your reading list is quiet</p>
              <p className="breath-empty mt-4 text-pretty">
                No bookmarks found. Bookmark some posts on X, then sync to see
                them here.
              </p>
              <button
                type="button"
                onClick={onSync}
                className="breath-btn breath-btn--primary mt-6"
              >
                Sync bookmarks
              </button>
            </article>
          )}
        </footer>

        {showWallpaper && wallpaperCredit && (
          <p className="fixed bottom-6 left-6 z-20 text-xs text-gray-500">
            Photo by{" "}
            <a
              href={wallpaperCredit.url}
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-gray-400"
            >
              {wallpaperCredit.name}
            </a>
          </p>
        )}
        {curatorHud && (
          <div className="fixed bottom-6 right-6 z-20 flex items-center gap-2 rounded-xl bg-black/60 px-3 py-2 text-xs text-white backdrop-blur-xl">
            {curatorHud.justSelected && <span className="font-medium text-green-400">Selected!</span>}
            {curatorHud.loading && <span className="text-white/60">Loading…</span>}
            <span className="tabular-nums font-medium">
              {curatorHud.count}/{curatorHud.total}
            </span>
            {curatorHud.rateRemaining !== null && (
              <span className="tabular-nums text-white/40">{curatorHud.rateRemaining} req</span>
            )}
            <span className="text-white/30">|</span>
            <kbd className="rounded-md border border-white/20 bg-white/10 px-1 py-0.5 font-mono text-white/70">Space</kbd>
            <span className="text-white/40">Next</span>
            <kbd className="rounded-md border border-white/20 bg-white/10 px-1 py-0.5 font-mono text-white/70">Y</kbd>
            <span className="text-white/40">Pick</span>
            <kbd className="rounded-md border border-white/20 bg-white/10 px-1 py-0.5 font-mono text-white/70">E</kbd>
            <span className="text-white/40">Export</span>
          </div>
        )}
      </div>
    </div>
  );
}
