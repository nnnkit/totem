import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useAuth } from "./hooks/useAuth";
import { useBookmarks, useDetailedTweetIds } from "./hooks/useBookmarks";
import { usePrefetchDetails } from "./hooks/usePrefetchDetails";
import { useTheme } from "./hooks/useTheme";
import { useSettings } from "./hooks/useSettings";
import { useKeyboardNavigation } from "./hooks/useKeyboard";
import { ensureReadingProgressExists, markReadingProgressCompleted, markReadingProgressUncompleted } from "./db";
import { pickRelatedBookmarks } from "./lib/related";
import { resetLocalData } from "./lib/reset";
import { LS_READING_TAB } from "./lib/storage-keys";
import { NewTabHome } from "./components/NewTabHome";
import { BookmarkReader } from "./components/BookmarkReader";
import { BookmarksList, type ReadingTab } from "./components/BookmarksList";
import { SettingsModal } from "./components/SettingsModal";
import { Toast } from "./components/ui/Toast";
import { useContinueReading } from "./hooks/useContinueReading";
import type { Bookmark } from "./types";

interface ToastState {
  message: string;
  linkUrl?: string;
  linkLabel?: string;
}

type AppView = "home" | "reading";

export default function App() {
  const { phase, startLogin } = useAuth();
  const { themePreference, setThemePreference } = useTheme();
  const { settings, updateSettings } = useSettings();
  const isReady = phase === "ready";
  const isLoggedOut = phase === "need_login";
  const { bookmarks, syncState, dispatch, refresh, unbookmark } = useBookmarks(isReady);
  const hasBookmarks = "total" in syncState && syncState.total > 0;
  const offlineMode = isLoggedOut && hasBookmarks;
  const connectingWithCache = phase === "connecting" && hasBookmarks;
  const showCached = offlineMode || connectingWithCache;
  const [view, setView] = useState<AppView>("home");
  const [selectedBookmarkRaw, setSelectedBookmark] = useState<Bookmark | null>(
    null,
  );
  const readerOpen = selectedBookmarkRaw !== null;
  const { prefetchedCount } = usePrefetchDetails(bookmarks, isReady, readerOpen);
  const { ids: detailedTweetIds, loaded: detailedIdsLoaded } = useDetailedTweetIds(prefetchedCount);

  const displayBookmarks = useMemo(() => {
    if (!offlineMode) return bookmarks;
    return bookmarks.filter((b) => detailedTweetIds.has(b.tweetId));
  }, [bookmarks, detailedTweetIds, offlineMode]);

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
  } = useContinueReading(displayBookmarks);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [readingTab, setReadingTab] = useState<ReadingTab>(() => {
    const stored = localStorage.getItem(LS_READING_TAB);
    if (stored === "unread" || stored === "continue" || stored === "read") return stored;
    return "unread";
  });
  const handleReadingTabChange = useCallback((tab: ReadingTab) => {
    setReadingTab(tab);
    localStorage.setItem(LS_READING_TAB, tab);
  }, []);
  const [toast, setToast] = useState<ToastState | null>(null);
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
      ensureReadingProgressExists(bookmark.tweetId).then(refreshContinueReading);
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

  const handleResetLocalData = useCallback(() => {
    dispatch({ type: "RESET" });
    resetLocalData().catch(() => {}).finally(() => window.location.reload());
  }, [dispatch]);

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

  const bookmarksLoading =
    phase === "loading" ||
    syncState.phase === "booting" ||
    (offlineMode && !detailedIdsLoaded);

  const needsLogin = !showCached && (phase === "need_login" || phase === "connecting");

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
            setView("reading");
            closeReader();
            const { apiError } = await unbookmark(tweetId);
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
          onLogin={offlineMode ? startLogin : undefined}
        />
      );
    }
    if (view === "reading") {
      return (
        <BookmarksList
          continueReadingItems={continueReading}
          unreadBookmarks={allUnread}
          syncing={syncState.phase === "hard_syncing" || syncState.phase === "soft_syncing"}
          activeTab={readingTab}
          onTabChange={handleReadingTabChange}
          onOpenBookmark={openBookmark}
          onSync={refresh}
          onBack={() => setView("home")}
          offlineMode={offlineMode}
          onLogin={offlineMode ? startLogin : undefined}
        />
      );
    }
    return (
      <NewTabHome
        bookmarks={displayBookmarks}
        syncState={syncState}
        onSync={refresh}
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
        onOpenReading={() => setView("reading")}
        offlineMode={offlineMode}
        authPhase={needsLogin ? phase : undefined}
        onLogin={needsLogin || offlineMode ? startLogin : undefined}
        bookmarksLoading={bookmarksLoading}
        isResetting={syncState.phase === "resetting"}
      />
    );
  })();

  return (
    <>
      {mainContent}
      <SettingsModal
        open={settingsOpen}
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
