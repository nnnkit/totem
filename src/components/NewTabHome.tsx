import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import {
  GearSixIcon,
  MagnifyingGlassIcon,
  WifiSlashIcon,
} from "@phosphor-icons/react";
import { TotemLogo } from "./TotemLogo";
import { SearchEnginePicker } from "./SearchEnginePicker";
import type { AuthPhase } from "../hooks/useAuth";
import type {
  BackgroundMode,
  Bookmark,
  SearchEngineId,
  SyncState,
} from "../types";
import { SEARCH_ENGINES } from "../lib/search-engines";
import { hasChromeSearch } from "../lib/chrome";
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
  searchEngine: SearchEngineId;
  onSearchEngineChange: (engine: SearchEngineId) => void;
  topSitesLimit: number;
  backgroundMode: BackgroundMode;
  openedTweetIds: Set<string>;
  onOpenBookmark: (bookmark: Bookmark) => void;
  onOpenSettings: () => void;
  onOpenReading: () => void;
  offlineMode?: boolean;
  authPhase?: AuthPhase;
  onLogin?: () => Promise<void>;
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

export function NewTabHome({
  bookmarks,
  syncState,
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
  onOpenSettings,
  onOpenReading,
  offlineMode,
  authPhase,
  onLogin,
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

  const { dismiss: dismissTour } = useProductTour({
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
      dismissTour();
      onOpenBookmark(item.bookmark);
    },
    [onOpenBookmark, dismissTour],
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
    () => {
      dismissTour();
      onOpenReading();
    },
    {
      preventDefault: true,
    },
    [onOpenReading, dismissTour],
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
                    className="breath-search"
                    action={engineConfig?.searchUrl}
                    method={isDefault ? undefined : "GET"}
                    target={isDefault ? undefined : "_blank"}
                    role="search"
                    onSubmit={handleSubmit}
                  >
                    <span className="breath-search-logo">
                      <SearchEnginePicker
                        value={searchEngine}
                        onChange={onSearchEngineChange}
                      />
                    </span>
                    <input
                      ref={searchRef}
                      type="text"
                      name={engineConfig?.queryParam ?? "q"}
                      className="breath-search-input"
                      placeholder="Search the web"
                      autoComplete="off"
                    />
                    <span className="breath-search-trail">{SEARCH_ICON}</span>
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

        <footer className="mx-auto w-full max-w-lg pb-6">
          {authPhase === "connecting" ? (
            <article className="breath-card text-center">
              <p className="breath-eyebrow">Connecting to X&hellip;</p>
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
                Syncing your session in the background.
              </p>
            </article>
          ) : authPhase === "need_login" ? (
            <article className="breath-card text-center">
              <p className="breath-eyebrow">Log in to see your bookmarks</p>
              <p className="breath-empty mt-4 text-pretty">
                Sign in to your X account to sync and read your saved posts.
              </p>
              <a
                href="https://x.com/login"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  onLogin?.().catch(() => {});
                }}
                className="breath-btn breath-btn--primary mt-6 inline-block"
              >
                Log in to X
              </a>
            </article>
          ) : currentItem ? (
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
                    <div className="flex items-center gap-1.5">
                      <p className="breath-eyebrow uppercase">recommended</p>
                      {offlineMode && (
                        <WifiSlashIcon className="size-3 text-x-text-secondary" />
                      )}
                    </div>
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
                  onClick={() => {
                    dismissTour();
                    onOpenReading();
                  }}
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

              {offlineMode && (
                <p className="text-center text-xxs text-x-text-secondary/50">
                  Viewing cached bookmarks.{" "}
                  <a
                    href="https://x.com/login"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => {
                      onLogin?.().catch(() => {});
                    }}
                    className="underline hover:text-x-text-secondary"
                  >
                    Log in to X
                  </a>{" "}
                  to sync new ones.
                </p>
              )}
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
            {curatorHud.justSelected && (
              <span className="font-medium text-green-400">Selected!</span>
            )}
            {curatorHud.loading && (
              <span className="text-white/60">Loading…</span>
            )}
            <span className="tabular-nums font-medium">
              {curatorHud.count}/{curatorHud.total}
            </span>
            {curatorHud.rateRemaining !== null && (
              <span className="tabular-nums text-white/40">
                {curatorHud.rateRemaining} req
              </span>
            )}
            <span className="text-white/30">|</span>
            <kbd className="rounded-md border border-white/20 bg-white/10 px-1 py-0.5 font-mono text-white/70">
              Space
            </kbd>
            <span className="text-white/40">Next</span>
            <kbd className="rounded-md border border-white/20 bg-white/10 px-1 py-0.5 font-mono text-white/70">
              Y
            </kbd>
            <span className="text-white/40">Pick</span>
            <kbd className="rounded-md border border-white/20 bg-white/10 px-1 py-0.5 font-mono text-white/70">
              E
            </kbd>
            <span className="text-white/40">Export</span>
          </div>
        )}
      </div>
    </div>
  );
}
