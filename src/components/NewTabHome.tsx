import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Bookmark } from "../types";
import { formatClock } from "../lib/time";
import {
  pickTitle,
  pickExcerpt,
  estimateReadingMinutes,
} from "../lib/bookmark-utils";
import { useWallpaper } from "../hooks/useWallpaper";
import { useTopSites } from "../hooks/useTopSites";

interface Props {
  bookmarks: Bookmark[];
  detailedTweetIds: Set<string>;
  syncing: boolean;
  showTopSites: boolean;
  showSearchBar: boolean;
  topSitesLimit: number;
  onSync: () => void;
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

const READ_IDS_KEY = "tw_breath_read_ids";

function loadReadIds(): Set<string> {
  if (typeof localStorage === "undefined") return new Set<string>();
  const raw = localStorage.getItem(READ_IDS_KEY);
  if (!raw) return new Set<string>();

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set<string>();
    return new Set(parsed.filter((value) => typeof value === "string"));
  } catch {
    return new Set<string>();
  }
}

function persistReadIds(value: Set<string>) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(READ_IDS_KEY, JSON.stringify(Array.from(value)));
}

const SETTINGS_ICON = (
  <svg viewBox="0 0 24 24" className="size-5" fill="currentColor">
    <path d="M12 15.5A3.5 3.5 0 018.5 12 3.5 3.5 0 0112 8.5a3.5 3.5 0 013.5 3.5 3.5 3.5 0 01-3.5 3.5m7.43-2.53c.04-.32.07-.64.07-.97s-.03-.66-.07-1l2.11-1.63c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64L4.57 11c-.04.34-.07.67-.07 1s.03.65.07.97l-2.11 1.66c-.19.15-.25.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1.01c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.58 1.69-.98l2.49 1.01c.22.08.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.66z" />
  </svg>
);

const CHEVRON_LEFT_ICON = (
  <svg viewBox="0 0 20 20" fill="currentColor" className="size-3.5">
    <path
      fillRule="evenodd"
      d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z"
      clipRule="evenodd"
    />
  </svg>
);

const CHEVRON_RIGHT_ICON = (
  <svg viewBox="0 0 20 20" fill="currentColor" className="size-3.5">
    <path
      fillRule="evenodd"
      d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z"
      clipRule="evenodd"
    />
  </svg>
);

