import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useTheme } from "./hooks/useTheme";
import { useSettings } from "./hooks/useSettings";
import { useKeyboardNavigation } from "./hooks/useKeyboard";
import {
  ensureReadingProgressExists,
  markReadingProgressCompleted,
  markReadingProgressUncompleted,
  getTweetDetailCache,
  getAllReadingProgress,
} from "./db";
import { pickRelatedBookmarks } from "./lib/related";
import { resetLocalData } from "./lib/reset";
import { LS_READING_TAB } from "./lib/storage-keys";
import { NewTabHome } from "./components/NewTabHome";
import { BookmarkReader } from "./components/BookmarkReader";
import { BookmarksList, type ReadingTab } from "./components/BookmarksList";
import { SettingsModal } from "./components/SettingsModal";
import { Toast } from "./components/ui/Toast";
import { Button } from "./components/ui/Button";
import { OfflineBanner } from "./components/ui/OfflineBanner";
import { useContinueReading } from "./hooks/useContinueReading";
import {
  useAppMode,
  useActiveAccountId,
  useAllBookmarks,
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

interface ExternalReaderState {
  tweetId: string;
  status: "loading" | "ready" | "error";
  bookmark: Bookmark | null;
  thread: ThreadTweet[];
  error: string | null;
  mutation: "idle" | "bookmarking" | "unbookmarking";
}

type AppView = "home" | "reading";

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
            <div className="rounded-2xl border border-border bg-surface-card p-8">
              <h1 className="text-balance text-xl font-semibold text-foreground">
                Couldn&apos;t open this post in Totem.
              </h1>
              <p className="mt-3 text-pretty text-sm text-muted">
                {availability.errorKind === "auth"
                  ? "Your X session is unavailable for tweet detail loading."
                  : "Totem couldn&apos;t fetch the full tweet detail right now."}
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Button variant="secondary" size="sm" onClick={onRetry}>
                  Retry
                </Button>
                {availability.canLogin && (
                  <Button variant="ghost" size="sm" onClick={onLogin}>
                    Log in
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const actions = useRuntimeActions();
  const appMode = useAppMode();
  const bookmarks = useAllBookmarks();
  const displayBookmarks = useDisplayBookmarks();
  const detailedTweetIds = useDetailedTweetIds();
  const activeAccountId = useActiveAccountId();
  const offlineMode = useIsOffline();
  const { themePreference, setThemePreference } = useTheme();
  const { settings, updateSettings } = useSettings();
  const [view, setView] = useState<AppView>("home");
  const pendingReadTweetIdRef = useRef<string | null>(
    new URLSearchParams(window.location.search).get("read"),
  );
  const [selectedBookmarkRaw, setSelectedBookmark] = useState<Bookmark | null>(
    null,
  );
  const [externalReader, setExternalReader] = useState<ExternalReaderState | null>(
    null,
  );
  const readerOpen = selectedBookmarkRaw !== null || externalReader !== null;

  const selectedBookmark = useMemo(() => {
    if (!selectedBookmarkRaw) return null;
    return displayBookmarks.find((b) => b.tweetId === selectedBookmarkRaw.tweetId) || null;
  }, [selectedBookmarkRaw, displayBookmarks]);

  const {
    continueReading,
    allUnread,
    refresh: refreshContinueReading,
  } = useContinueReading(
    displayBookmarks,
    `${activeAccountId || "__none__"}:${displayBookmarks.length}:${offlineMode ? "offline" : "online"}`,
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [readingTab, setReadingTab] = useState<ReadingTab>(() => {
    const stored = localStorage.getItem(LS_READING_TAB);
    if (stored === "unread" || stored === "continue" || stored === "read") return stored;
    return "unread";
  });

  const restoreReadingTab = useCallback(() => {
    const stored = localStorage.getItem(LS_READING_TAB);
    if (stored === "unread" || stored === "continue" || stored === "read") {
      setReadingTab(stored);
    } else {
      setReadingTab("unread");
    }
  }, []);

  const handleReadingTabChange = useCallback((tab: ReadingTab) => {
    setReadingTab(tab);
    localStorage.setItem(LS_READING_TAB, tab);
  }, []);
  const [toast, setToast] = useState<ToastState | null>(null);
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
  const [shuffleSeed, setShuffleSeed] = useState(0);
  const handleShuffle = useCallback(() => {
    setShuffleSeed((s) => s + 1);
  }, []);

  const relatedBookmarks = useMemo(
    () => pickRelatedBookmarks(selectedBookmark, displayBookmarks, 3, shuffleSeed > 0),
    [selectedBookmark, displayBookmarks, shuffleSeed],
  );
  const externalReaderBookmark = externalReader?.status === "ready"
    ? externalReader.bookmark
    : null;
  const externalRelatedBookmarks = useMemo(
    () => pickRelatedBookmarks(externalReaderBookmark, displayBookmarks, 3, shuffleSeed > 0),
    [displayBookmarks, externalReaderBookmark, shuffleSeed],
  );

  const openedTweetIds = useMemo(
    () => new Set(continueReading.map((item) => item.progress.tweetId)),
    [continueReading],
  );

  const openBookmark = useCallback(
    (bookmark: Bookmark) => {
      setExternalReader(null);
      ensureReadingProgressExists(bookmark.tweetId)
        .then(refreshContinueReading)
        .catch(() => {});
      setSelectedBookmark(bookmark);
    },
    [refreshContinueReading],
  );

  const selectedIndex = selectedBookmark
    ? displayBookmarks.findIndex((b) => b.id === selectedBookmark.id)
    : -1;
  const hasPrev = selectedIndex > 0;
  const hasNext = selectedIndex >= 0 && selectedIndex < displayBookmarks.length - 1;

  const bookmarksRef = useRef(displayBookmarks);
  bookmarksRef.current = displayBookmarks;
  const selectedBookmarkRef = useRef(selectedBookmark);
  selectedBookmarkRef.current = selectedBookmark;

  const goToPrev = useCallback(() => {
    const bk = bookmarksRef.current;
    const sel = selectedBookmarkRef.current;
    const idx = bk.findIndex((b) => b.id === sel?.id);
    if (idx > 0) setSelectedBookmark(bk[idx - 1]);
  }, []);

  const goToNext = useCallback(() => {
    const bk = bookmarksRef.current;
    const sel = selectedBookmarkRef.current;
    const idx = bk.findIndex((b) => b.id === sel?.id);
    if (idx >= 0 && idx < bk.length - 1) setSelectedBookmark(bk[idx + 1]);
  }, []);

  const closeReader = useCallback(() => {
    setExternalReader(null);
    setSelectedBookmark(null);
    refreshContinueReading();
  }, [refreshContinueReading]);

  const clearPendingReadParam = useCallback(() => {
    pendingReadTweetIdRef.current = null;
    window.history.replaceState({}, "", window.location.pathname);
  }, []);

  const [isResetting, setIsResetting] = useState(false);
  const handleResetLocalData = useCallback(async () => {
    if (isResetting) return;
    setIsResetting(true);
    actions.prepareForReset();
    try {
      await resetLocalData();
    } catch {
      // Reset is best-effort. The in-memory state is already cleared above.
    } finally {
      refreshContinueReading();
      restoreReadingTab();
      setExternalReader(null);
      setSelectedBookmark(null);
      setView("home");
      setSettingsOpen(false);
      setIsResetting(false);
      window.location.reload();
    }
  }, [actions, isResetting, refreshContinueReading, restoreReadingTab]);

  useEffect(() => {
    actions.setReaderActive(readerOpen);
  }, [actions, readerOpen]);

  useKeyboardNavigation({
    selectedBookmark,
    filteredBookmarks: displayBookmarks,
    closeReader,
    setSelectedBookmark,
  });

  useEffect(() => {
    const readTweetId = pendingReadTweetIdRef.current;
    if (!readTweetId || appMode === "initializing") return;
    const target = displayBookmarks.find((b) => b.tweetId === readTweetId);
    if (target) {
      clearPendingReadParam();
      openBookmark(target);
      return;
    }
    if (externalReader?.tweetId === readTweetId) return;
    clearPendingReadParam();
    setExternalReader({
      tweetId: readTweetId,
      status: "loading",
      bookmark: null,
      thread: [],
      error: null,
      mutation: "idle",
    });
  }, [appMode, clearPendingReadParam, displayBookmarks, externalReader?.tweetId, openBookmark]);

  useEffect(() => {
    if (externalReader?.status !== "loading") return;

    let cancelled = false;
    actions.loadReaderDetail(externalReader.tweetId)
      .then((detail) => {
        if (cancelled) return;
        if (!detail.focalTweet) {
          setExternalReader({
            tweetId: externalReader.tweetId,
            status: "error",
            bookmark: null,
            thread: [],
            error: "DETAIL_NOT_FOUND",
            mutation: "idle",
          });
          return;
        }

        setExternalReader({
          tweetId: externalReader.tweetId,
          status: "ready",
          bookmark: detail.focalTweet,
          thread: detail.thread,
          error: null,
          mutation: "idle",
        });
      })
      .catch((error) => {
        if (cancelled) return;
        setExternalReader({
          tweetId: externalReader.tweetId,
          status: "error",
          bookmark: null,
          thread: [],
          error: error instanceof Error ? error.message : "DETAIL_ERROR",
          mutation: "idle",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [actions, externalReader]);

  useEffect(() => {
    if (externalReader?.status !== "ready" || !externalReader.bookmark) return;
    const syncedBookmark = displayBookmarks.find(
      (bookmark) => bookmark.tweetId === externalReader.bookmark?.tweetId,
    );
    if (syncedBookmark) {
      openBookmark(syncedBookmark);
    }
  }, [displayBookmarks, externalReader, openBookmark]);

  const handleExternalBookmark = useCallback(async () => {
    if (externalReader?.status !== "ready" || !externalReader.bookmark) return;
    if (externalReader.mutation !== "idle") return;

    const tweetId = externalReader.bookmark.tweetId;
    const tweetUrl = `https://x.com/i/web/status/${tweetId}`;

    setExternalReader((current) => current?.status === "ready"
      ? { ...current, mutation: "bookmarking" }
      : current);

    const result = await actions.bookmark(tweetId);
    if (result.bookmark) {
      openBookmark(result.bookmark);
      return;
    }

    setExternalReader((current) => {
      if (current?.status !== "ready" || !current.bookmark) return current;
      return {
        ...current,
        mutation: "idle",
        bookmark: result.createdOnX
          ? { ...current.bookmark, bookmarked: true }
          : current.bookmark,
      };
    });

    if (result.apiError) {
      setToast({
        message: result.createdOnX
          ? "Saved on X, but Totem could not sync it yet."
          : "Could not bookmark this post right now.",
        linkUrl: tweetUrl,
        linkLabel: "Open on X",
      });
      return;
    }

    if (result.createdOnX) {
      setToast({
        message: "Saved on X. Totem will show the synced bookmark after the next refresh.",
        linkUrl: tweetUrl,
        linkLabel: "Open on X",
      });
    }
  }, [actions, externalReader, openBookmark]);

  const handleExternalUnbookmark = useCallback(async () => {
    if (externalReader?.status !== "ready" || !externalReader.bookmark) return;
    if (externalReader.mutation !== "idle") return;

    const tweetId = externalReader.bookmark.tweetId;
    setExternalReader((current) => current?.status === "ready"
      ? { ...current, mutation: "unbookmarking" }
      : current);

    const { apiError } = await actions.unbookmark(tweetId);
    if (apiError) {
      setExternalReader((current) => current?.status === "ready"
        ? { ...current, mutation: "idle" }
        : current);
      setToast({
        message: "Could not remove this bookmark right now.",
        linkUrl: `https://x.com/i/web/status/${tweetId}`,
        linkLabel: "Open on X",
      });
      return;
    }

    setExternalReader((current) => {
      if (current?.status !== "ready" || !current.bookmark) return current;
      return {
        ...current,
        mutation: "idle",
        bookmark: {
          ...current.bookmark,
          bookmarked: false,
        },
      };
    });
  }, [actions, externalReader]);

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

      // eslint-disable-next-line no-console
      console.log("[Totem] Demo export JSON (copy this):");
      // eslint-disable-next-line no-console
      console.log(json);
      // eslint-disable-next-line no-console
      console.log("[Totem] Demo fixture snippet:");
      // eslint-disable-next-line no-console
      console.log(snippet);

      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(json);
          // eslint-disable-next-line no-console
          console.log("[Totem] Copied JSON to clipboard.");
        } catch {
          // Clipboard may be blocked by browser policy; JSON is still logged.
        }
      }

      return payload;
    };

    return () => {
      delete window.totemExportDemoData;
    };
  }, [bookmarks, settings, themePreference]);

  const mainContent = (() => {
    if (selectedBookmark) {
      return (
        <BookmarkReader
          key={selectedBookmark.tweetId}
          bookmark={selectedBookmark}
          relatedBookmarks={relatedBookmarks}
          onOpenBookmark={openBookmark}
          onBack={closeReader}
          onShuffle={handleShuffle}
          onPrev={hasPrev ? goToPrev : undefined}
          onNext={hasNext ? goToNext : undefined}
          bookmarkAction={offlineMode ? undefined : {
            label: "Unbookmark",
            active: true,
            onClick: async () => {
              const tweetId = selectedBookmark.tweetId;
              const tweetUrl = `https://x.com/i/web/status/${tweetId}`;
              restoreReadingTab();
              setView("reading");
              closeReader();
              const { apiError } = await actions.unbookmark(tweetId);
              if (apiError) {
                setToast({
                  message: "Removed locally. Unbookmark it on X to fully remove.",
                  linkUrl: tweetUrl,
                  linkLabel: "Open on X",
                });
              }
            },
          }}
          onMarkAsRead={markReadingProgressCompleted}
          onMarkAsUnread={markReadingProgressUncompleted}
        />
      );
    }
    if (externalReader?.status === "ready" && externalReader.bookmark) {
      return (
        <BookmarkReader
          key={`external-${externalReader.tweetId}-${externalReader.bookmark.bookmarked ? "saved" : "draft"}`}
          bookmark={externalReader.bookmark}
          relatedBookmarks={externalRelatedBookmarks}
          onOpenBookmark={openBookmark}
          onBack={closeReader}
          onShuffle={handleShuffle}
          bookmarkAction={offlineMode ? undefined : {
            label:
              externalReader.mutation === "bookmarking"
                ? "Bookmarking..."
                : externalReader.mutation === "unbookmarking"
                  ? "Removing..."
                  : externalReader.bookmark.bookmarked
                    ? "Unbookmark"
                    : "Bookmark",
            active: externalReader.bookmark.bookmarked,
            pending: externalReader.mutation !== "idle",
            onClick: externalReader.bookmark.bookmarked
              ? () => {
                void handleExternalUnbookmark();
              }
              : () => {
                void handleExternalBookmark();
              },
          }}
          loadDetail={async (tweetId) => {
            if (tweetId === externalReader.tweetId && externalReader.bookmark) {
              return {
                focalTweet: externalReader.bookmark,
                thread: externalReader.thread,
              };
            }
            return actions.loadReaderDetail(tweetId);
          }}
        />
      );
    }
    if (externalReader?.status === "loading" || externalReader?.status === "error") {
      return (
        <ExternalReaderShell
          tweetId={externalReader.tweetId}
          status={externalReader.status}
          error={externalReader.error}
          onBack={closeReader}
          onRetry={() => {
            setExternalReader((current) => current
              ? {
                ...current,
                status: "loading",
                error: null,
                mutation: "idle",
              }
              : current);
          }}
          onLogin={() => {
            void actions.startLogin();
          }}
        />
      );
    }
    if (view === "reading") {
      return (
        <BookmarksList
          continueReadingItems={continueReading}
          unreadBookmarks={allUnread}
          activeTab={readingTab}
          onTabChange={handleReadingTabChange}
          onOpenBookmark={openBookmark}
          onSync={handleSync}
          onBack={() => setView("home")}
        />
      );
    }
    return (
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
        onOpenBookmark={openBookmark}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenReading={() => { restoreReadingTab(); setView("reading"); }}
        isResetting={isResetting}
      />
    );
  })();

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
