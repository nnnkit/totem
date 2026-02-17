import { useState, useMemo, useEffect, useCallback } from "react";
import { useAuth } from "./hooks/useAuth";
import { useBookmarks } from "./hooks/useBookmarks";
import { useTheme } from "./hooks/useTheme";
import { useSettings } from "./hooks/useSettings";
import { useKeyboardNavigation } from "./hooks/useKeyboard";
import { pickRelatedBookmarks } from "./lib/related";
import { Onboarding } from "./components/Onboarding";
import { NewTabHome } from "./components/NewTabHome";
import { ReaderView } from "./components/ReaderView";
import { ReadingView } from "./components/ReadingView";
import { SettingsModal } from "./components/SettingsModal";
import { useContinueReading } from "./hooks/useContinueReading";
import type { Bookmark } from "./types";

type AppView = "home" | "reading";

export default function App() {
  const { phase } = useAuth();
  const { themePreference, setThemePreference } = useTheme();
  const { settings, updateSettings } = useSettings();
  const isReady = phase === "ready";
  const { bookmarks, syncState, refresh, unbookmark } = useBookmarks(isReady);
  const {
    continueReading,
    allUnread,
    refresh: refreshContinueReading,
  } = useContinueReading(bookmarks);
  const [view, setView] = useState<AppView>("home");
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [selectedBookmark, setSelectedBookmark] = useState<Bookmark | null>(
    null,
  );
  const [unbookmarkingId, setUnbookmarkingId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shuffleSeed, setShuffleSeed] = useState(0);

  useEffect(() => {
    if (!selectedBookmark) return;
    const stillExists = bookmarks.some(
      (bookmark) => bookmark.tweetId === selectedBookmark.tweetId,
    );
    if (!stillExists) {
      setSelectedBookmark(null);
    }
  }, [bookmarks, selectedBookmark]);

  const relatedBookmarks = useMemo(
    () => pickRelatedBookmarks(selectedBookmark, bookmarks, 3, shuffleSeed > 0),
    [selectedBookmark, bookmarks, shuffleSeed],
  );

  const openBookmark = useCallback(
    (bookmark: Bookmark) => {
      setSelectedBookmark(bookmark);
    },
    [],
  );

  const closeReader = useCallback(() => {
    setSelectedBookmark(null);
    refreshContinueReading();
  }, [refreshContinueReading]);

  const handleUnbookmark = useCallback(
    async (tweetId: string) => {
      if (!tweetId || unbookmarkingId === tweetId) return;
      setUnbookmarkingId(tweetId);

      try {
        await unbookmark(tweetId);
        if (selectedBookmark?.tweetId === tweetId) {
          setSelectedBookmark(null);
        }
      } catch {
        // ReaderView already renders inline error states for detail fetches.
      } finally {
        setUnbookmarkingId(null);
      }
    },
    [unbookmark, selectedBookmark, unbookmarkingId],
  );

  useKeyboardNavigation({
    selectedBookmark,
    filteredBookmarks: bookmarks,
    focusedIndex,
    setFocusedIndex,
    openBookmark,
    closeReader,
    setSelectedBookmark,
  });

  // Loading
  if (phase === "loading") {
    return (
      <div className="flex items-center justify-center min-h-dvh bg-x-bg">
        <svg
          viewBox="0 0 24 24"
          className="w-12 h-12 text-x-blue animate-pulse"
          fill="currentColor"
        >
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      </div>
    );
  }

  // Not logged in or connecting
  if (phase === "need_login" || phase === "connecting") {
    return <Onboarding phase={phase} />;
  }

  // Reader view
  if (selectedBookmark) {
    return (
      <>
        <ReaderView
          bookmark={selectedBookmark}
          relatedBookmarks={relatedBookmarks}
          onOpenBookmark={openBookmark}
          themePreference={themePreference}
          onThemePreferenceChange={setThemePreference}
          onBack={closeReader}
          onUnbookmark={handleUnbookmark}
          unbookmarking={unbookmarkingId === selectedBookmark.tweetId}
          onShuffle={() => setShuffleSeed((s) => s + 1)}
        />
        <SettingsModal
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          settings={settings}
          onUpdateSettings={updateSettings}
          themePreference={themePreference}
          onThemePreferenceChange={setThemePreference}
          bookmarks={bookmarks}
        />
      </>
    );
  }

  // Reading view
  if (view === "reading") {
    return (
      <ReadingView
        continueReadingItems={continueReading}
        unreadBookmarks={allUnread}
        onOpenBookmark={openBookmark}
        onBack={() => setView("home")}
      />
    );
  }

  // Home screen
  if (view === "home") {
    return (
      <>
        <NewTabHome
          bookmarks={bookmarks}
          syncing={syncState.phase === "syncing"}
          showTopSites={settings.showTopSites}
          onSync={refresh}
          onOpenBookmark={openBookmark}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenReading={() => setView("reading")}
        />
        <SettingsModal
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          settings={settings}
          onUpdateSettings={updateSettings}
          themePreference={themePreference}
          onThemePreferenceChange={setThemePreference}
          bookmarks={bookmarks}
        />
      </>
    );
  }

  return null;
}
