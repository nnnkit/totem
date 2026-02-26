import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import {
  GearSixIcon,
  LinkBreakIcon,
  MagnifyingGlassIcon,
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

const CLOCK_CLASS = "font-serif text-balance text-[clamp(2.4rem,7vw,4.2rem)] font-light leading-none tracking-[-0.04em] text-on-bg tabular-nums";

const ICON_BUTTON_CLASS =
  "rounded border border-transparent bg-transparent p-[0.46rem] text-on-bg-muted transition-[border-color,color,background-color] duration-150 ease-hover hover:border-[rgba(255,255,255,0.16)] hover:bg-[rgba(255,255,255,0.06)] hover:text-on-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(226,128,103,0.82)]";

const SEARCH_FORM_CLASS =
  "relative mx-auto flex max-w-[36rem] items-center rounded bg-search-bg backdrop-blur-[12px] shadow-search";

const SEARCH_LOGO_CLASS = "flex items-center pl-2";

const SEARCH_INPUT_CLASS =
  "w-full appearance-none border-0 bg-transparent px-3 py-[0.85rem] text-base text-home-fg [font-family:inherit] outline-none placeholder:text-home-placeholder";

const SEARCH_TRAIL_CLASS =
  "pointer-events-none flex items-center pr-4 text-home-fg";

const QUICK_LINK_CLASS =
  "group flex flex-col items-center gap-[0.35rem] no-underline transition-opacity duration-150 ease-hover";

const QUICK_LINK_ICON_CLASS =
  "flex size-10 items-center justify-center rounded border border-overlay-edge bg-overlay transition-[background,border-color] duration-150 ease-hover group-hover:bg-overlay-hover group-hover:border-overlay-hover-edge";

const QUICK_LINK_LABEL_CLASS =
  "max-w-[4.5rem] overflow-hidden text-ellipsis whitespace-nowrap text-center text-[0.62rem] text-on-bg-ghost group-hover:text-on-bg-muted";

const CARD_BASE_CLASS =
  "relative min-h-[8.5rem] overflow-hidden rounded p-[0.86rem_1rem_0.72rem] bg-glass backdrop-blur-[20px] shadow-glass transition-colors duration-150 ease-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(226,128,103,0.82)] max-[768px]:min-h-[8.4rem] max-[480px]:min-h-[8.2rem] max-[480px]:p-[0.82rem_0.9rem_0.78rem]";

const PICK_CARD_CLASS = "min-h-[8.9rem] cursor-pointer hover:bg-glass-hover";

const CARD_CONTENT_CLASS =
  "min-h-[7rem] translate-y-0 opacity-100 transition-[transform,opacity] duration-200 ease-[cubic-bezier(0.215,0.61,0.355,1)] motion-reduce:transition-none max-[768px]:min-h-[6.8rem] max-[480px]:min-h-[6.6rem]";

const EYEBROW_CLASS = "text-[0.68rem] font-semibold uppercase tracking-[0.26em] text-accent";

const CARD_TITLE_CLASS = "font-serif mt-4 line-clamp-2 min-h-[calc(1.28em*2)] text-balance text-[clamp(0.96rem,1.8vw,1.16rem)] font-normal leading-[1.28] text-home-fg-secondary max-[480px]:text-[0.92rem]";

const CARD_DESCRIPTION_CLASS =
  "mt-2.5 line-clamp-1 min-h-[calc(1.48em*1)] text-pretty text-[0.76rem] leading-[1.48] text-home-description";

const CARD_META_CLASS = "text-[0.72rem] leading-[1.2] text-home-fg-muted";

const ACTIONS_CLASS = "mt-8 flex items-center justify-between gap-[0.65rem] max-[480px]:gap-[0.55rem]";

const CTA_BUTTON_CLASS =
  "inline-flex items-center justify-center rounded text-[0.79rem] font-semibold leading-none transition-[opacity,color,border-color,background-color] duration-150 ease-hover disabled:cursor-default disabled:opacity-[0.56] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(226,128,103,0.82)]";

const PRIMARY_BUTTON_CLASS =
  "border-0 bg-home-accent px-4 py-2 text-white hover:opacity-90";

const SECONDARY_BUTTON_CLASS =
  "border border-home-secondary-border bg-home-secondary-bg px-[1.28rem] py-[0.68rem] text-home-secondary-text hover:bg-glass-hover";

const HOTKEY_KBD_CLASS =
  "ml-2 border-home-secondary-border bg-accent-tint text-home-fg-muted";

const EMPTY_STATE_TEXT_CLASS =
  "mt-4 text-pretty text-[0.95rem] text-home-empty";

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
          className="pointer-events-none absolute inset-0 h-full w-full object-cover transition-opacity duration-[260ms] ease-[cubic-bezier(0.215,0.61,0.355,1)] [filter:brightness(0.72)] motion-reduce:transition-none"
          style={{ opacity: imgLoaded ? 0.6 : 0 }}
        />
      )}
      <div className="totem-ambient pointer-events-none absolute inset-0" />
      <div className="totem-grain pointer-events-none absolute inset-0" />

      <header className="relative z-20 flex w-full items-center justify-between px-6 pt-5 sm:px-8">
        <TotemLogo className="size-8" />
        <button
          data-tour="settings-btn"
          type="button"
          onClick={onOpenSettings}
          className={ICON_BUTTON_CLASS}
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
                className={CLOCK_CLASS}
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
                    className={SEARCH_FORM_CLASS}
                    action={engineConfig?.searchUrl}
                    method={isDefault ? undefined : "GET"}
                    target={isDefault ? undefined : "_blank"}
                    role="search"
                    onSubmit={handleSubmit}
                  >
                    <span className={SEARCH_LOGO_CLASS}>
                      <SearchEnginePicker
                        value={searchEngine}
                        onChange={onSearchEngineChange}
                      />
                    </span>
                    <input
                      ref={searchRef}
                      type="text"
                      name={engineConfig?.queryParam ?? "q"}
                      className={SEARCH_INPUT_CLASS}
                      placeholder="Search the web"
                      autoComplete="off"
                    />
                    <span className={SEARCH_TRAIL_CLASS}>{SEARCH_ICON}</span>
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
                    className={QUICK_LINK_CLASS}
                    title={site.title}
                  >
                    <span className={QUICK_LINK_ICON_CLASS}>
                      <img
                        src={site.faviconUrl}
                        alt=""
                        width={20}
                        height={20}
                        loading="lazy"
                        className="rounded"
                      />
                    </span>
                    <span className={QUICK_LINK_LABEL_CLASS}>
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
            <article className={cn(CARD_BASE_CLASS, "text-center")}>
              <p className={EYEBROW_CLASS}>Connecting to X&hellip;</p>
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
              <p className={EMPTY_STATE_TEXT_CLASS}>
                Syncing your session in the background.
              </p>
            </article>
          ) : authPhase === "need_login" ? (
            <article className={cn(CARD_BASE_CLASS, "text-center")}>
              <p className={EYEBROW_CLASS}>Log in to see your bookmarks</p>
              <p className={EMPTY_STATE_TEXT_CLASS}>
                Sign in to your X account to sync and read your saved posts.
              </p>
              <a
                href="https://x.com/login"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  onLogin?.().catch(() => {});
                }}
                className={cn(
                  CTA_BUTTON_CLASS,
                  PRIMARY_BUTTON_CLASS,
                  "mt-6 inline-block",
                )}
              >
                Log in to X
              </a>
            </article>
          ) : currentItem ? (
            <div className="space-y-4">
              <article
                data-tour="bookmark-card"
                className={cn(
                  CARD_BASE_CLASS,
                  PICK_CARD_CLASS,
                  cardEngaged && "bg-glass-hover",
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
                <div className={CARD_CONTENT_CLASS}>
                  <div className="flex justify-between">
                    <div className="flex items-center gap-1.5">
                      <p className={EYEBROW_CLASS}>recommended</p>
                      {offlineMode && (
                        <span title="Not signed in — showing cached bookmarks">
                          <LinkBreakIcon
                            className="size-3 animate-[offline-pulse_2s_ease-in-out_infinite] text-muted"
                          />
                        </span>
                      )}
                    </div>
                    <kbd className={HOTKEY_KBD_CLASS}>O</kbd>
                  </div>

                  <h2 className={CARD_TITLE_CLASS}>
                    {currentItem.title}
                  </h2>
                  <p className={CARD_DESCRIPTION_CLASS}>
                    {currentItem.excerpt}
                  </p>
                  <div className="mt-3 flex items-end justify-between gap-3">
                    <p className={CARD_META_CLASS}>
                      @{currentItem.bookmark.author.screenName}
                    </p>
                  </div>
                </div>
              </article>

              <div className={ACTIONS_CLASS}>
                <button
                  data-tour="open-all-btn"
                  type="button"
                  className={cn(CTA_BUTTON_CLASS, SECONDARY_BUTTON_CLASS)}
                  onClick={() => {
                    dismissTour();
                    onOpenReading();
                  }}
                >
                  Open all bookmarks
                  <kbd className={HOTKEY_KBD_CLASS}>L</kbd>
                </button>
                <button
                  data-tour="surprise-btn"
                  type="button"
                  className={cn(CTA_BUTTON_CLASS, SECONDARY_BUTTON_CLASS)}
                  onClick={surpriseMe}
                >
                  Surprise me
                  <kbd className={HOTKEY_KBD_CLASS}>S</kbd>
                </button>
              </div>

              {offlineMode && (
                <p className="text-center text-xxs text-muted/50">
                  Viewing cached bookmarks.{" "}
                  <a
                    href="https://x.com/login"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => {
                      onLogin?.().catch(() => {});
                    }}
                    className="underline hover:text-muted"
                  >
                    Log in to X
                  </a>{" "}
                  to sync new ones.
                </p>
              )}
            </div>
          ) : syncState.phase === "syncing" ? (
            <article className={cn(CARD_BASE_CLASS, "text-center")}>
              <p className={EYEBROW_CLASS}>Syncing your bookmarks&hellip;</p>
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
              <p className={EMPTY_STATE_TEXT_CLASS}>
                Fetching bookmarks from your account. This may take a moment.
              </p>
            </article>
          ) : syncState.phase === "error" ? (
            <article className={cn(CARD_BASE_CLASS, "text-center")}>
              <p className={EYEBROW_CLASS}>Something went wrong</p>
              <p className={EMPTY_STATE_TEXT_CLASS}>
                {syncState.error === "reconnecting"
                  ? "Reconnecting to your account\u2026"
                  : "Could not sync your bookmarks. Check your connection and try again."}
              </p>
              {syncState.error !== "reconnecting" && (
                <button
                  type="button"
                  onClick={onSync}
                  className={cn(CTA_BUTTON_CLASS, PRIMARY_BUTTON_CLASS, "mt-6")}
                >
                  Try again
                </button>
              )}
            </article>
          ) : (
            <article className={cn(CARD_BASE_CLASS, "text-center")}>
              <p className={EYEBROW_CLASS}>Your reading list is quiet</p>
              <p className={EMPTY_STATE_TEXT_CLASS}>
                No bookmarks found. Bookmark some posts on X, then sync to see
                them here.
              </p>
              <button
                type="button"
                onClick={onSync}
                className={cn(CTA_BUTTON_CLASS, PRIMARY_BUTTON_CLASS, "mt-6")}
              >
                Sync bookmarks
              </button>
            </article>
          )}
        </footer>

        {showWallpaper && wallpaperCredit && (
          <p className="fixed bottom-6 left-6 z-20 text-xs text-stone-500">
            Photo by{" "}
            <a
              href={wallpaperCredit.url}
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-stone-400"
            >
              {wallpaperCredit.name}
            </a>
          </p>
        )}
        {curatorHud && (
          <div className="fixed bottom-6 right-6 z-20 flex items-center gap-2 rounded bg-black/60 px-3 py-2 text-xs text-white backdrop-blur-xl">
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
            <kbd className="rounded border border-white/20 bg-white/10 px-1 py-0.5 font-mono text-white/70">
              Space
            </kbd>
            <span className="text-white/40">Next</span>
            <kbd className="rounded border border-white/20 bg-white/10 px-1 py-0.5 font-mono text-white/70">
              Y
            </kbd>
            <span className="text-white/40">Pick</span>
            <kbd className="rounded border border-white/20 bg-white/10 px-1 py-0.5 font-mono text-white/70">
              E
            </kbd>
            <span className="text-white/40">Export</span>
          </div>
        )}
      </div>
    </div>
  );
}
