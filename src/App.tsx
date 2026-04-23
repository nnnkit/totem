import { useState, useMemo, useCallback, useEffect } from "react";
import { useTheme } from "./hooks/useTheme";
import { useSettings } from "./hooks/useSettings";
import {
  ensureReadingProgressExists,
  markReadingProgressCompleted,
  markReadingProgressUncompleted,
  getTweetDetailCache,
  getAllReadingProgress,
} from "./db";
import { pickRelatedBookmarks } from "./lib/related";
import { resetLocalData } from "./lib/reset";
import {
  getNewTabUrl,
  getNewTabView,
  getReaderReturnSurface,
  getReaderTweetId,
  getReaderUrl,
  isReaderRoute,
  type ReturnSurface,
} from "./lib/reader-navigation";
import { resolveReaderRouteBookmarks } from "./lib/reader-route";
import type { ReadingTab } from "./lib/reading-list";
import { LS_READING_TAB } from "./lib/storage-keys";
import { NewTabHome } from "./components/NewTabHome";
import { BookmarkReader } from "./components/BookmarkReader";
import { BookmarksList } from "./components/BookmarksList";
import { SettingsModal } from "./components/SettingsModal";
import { Toast } from "./components/ui/Toast";
import { Button } from "./components/ui/Button";
import { OfflineBanner } from "./components/ui/OfflineBanner";
import { resolveReaderErrorView } from "./components/reader/reader-error-view";
import { useContinueReading } from "./hooks/useContinueReading";
import { useReaderDetail } from "./hooks/useReaderDetail";
import {
  useActiveAccountId,
  useAllBookmarks,
  useBookmarksLoaded,
  useDetailedTweetIds,
  useDisplayBookmarks,
  useIsOffline,
  useReaderAvailabilityState,
  useRuntimeActions,
} from "./stores/selectors";
import type { Bookmark, SyncBlockedReason, ThreadTweet } from "./types";

interface DemoExportPayload {
  generatedAt: string;
  source: "totem-extension-newtab";
  bookmarks: Bookmark[];
  detailByTweetId: Record<string, {
    focalTweet: Bookmark | null;
    thread: ThreadTweet[];
    fetchedAt: number;
  }>;
  threadByTweetId: Record<string, ThreadTweet[]>;
  readingProgress: Array<{
    tweetId: string;
    openedAt: number;
    lastReadAt: number;
    scrollY: number;
    scrollHeight: number;
    completed: boolean;
  }>;
  settings: {
    showTopSites: boolean;
    showSearchBar: boolean;
    topSitesLimit: number;
    backgroundMode: "gradient" | "images";
    searchEngine: "google" | "bing" | "duckduckgo" | "yahoo" | "brave" | "ecosia" | "default";
  };
  themePreference: "system" | "light" | "dark";
  stats: {
    bookmarkCount: number;
    detailCount: number;
    threadCount: number;
    progressCount: number;
  };
}

declare global {
  interface Window {
    totemExportDemoData?: () => Promise<DemoExportPayload>;
  }
}

interface ToastState {
  message: string;
  linkUrl?: string;
  linkLabel?: string;
}

type AppView = "home" | "reading";

function readStoredReadingTab(): ReadingTab {
  const stored = localStorage.getItem(LS_READING_TAB);
  if (stored === "unread" || stored === "continue" || stored === "read") {
    return stored;
  }
  return "unread";
}

function openBookmarkInCurrentTab(tweetId: string, returnSurface: ReturnSurface) {
  window.location.assign(getReaderUrl(tweetId, undefined, returnSurface));
}

function goToNewTab(returnSurface: ReturnSurface = "home") {
  window.location.replace(
    getNewTabUrl(
      undefined,
      returnSurface === "reading" ? returnSurface : undefined,
    ),
  );
}

function formatRetryAfterMs(value?: number): string | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  const totalSeconds = Math.ceil(value / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes <= 0) {
    return `${seconds}s`;
  }
  if (seconds === 0) {
    return `${minutes}m`;
  }
  return `${minutes}m ${seconds}s`;
}

interface ExternalReaderShellProps {
  tweetId: string;
  status: "loading" | "error";
  error: string | null;
  onBack: () => void;
  onRetry: () => void;
  onLogin: () => void;
}