const SEARCH_ICON = (
  <svg viewBox="0 0 20 20" fill="currentColor" className="size-4 opacity-50">
    <path
      fillRule="evenodd"
      d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z"
      clipRule="evenodd"
    />
  </svg>
);

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
  detailedTweetIds,
  syncing,
  showTopSites,
  showSearchBar,
  topSitesLimit,
  onSync,
  onOpenBookmark,
  onOpenSettings,
  onOpenReading,
}: Props) {
  const [now, setNow] = useState(() => new Date());
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(() => loadReadIds());
  const [cardEngaged, setCardEngaged] = useState(false);
  const [mountSeed] = useState(() => Math.random());
  const searchRef = useRef<HTMLInputElement>(null);
  const {
    wallpaperUrl,
    wallpaperTitle,
    hasNext,
    hasPrev,
    next: nextWallpaper,
    prev: prevWallpaper,
  } = useWallpaper();
  const { sites: topSites } = useTopSites(topSitesLimit);

  const nowMinute = useMemo(() => Math.floor(now.getTime() / 60000), [now]);

  const { items, unreadItems } = useMemo(() => {
    const allItems: DecoratedBookmark[] = bookmarks.map((bookmark) => ({
      bookmark,
      title: pickTitle(bookmark),
      excerpt: pickExcerpt(bookmark),
      minutes: detailedTweetIds.has(bookmark.tweetId)
        ? estimateReadingMinutes(bookmark)
        : null,
      isRead: readIds.has(bookmark.tweetId),
    }));
    const unread = allItems.filter((item) => !item.isRead);
    return { items: allItems, unreadItems: unread };
  }, [bookmarks, detailedTweetIds, nowMinute, readIds]);

  const currentItem = useMemo(() => {
    const pool = unreadItems.length > 0 ? unreadItems : items;
    if (pool.length === 0) return null;
    const index = Math.floor(mountSeed * pool.length);
    return pool[index];
  }, [items, unreadItems, mountSeed]);

  const [prevWallpaperUrl, setPrevWallpaperUrl] = useState(wallpaperUrl);
  if (wallpaperUrl !== prevWallpaperUrl) {
    setPrevWallpaperUrl(wallpaperUrl);
    setImgLoaded(false);
    setImgError(false);
  }

  const showWallpaper = Boolean(wallpaperUrl && !imgError);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (bookmarks.length === 0) return;

    setReadIds((previous) => {
      if (previous.size === 0) return previous;

      const liveIds = new Set(bookmarks.map((bookmark) => bookmark.tweetId));
      let changed = false;
      const next = new Set<string>();

      for (const id of previous) {
        if (liveIds.has(id)) {
          next.add(id);
        } else {
          changed = true;
        }
      }

      if (!changed) return previous;

      persistReadIds(next);
      return next;
    });
  }, [bookmarks]);

  const markAsRead = useCallback((tweetId: string) => {
    setReadIds((previous) => {
      if (previous.has(tweetId)) return previous;
      const next = new Set(previous);
      next.add(tweetId);
      persistReadIds(next);
      return next;
    });
  }, []);

  const openForReading = useCallback(
    (item: DecoratedBookmark | null) => {
      if (!item) return;
      markAsRead(item.bookmark.tweetId);
      onOpenBookmark(item.bookmark);
    },
    [markAsRead, onOpenBookmark],
  );

  const surpriseMe = useCallback(() => {
    if (items.length === 0) return;
    const pool = unreadItems.length > 0 ? unreadItems : items;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    openForReading(pick);
  }, [items, unreadItems, openForReading]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === "Enter" || e.key === "o") {
        openForReading(currentItem);
      } else if (e.key === "l") {
        onOpenReading();
      } else if (e.key === "s") {
        surpriseMe();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [currentItem, openForReading, onOpenReading, surpriseMe]);

  return (
    <div className="breath-home relative min-h-dvh overflow-hidden">
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

      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-4xl flex-col px-5 py-6 sm:px-8">
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
                className={`breath-card breath-card--zen ${
                  cardEngaged ? "is-engaged" : ""
                }`}
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
                onClick={() => openForReading(currentItem)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    event.stopPropagation();
                    openForReading(currentItem);
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
                  type="button"
                  className="breath-btn breath-btn--secondary"
                  onClick={onOpenReading}
                >
                  Open all bookmarks
                  <kbd className="breath-kbd">L</kbd>
                </button>
                <button
                  type="button"
                  className="breath-btn breath-btn--secondary"
                  onClick={surpriseMe}
                >
                  Surprise me
                  <kbd className="breath-kbd">S</kbd>
                </button>
              </div>
            </div>
          ) : (
            <article className="breath-card text-center">
              <p className="breath-eyebrow">Your reading list is quiet</p>
              <p className="breath-empty mt-4 text-pretty">
                Sync your bookmarks once, and this tab will gently surface what
                to read next.
              </p>
              <button
                type="button"
                onClick={onSync}
                disabled={syncing}
                className="breath-btn breath-btn--primary mt-6"
              >
                {syncing ? "Syncing..." : "Sync bookmarks"}
              </button>
            </article>
          )}
        </footer>

        <button
          type="button"
          onClick={onOpenSettings}
          className="breath-icon-btn breath-settings-btn"
          aria-label="Open settings"
          title="Settings"
        >
          {SETTINGS_ICON}
        </button>

        {showWallpaper && (
          <div className="breath-wallpaper-nav">
            {(hasPrev || hasNext) && (
              <div className="breath-wallpaper-arrows">
                <button
                  type="button"
                  className="breath-wallpaper-arrow"
                  onClick={prevWallpaper}
                  disabled={!hasPrev}
                  aria-label="Previous wallpaper"
                >
                  {CHEVRON_LEFT_ICON}
                </button>
                <button
                  type="button"
                  className="breath-wallpaper-arrow"
                  onClick={nextWallpaper}
                  disabled={!hasNext}
                  aria-label="Next wallpaper"
                >
                  {CHEVRON_RIGHT_ICON}
                </button>
              </div>
            )}
            {wallpaperTitle && (
              <p className="breath-wallpaper-label">{wallpaperTitle}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
