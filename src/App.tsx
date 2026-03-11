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
import { useContinueReading } from "./hooks/useContinueReading";
import {
  useActiveAccountId,
  useAllBookmarks,
  useDetailedTweetIds,
  useDisplayBookmarks,
  useIsOffline,
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

export default function App() {
  const actions = useRuntimeActions();
  const bookmarks = useAllBookmarks();
  const displayBookmarks = useDisplayBookmarks();
  const detailedTweetIds = useDetailedTweetIds();
  const activeAccountId = useActiveAccountId();
  const offlineMode = useIsOffline();
  const { themePreference, setThemePreference } = useTheme();
  const { settings, updateSettings } = useSettings();
  const [view, setView] = useState<AppView>("home");
  const [selectedBookmarkRaw, setSelectedBookmark] = useState<Bookmark | null>(
    null,
  );
  const readerOpen = selectedBookmarkRaw !== null;

  const selectedBookmark = useMemo(() => {
    if (!selectedBookmarkRaw) return null;
    if (displayBookmarks.some((b) => b.tweetId === selectedBookmarkRaw.tweetId)) {
      return selectedBookmarkRaw;
    }
    return null;
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

  const openedTweetIds = useMemo(
    () => new Set(continueReading.map((item) => item.progress.tweetId)),
    [continueReading],
  );

  const openBookmark = useCallback(
    (bookmark: Bookmark) => {
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
    setSelectedBookmark(null);
    refreshContinueReading();
  }, [refreshContinueReading]);

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
    const params = new URLSearchParams(window.location.search);
    const readTweetId = params.get("read");
    if (!readTweetId || displayBookmarks.length === 0) return;
    const target = displayBookmarks.find((b) => b.tweetId === readTweetId);
    if (target) {
      openBookmark(target);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [displayBookmarks, openBookmark]);

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
          onDeleteBookmark={offlineMode ? undefined : async () => {
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
          }}
          onMarkAsRead={markReadingProgressCompleted}
          onMarkAsUnread={markReadingProgressUncompleted}
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