function ExternalReaderShell({
  tweetId,
  status,
  error,
  onBack,
  onRetry,
  onLogin,
}: ExternalReaderShellProps) {
  const availability = useReaderAvailabilityState(error);
  const tweetUrl = `https://x.com/i/web/status/${tweetId}`;

  return (
    <div className="min-h-dvh bg-surface">
      <div className="mx-auto flex min-h-dvh max-w-2xl flex-col px-6 py-10">
        <div className="flex items-center justify-between gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            Back
          </Button>
          <Button variant="ghost" size="sm" href={tweetUrl}>
            View on X
          </Button>
        </div>

        <div className="flex flex-1 flex-col justify-center">
          {status === "loading" ? (
            <div className="rounded-2xl border border-border bg-surface-card p-8">
              <div className="flex items-center gap-3 text-sm text-muted">
                <span className="animate-spin">
                  <span className="block size-4 rounded-full border-2 border-accent border-t-transparent" />
                </span>
                Opening this post in Totem...
              </div>
            </div>
          ) : availability.errorKind === "offline" ? (
            <OfflineBanner onLogin={onLogin} />
          ) : (
            (() => {
              const kind =
                availability.errorKind === "auth" ||
                availability.errorKind === "rate_limited" ||
                availability.errorKind === "not_found"
                  ? availability.errorKind
                  : "other";
              const view = resolveReaderErrorView(kind, availability.canLogin);
              const retryVariant =
                view.primaryAction === "retry" ? "secondary" : "ghost";
              const loginVariant =
                view.primaryAction === "login" ? "secondary" : "ghost";
              return (
                <div className="rounded-2xl border border-border bg-surface-card p-8">
                  <h1 className="text-balance text-xl font-semibold text-foreground">
                    {view.title}
                  </h1>
                  <p className="mt-3 text-pretty text-sm text-muted">
                    {view.message}
                  </p>
                  <div className="mt-6 flex flex-wrap items-center gap-3">
                    {view.showLogin && (
                      <Button variant={loginVariant} size="sm" onClick={onLogin}>
                        Log in
                      </Button>
                    )}
                    {view.showRetry && (
                      <Button variant={retryVariant} size="sm" onClick={onRetry}>
                        Retry
                      </Button>
                    )}
                    {view.primaryAction === "view_on_x" && (
                      <Button variant="secondary" size="sm" href={tweetUrl}>
                        Open on X
                      </Button>
                    )}
                  </div>
                </div>
              );
            })()
          )}
        </div>
      </div>
    </div>
  );
}

