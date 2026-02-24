import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useAuth } from "./hooks/useAuth";
import { useBookmarks, useDetailedTweetIds } from "./hooks/useBookmarks";
import { useTheme } from "./hooks/useTheme";
import { useSettings } from "./hooks/useSettings";
import { useKeyboardNavigation } from "./hooks/useKeyboard";
import { ensureReadingProgressExists, markReadingProgressCompleted, markReadingProgressUncompleted } from "./db";
import { pickRelatedBookmarks } from "./lib/related";
import { resetLocalData } from "./lib/reset";
import { LS_READING_TAB } from "./lib/storage-keys";
import { Onboarding } from "./components/Onboarding";
import { NewTabHome } from "./components/NewTabHome";
import { BookmarkReader } from "./components/BookmarkReader";
import { BookmarksList, type ReadingTab } from "./components/BookmarksList";
import { SettingsModal } from "./components/SettingsModal";
import { TotemLogo } from "./components/TotemLogo";
import { Toast } from "./components/Toast";
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
  const { bookmarks, syncState, refresh, unbookmark } = useBookmarks(isReady);
  const detailedTweetIds = useDetailedTweetIds();
  const {
    continueReading,
    allUnread,
    refresh: refreshContinueReading,
  } = useContinueReading(bookmarks);
  const [view, setView] = useState<AppView>("home");
  const [selectedBookmark, setSelectedBookmark] = useState<Bookmark | null>(
    null,
  );
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

  if (
    selectedBookmark &&
    !bookmarks.some(
      (bookmark) => bookmark.tweetId === selectedBookmark.tweetId,
    )
  ) {
    setSelectedBookmark(null);
  }

  const relatedBookmarks = useMemo(
    () => pickRelatedBookmarks(selectedBookmark, bookmarks, 3, shuffleSeed > 0),
    [selectedBookmark, bookmarks, shuffleSeed],
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
    ? bookmarks.findIndex((b) => b.id === selectedBookmark.id)
    : -1;
  const hasPrev = selectedIndex > 0;
  const hasNext = selectedIndex >= 0 && selectedIndex < bookmarks.length - 1;

  const bookmarksRef = useRef(bookmarks);
  bookmarksRef.current = bookmarks;
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

  const handleResetLocalData = useCallback(async () => {
    await resetLocalData();
    window.location.reload();
  }, []);

  useKeyboardNavigation({
    selectedBookmark,
    filteredBookmarks: bookmarks,
    closeReader,
    setSelectedBookmark,
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const readTweetId = params.get("read");
    if (!readTweetId || bookmarks.length === 0) return;
    const target = bookmarks.find((b) => b.tweetId === readTweetId);
    if (target) {
      openBookmark(target);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [bookmarks, openBookmark]);

  if (phase === "loading") {
    return (
      <div className="flex items-center justify-center min-h-dvh bg-x-bg">
        <div className="animate-logo-shine">
          <TotemLogo className="size-16" />
        </div>
      </div>
    );
  }

  if (phase === "need_login" || phase === "connecting") {
    return <Onboarding phase={phase} onLogin={startLogin} />;
  }

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
          onUnbookmark={async () => {
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
          themePreference={themePreference}
          onThemeChange={setThemePreference}
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
          syncing={syncState.phase === "syncing"}
          activeTab={readingTab}
          onTabChange={handleReadingTabChange}
          onOpenBookmark={openBookmark}
          onSync={refresh}
          onBack={() => setView("home")}
        />
      );
    }
    return (
      <NewTabHome
        bookmarks={bookmarks}
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
