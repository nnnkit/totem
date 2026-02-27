import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useTheme } from "@ext/hooks/useTheme";
import { useSettings } from "@ext/hooks/useSettings";
import { useKeyboardNavigation } from "@ext/hooks/useKeyboard";
import { useContinueReading } from "@ext/hooks/useContinueReading";
import { pickRelatedBookmarks } from "@ext/lib/related";
import { NewTabHome } from "@ext/components/NewTabHome";
import { BookmarkReader } from "@ext/components/BookmarkReader";
import { BookmarksList, type ReadingTab } from "@ext/components/BookmarksList";
import { SettingsModal } from "@ext/components/SettingsModal";
import { DemoBanner } from "./DemoBanner";
import { MOCK_BOOKMARKS } from "../../mock/bookmarks";
import { deleteBookmarksByTweetIds } from "@ext/db";
import type { Bookmark } from "@ext/types";

type AppView = "home" | "reading";

function CoachingHint({ dismissed }: { dismissed: boolean }) {
  if (dismissed) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center animate-fade-in">
      <div className="pointer-events-auto rounded-full border border-border/50 bg-surface-card/95 px-4 py-2 text-sm text-muted shadow-lg backdrop-blur-sm">
        Press{" "}
        <kbd className="mx-1 inline-flex items-center rounded border border-border bg-background px-1.5 py-0.5 font-mono text-xs font-medium">
          Space
        </kbd>{" "}
        to open a bookmark &middot;{" "}
        <kbd className="mx-1 inline-flex items-center rounded border border-border bg-background px-1.5 py-0.5 font-mono text-xs font-medium">
          L
        </kbd>{" "}
        for reading list
      </div>
    </div>
  );
}

export default function DemoApp() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(MOCK_BOOKMARKS);
  const { themePreference, setThemePreference } = useTheme();
  const { settings, updateSettings } = useSettings();
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
  const [shuffleSeed, setShuffleSeed] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [readingTab, setReadingTab] = useState<ReadingTab>("unread");
  const [openedTweetIds, setOpenedTweetIds] = useState<Set<string>>(new Set());
  const [hintDismissed, setHintDismissed] = useState(false);

  const dismissHint = useCallback(() => {
    if (!hintDismissed) setHintDismissed(true);
  }, [hintDismissed]);

  if (
    selectedBookmark &&
    !bookmarks.some((b) => b.tweetId === selectedBookmark.tweetId)
  ) {
    setSelectedBookmark(null);
  }

  const relatedBookmarks = useMemo(
    () =>
      pickRelatedBookmarks(selectedBookmark, bookmarks, 3, shuffleSeed > 0),
    [selectedBookmark, bookmarks, shuffleSeed],
  );

  // Prev/next navigation
  const bookmarksRef = useRef(bookmarks);
  bookmarksRef.current = bookmarks;
  const selectedRef = useRef(selectedBookmark);
  selectedRef.current = selectedBookmark;

  const selectedIndex = selectedBookmark
    ? bookmarks.findIndex((b) => b.id === selectedBookmark.id)
    : -1;
  const hasPrev = selectedIndex > 0;
  const hasNext = selectedIndex >= 0 && selectedIndex < bookmarks.length - 1;

  const goToPrev = useCallback(() => {
    const bk = bookmarksRef.current;
    const sel = selectedRef.current;
    const idx = bk.findIndex((b) => b.id === sel?.id);
    if (idx > 0) setSelectedBookmark(bk[idx - 1]);
  }, []);

  const goToNext = useCallback(() => {
    const bk = bookmarksRef.current;
    const sel = selectedRef.current;
    const idx = bk.findIndex((b) => b.id === sel?.id);
    if (idx >= 0 && idx < bk.length - 1) setSelectedBookmark(bk[idx + 1]);
  }, []);

  const openBookmark = useCallback((bookmark: Bookmark) => {
    setSelectedBookmark(bookmark);
    setOpenedTweetIds((prev) => new Set(prev).add(bookmark.tweetId));
    setHintDismissed(true);
  }, []);

  const closeReader = useCallback(() => {
    setSelectedBookmark(null);
    refreshContinueReading();
  }, [refreshContinueReading]);

  const handleSync = useCallback(() => {
    setSyncing(true);
    setTimeout(() => setSyncing(false), 1500);
  }, []);

  useKeyboardNavigation({
    selectedBookmark,
    filteredBookmarks: bookmarks,
    closeReader,
    setSelectedBookmark,
  });

  // Auto-dismiss coaching hint after 10s
  useEffect(() => {
    if (hintDismissed) return;
    const timer = setTimeout(() => setHintDismissed(true), 10000);
    return () => clearTimeout(timer);
  }, [hintDismissed]);

  const mainContent = (() => {
    if (selectedBookmark) {
      return (
        <BookmarkReader
          bookmark={selectedBookmark}
          relatedBookmarks={relatedBookmarks}
          onOpenBookmark={openBookmark}
          onBack={closeReader}
          onShuffle={() => setShuffleSeed((s) => s + 1)}
          onPrev={hasPrev ? goToPrev : undefined}
          onNext={hasNext ? goToNext : undefined}
          onDeleteBookmark={() => {
            setBookmarks((prev) =>
              prev.filter((b) => b.tweetId !== selectedBookmark.tweetId),
            );
            closeReader();
          }}
        />
      );
    }
    if (view === "reading") {
      dismissHint();
      return (
        <BookmarksList
          continueReadingItems={continueReading}
          unreadBookmarks={allUnread}
          syncing={syncing}
          activeTab={readingTab}
          onTabChange={setReadingTab}
          onOpenBookmark={openBookmark}
          onSync={handleSync}
          onBack={() => setView("home")}
        />
      );
    }
    return (
      <NewTabHome
        bookmarks={bookmarks}
        syncStatus={syncing ? "syncing" : "idle"}
        detailedTweetIds={new Set(bookmarks.map((b) => b.tweetId))}
        backgroundMode={settings.backgroundMode}
        openedTweetIds={openedTweetIds}
        showTopSites={settings.showTopSites}
        showSearchBar={settings.showSearchBar}
        searchEngine={settings.searchEngine}
        onSearchEngineChange={(engine) => updateSettings({ searchEngine: engine })}
        topSitesLimit={settings.topSitesLimit}
        onSync={handleSync}
        onOpenBookmark={openBookmark}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenReading={() => {
          setView("reading");
          dismissHint();
        }}
      />
    );
  })();

  return (
    <>
      <DemoBanner />
      {mainContent}
      <CoachingHint dismissed={hintDismissed || !!selectedBookmark || view === "reading"} />
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={updateSettings}
        themePreference={themePreference}
        onThemePreferenceChange={setThemePreference}
        onResetLocalData={() => {
          setBookmarks([]);
          deleteBookmarksByTweetIds(MOCK_BOOKMARKS.map((bookmark) => bookmark.tweetId));
        }}
      />
    </>
  );
}