function NewTabRouteApp() {
  const actions = useRuntimeActions();
  const bookmarks = useAllBookmarks();
  const displayBookmarks = useDisplayBookmarks();
  const detailedTweetIds = useDetailedTweetIds();
  const activeAccountId = useActiveAccountId();
  const offlineMode = useIsOffline();
  const { themePreference, setThemePreference } = useTheme();
  const { settings, updateSettings } = useSettings();
  const [view, setView] = useState<AppView>(() =>
    getNewTabView() === "reading" ? "reading" : "home"
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [readingTab, setReadingTab] = useState<ReadingTab>(() => readStoredReadingTab());
  const [toast, setToast] = useState<ToastState | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  const {
    continueReading,
    allUnread,
    refresh: refreshContinueReading,
  } = useContinueReading(
    bookmarks,
    `${activeAccountId || "__none__"}:${bookmarks.length}:${offlineMode ? "offline" : "online"}`,
  );

  const restoreReadingTab = useCallback(() => {
    setReadingTab(readStoredReadingTab());
  }, []);

  const handleReadingTabChange = useCallback((tab: ReadingTab) => {
    setReadingTab(tab);
    localStorage.setItem(LS_READING_TAB, tab);
  }, []);

  const notifySyncBlocked = useCallback((reason?: string, retryAfterMs?: number) => {
    const code = reason as SyncBlockedReason | undefined;
    const retryIn = formatRetryAfterMs(retryAfterMs);
    switch (code) {
      case "in_flight":
        setToast({
          message: retryIn
            ? `Sync is in progress. Try again in ${retryIn}.`
            : "Sync is already in progress. Please wait for it to finish.",
        });
        return;
      case "cooldown":
        setToast({
          message: retryIn
            ? `You can sync again in ${retryIn}.`
            : "You can only resync every few minutes.",
        });
        return;
      case "rate_limited":
        setToast({
          message: retryIn
            ? `Sync is temporarily paused. Try again in ${retryIn}.`
            : "Sync is temporarily paused. Please try again in a few minutes.",
        });
        return;
      case "no_account":
        setToast({ message: "Could not identify account context. Try opening X once." });
        return;
      case "not_ready":
        setToast({ message: "Sync is not ready yet. Log in to X and try again." });
        return;
      default:
        return;
    }
  }, []);

  const handleSync = useCallback(() => {
    actions.refresh()
      .then((result) => {
        if (!result.accepted) {
          notifySyncBlocked(result.reason, result.retryAfterMs);
        }
      })
      .catch(() => {});
  }, [actions, notifySyncBlocked]);

  const openedTweetIds = useMemo(
    () => new Set(continueReading.map((item) => item.progress.tweetId)),
    [continueReading],
  );

  const openBookmarkFromHome = useCallback((bookmark: Bookmark) => {
    openBookmarkInCurrentTab(bookmark.tweetId, "home");
  }, []);

  const openBookmarkFromReading = useCallback((bookmark: Bookmark) => {
    openBookmarkInCurrentTab(bookmark.tweetId, "reading");
  }, []);

  const getHomeBookmarkHref = useCallback((bookmark: Bookmark) => {
    return getReaderUrl(bookmark.tweetId, undefined, "home");
  }, []);

  const getReadingBookmarkHref = useCallback((bookmark: Bookmark) => {
    return getReaderUrl(bookmark.tweetId, undefined, "reading");
  }, []);

  const handleResetLocalData = useCallback(async () => {
    if (isResetting) return;
    setIsResetting(true);
    actions.prepareForReset();
    try {
      await resetLocalData();
    } catch {
    } finally {
      refreshContinueReading();
      restoreReadingTab();
      setView("home");
      setSettingsOpen(false);
      setIsResetting(false);
      window.location.reload();
    }
  }, [actions, isResetting, refreshContinueReading, restoreReadingTab]);

  useEffect(() => {
    actions.setReaderActive(false);
  }, [actions]);

  useEffect(() => {
    const target = getNewTabUrl(undefined, view === "reading" ? "reading" : undefined);
    window.history.replaceState({}, "", target);
  }, [view]);

  useEffect(() => {
    window.totemExportDemoData = async () => {
      const detailEntries = await Promise.all(
        bookmarks.map(async (bookmark) => {
          const detail = await getTweetDetailCache(bookmark.tweetId).catch(() => null);
          return [bookmark.tweetId, detail] as const;
        }),
      );

      const detailByTweetId: DemoExportPayload["detailByTweetId"] = {};
      const threadByTweetId: DemoExportPayload["threadByTweetId"] = {};
      let detailCount = 0;
      let threadCount = 0;

      for (const [tweetId, detail] of detailEntries) {
        if (!detail) continue;
        detailCount += 1;
        if (detail.thread.length > 0) {
          threadByTweetId[tweetId] = detail.thread;
          threadCount += 1;
        }
        detailByTweetId[tweetId] = {
          focalTweet: detail.focalTweet,
          thread: detail.thread,
          fetchedAt: detail.fetchedAt,
        };
      }

      const readingProgress = await getAllReadingProgress().catch(() => []);

      const payload: DemoExportPayload = {
        generatedAt: new Date().toISOString(),
        source: "totem-extension-newtab",
        bookmarks,
        detailByTweetId,
        threadByTweetId,
        readingProgress,
        settings,
        themePreference,
        stats: {
          bookmarkCount: bookmarks.length,
          detailCount,
          threadCount,
          progressCount: readingProgress.length,
        },
      };

      const json = JSON.stringify(payload, null, 2);
      const snippet = [
        "// Copy into website/src/demo/fixtures.ts and adapt as needed",
        `export const DEMO_BOOKMARKS = ${JSON.stringify(payload.bookmarks, null, 2)};`,
        `export const DEMO_THREAD_LOOKUP = ${JSON.stringify(payload.threadByTweetId, null, 2)};`,
      ].join("\n\n");

      console.log("[Totem] Demo export JSON (copy this):");
      console.log(json);
      console.log("[Totem] Demo fixture snippet:");
      console.log(snippet);

      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(json);
          console.log("[Totem] Copied JSON to clipboard.");
        } catch {
        }
      }

      return payload;
    };

    return () => {
      delete window.totemExportDemoData;
    };
  }, [bookmarks, settings, themePreference]);

  const mainContent = view === "reading"
    ? (
      <BookmarksList
        continueReadingItems={continueReading}
        unreadBookmarks={allUnread}
        activeTab={readingTab}
        onTabChange={handleReadingTabChange}
        onOpenBookmark={openBookmarkFromReading}
        getBookmarkHref={getReadingBookmarkHref}
        onSync={handleSync}
        onBack={() => setView("home")}
      />
    )
    : (
      <NewTabHome
        bookmarks={displayBookmarks}
        onSync={handleSync}
        detailedTweetIds={detailedTweetIds}
        showTopSites={settings.showTopSites}
        showSearchBar={settings.showSearchBar}
        searchEngine={settings.searchEngine}
        onSearchEngineChange={(engine) => updateSettings({ searchEngine: engine })}
        topSitesLimit={settings.topSitesLimit}
        backgroundMode={settings.backgroundMode}
        openedTweetIds={openedTweetIds}
        onOpenBookmark={openBookmarkFromHome}
        getBookmarkHref={getHomeBookmarkHref}
        recommendationSource={settings.recommendationSource}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenReading={() => {
          restoreReadingTab();
          setView("reading");
        }}
        isResetting={isResetting}
      />
    );

  return (
    <>
      {mainContent}
      <SettingsModal
        open={settingsOpen}
        isResetting={isResetting}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={updateSettings}
        themePreference={themePreference}
        onThemePreferenceChange={setThemePreference}
        onResetLocalData={handleResetLocalData}
      />
      {toast && (
        <Toast
          message={toast.message}
          linkUrl={toast.linkUrl}
          linkLabel={toast.linkLabel}
          onDismiss={() => setToast(null)}
        />
      )}
    </>
  );
}

function ReaderRouteApp() {
  const actions = useRuntimeActions();
  const allBookmarks = useAllBookmarks();
  const displayBookmarks = useDisplayBookmarks();
  const bookmarksLoaded = useBookmarksLoaded();
  const offlineMode = useIsOffline();
  const { settings } = useSettings();
  const readTweetId = useMemo(() => getReaderTweetId(), []);
  const returnSurface = useMemo(() => getReaderReturnSurface(), []);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [shuffleSeed, setShuffleSeed] = useState(0);
  const [localMutation, setLocalMutation] = useState<"idle" | "unbookmarking">("idle");
  const [localBookmarkSnapshot, setLocalBookmarkSnapshot] = useState<Bookmark | null>(null);
  const [externalMutation, setExternalMutation] = useState<"idle" | "unbookmarking">("idle");
  const [externalUnbookmarkedTweetId, setExternalUnbookmarkedTweetId] =
    useState<string | null>(null);

  const {
    localBookmark,
    hiddenBookmark,
    prevBookmark,
    nextBookmark,
  } = useMemo(
    () =>
      resolveReaderRouteBookmarks(readTweetId, displayBookmarks, allBookmarks),
    [allBookmarks, displayBookmarks, readTweetId],
  );

  const fetchExternalDetail =
    Boolean(readTweetId) && !localBookmark && !hiddenBookmark;
  // Wait for hydrateCurrentAccount before hitting the detail cache: getDb()
  // memoizes a handle on the DB name active at call time, so firing pre-
  // hydration sticks the default "totem" handle for the rest of the session.
  const { state: readerDetail, refetch: refetchReaderDetail } = useReaderDetail(
    fetchExternalDetail && bookmarksLoaded ? readTweetId : null,
  );

  useEffect(() => {
    actions.setReaderActive(true);
    return () => {
      actions.setReaderActive(false);
    };
  }, [actions]);

  useEffect(() => {
    if (!readTweetId) {
      goToNewTab(returnSurface);
      return;
    }
    // Wait for hydrateCurrentAccount to point IDB at the account DB.
    // Without this gate, getDb() captures the default "totem" DB and the
    // progress write is invisible to the account-scoped reads on return.
    if (!bookmarksLoaded) return;
    if (hiddenBookmark) {
      goToNewTab(returnSurface);
      return;
    }
    ensureReadingProgressExists(readTweetId).catch(() => {});
  }, [bookmarksLoaded, hiddenBookmark, readTweetId, returnSurface]);

  useEffect(() => {
    if (localBookmark) {
      setLocalBookmarkSnapshot(localBookmark);
      setLocalMutation("idle");
    }
  }, [localBookmark?.tweetId]); // eslint-disable-line react-hooks/exhaustive-deps -- sync snapshot when ID changes, not on every bookmark object update

  const externalBookmark = useMemo(() => {
    if (readerDetail.status !== "success") return null;
    if (externalUnbookmarkedTweetId === readerDetail.tweetId) {
      return { ...readerDetail.data.focalTweet, bookmarked: false };
    }
    return readerDetail.data.focalTweet;
  }, [readerDetail, externalUnbookmarkedTweetId]);

  const displayBookmark =
    localBookmark || localBookmarkSnapshot || externalBookmark;

  const relatedBookmarks = useMemo(
    () => pickRelatedBookmarks(displayBookmark, displayBookmarks, 3, shuffleSeed > 0),
    [displayBookmark, displayBookmarks, shuffleSeed],
  );

  const handleBack = useCallback(() => {
    goToNewTab(returnSurface);
  }, [returnSurface]);

  const getBookmarkHref = useCallback((bookmark: Bookmark) => {
    return getReaderUrl(bookmark.tweetId, undefined, returnSurface);
  }, [returnSurface]);

  const handleUnbookmark = useCallback(async () => {
    if (!displayBookmark) return;

    const tweetId = displayBookmark.tweetId;
    const tweetUrl = `https://x.com/i/web/status/${tweetId}`;
    const hasLocalSource = Boolean(localBookmark || localBookmarkSnapshot);

    if (hasLocalSource) {
      setLocalMutation("unbookmarking");
      setLocalBookmarkSnapshot({
        ...(localBookmarkSnapshot || displayBookmark),
        bookmarked: false,
      });
    } else {
      setExternalMutation("unbookmarking");
    }

    let apiError: string | undefined;
    try {
      ({ apiError } = await actions.unbookmark(tweetId));
    } catch {
      apiError = "UNBOOKMARK_FAILED";
    }

    if (hasLocalSource) {
      setLocalMutation("idle");
      if (apiError) {
        setToast({
          message: "Removed locally. Unbookmark it on X to fully remove.",
          linkUrl: tweetUrl,
          linkLabel: "Open on X",
        });
      }
      return;
    }

    setExternalMutation("idle");
    if (apiError) {
      setToast({
        message: "Could not remove this bookmark right now.",
        linkUrl: tweetUrl,
        linkLabel: "Open on X",
      });
      return;
    }
    setExternalUnbookmarkedTweetId(tweetId);
  }, [actions, displayBookmark, localBookmark, localBookmarkSnapshot]);

  const unbookmarking =
    localMutation === "unbookmarking" || externalMutation === "unbookmarking";

  const bookmarkAction = !offlineMode && displayBookmark?.bookmarked
    ? {
      label: unbookmarking ? "Removing..." : "Unbookmark",
      active: true,
      pending: unbookmarking,
      onClick: () => {
        void handleUnbookmark();
      },
    }
    : undefined;

  if (!readTweetId) {
    return null;
  }

  if (displayBookmark) {
    return (
      <>
        <BookmarkReader
          key={displayBookmark.tweetId}
          bookmark={displayBookmark}
          relatedBookmarks={relatedBookmarks}
          getBookmarkHref={getBookmarkHref}
          onBack={handleBack}
          onShuffle={() => setShuffleSeed((seed) => seed + 1)}
          prevHref={
            prevBookmark
              ? getReaderUrl(prevBookmark.tweetId, undefined, returnSurface)
              : undefined
          }
          nextHref={
            nextBookmark
              ? getReaderUrl(nextBookmark.tweetId, undefined, returnSurface)
              : undefined
          }
          bookmarkAction={bookmarkAction}
          onMarkAsRead={markReadingProgressCompleted}
          onMarkAsUnread={markReadingProgressUncompleted}
          defaultHighlightColor={settings.defaultHighlightColor}
          loadDetail={
            readerDetail.status === "success"
              ? async (tweetId) => {
                if (tweetId === readerDetail.tweetId) {
                  return readerDetail.data;
                }
                return actions.loadReaderDetail(tweetId);
              }
              : undefined
          }
        />
        {toast && (
          <Toast
            message={toast.message}
            linkUrl={toast.linkUrl}
            linkLabel={toast.linkLabel}
            onDismiss={() => setToast(null)}
          />
        )}
      </>
    );
  }

  return (
    <>
      <ExternalReaderShell
        tweetId={readTweetId}
        status={readerDetail.status === "error" ? "error" : "loading"}
        error={readerDetail.status === "error" ? readerDetail.error : null}
        onBack={handleBack}
        onRetry={() => {
          refetchReaderDetail();
        }}
        onLogin={() => {
          void actions.startLogin();
        }}
      />
      {toast && (
        <Toast
          message={toast.message}
          linkUrl={toast.linkUrl}
          linkLabel={toast.linkLabel}
          onDismiss={() => setToast(null)}
        />
      )}
    </>
  );
}

export default function App() {
  return isReaderRoute() ? <ReaderRouteApp /> : <NewTabRouteApp />;
}
