import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NewTabHome } from "../../../src/components/NewTabHome";
import { BookmarksList, type ReadingTab } from "../../../src/components/BookmarksList";
import { BookmarkReader } from "../../../src/components/BookmarkReader";
import { SettingsModal } from "../../../src/components/SettingsModal";
import { Toast } from "../../../src/components/ui/Toast";
import { useContinueReading } from "../../../src/hooks/useContinueReading";
import { useTheme, type ThemePreference } from "../../../src/hooks/useTheme";
import { pickRelatedBookmarks } from "../../../src/lib/related";
import { LS_READING_TAB } from "../../../src/lib/storage-keys";
import {
  clearAllLocalData,
  ensureReadingProgressExists,
  markReadingProgressCompleted,
  markReadingProgressUncompleted,
  upsertTweetDetailCache,
  upsertReadingProgress,
} from "../../../src/db";
import type {
  Bookmark,
  ReadingProgress,
  SyncStatus,
  ThreadTweet,
  UserSettings,
} from "../../../src/types";
import {
  DEFAULT_DEMO_SETTINGS,
  DEMO_FALLBACK_PAYLOAD,
  type DemoDetailEntry,
  type DemoPayload,
} from "./fixtures";

type DemoView = "home" | "reading";

interface ToastState {
  message: string;
}

interface RuntimeSeed {
  bookmarks: Bookmark[];
  detailByTweetId: Record<string, DemoDetailEntry>;
  readingProgress: ReadingProgress[];
  settings: UserSettings;
  themePreference: ThemePreference;
  source: string;
}

const DEMO_READING_TAB_KEY = `${LS_READING_TAB}:website-demo`;
const DEMO_DATA_URL = "data.json";

function mergeSettings(raw?: Partial<UserSettings>): UserSettings {
  if (!raw) return DEFAULT_DEMO_SETTINGS;

  const topSitesLimit =
    typeof raw.topSitesLimit === "number" && raw.topSitesLimit >= 1 && raw.topSitesLimit <= 10
      ? raw.topSitesLimit
      : DEFAULT_DEMO_SETTINGS.topSitesLimit;

  return {
    showTopSites:
      typeof raw.showTopSites === "boolean"
        ? raw.showTopSites
        : DEFAULT_DEMO_SETTINGS.showTopSites,
    showSearchBar:
      typeof raw.showSearchBar === "boolean"
        ? raw.showSearchBar
        : DEFAULT_DEMO_SETTINGS.showSearchBar,
    topSitesLimit,
    backgroundMode:
      raw.backgroundMode === "gradient" || raw.backgroundMode === "images"
        ? raw.backgroundMode
        : DEFAULT_DEMO_SETTINGS.backgroundMode,
    searchEngine:
      raw.searchEngine === "google" ||
      raw.searchEngine === "bing" ||
      raw.searchEngine === "duckduckgo" ||
      raw.searchEngine === "yahoo" ||
      raw.searchEngine === "brave" ||
      raw.searchEngine === "ecosia" ||
      raw.searchEngine === "default"
        ? raw.searchEngine
        : DEFAULT_DEMO_SETTINGS.searchEngine,
  };
}

function mergeTheme(value?: ThemePreference): ThemePreference {
  return value === "light" || value === "dark" || value === "system" ? value : "system";
}

function buildRuntimeSeed(payload: DemoPayload): RuntimeSeed {
  const bookmarkByTweetId = new Map(
    (Array.isArray(payload.bookmarks) ? payload.bookmarks : []).map((bookmark) => [
      bookmark.tweetId,
      bookmark,
    ]),
  );

  const details =
    payload.detailByTweetId && typeof payload.detailByTweetId === "object"
      ? payload.detailByTweetId
      : {};

  const fallbackThreads = payload.threadByTweetId ?? {};
  const bookmarks: Bookmark[] = [];
  const detailByTweetId: Record<string, DemoDetailEntry> = {};

  for (const [tweetId, detail] of Object.entries(details)) {
    if (!tweetId) continue;

    const candidateThread = Array.isArray(detail?.thread)
      ? detail.thread
      : Array.isArray(fallbackThreads[tweetId])
        ? fallbackThreads[tweetId]
        : [];

    const fallbackBookmark = bookmarkByTweetId.get(tweetId) ?? null;
    const focal = detail?.focalTweet ?? fallbackBookmark;
    if (!focal) continue;

    const normalizedFocal: Bookmark = {
      ...focal,
      sortIndex: focal.tweetId, // Force sortIndex = tweetId to suppress "New" badge in demo
    };

    detailByTweetId[tweetId] = {
      focalTweet: normalizedFocal,
      thread: candidateThread as ThreadTweet[],
      fetchedAt: detail?.fetchedAt,
    };

    bookmarks.push(normalizedFocal);
  }

  bookmarks.sort((a, b) => b.sortIndex.localeCompare(a.sortIndex));

  const visibleTweetIds = new Set(bookmarks.map((bookmark) => bookmark.tweetId));
  const readingProgress = (payload.readingProgress ?? []).filter(
    (progress) => visibleTweetIds.has(progress.tweetId),
  );

  return {
    bookmarks,
    detailByTweetId,
    readingProgress,
    settings: mergeSettings(payload.settings),
    themePreference: mergeTheme(payload.themePreference),
    source: payload.source ?? "payload",
  };
}

async function loadPayloadFromFile(): Promise<DemoPayload | null> {
  try {
    const response = await fetch(DEMO_DATA_URL, { cache: "no-store" });
    if (!response.ok) return null;

    const data = (await response.json()) as Partial<DemoPayload>;
    if (!data || typeof data !== "object") return null;
    if (!data.detailByTweetId || typeof data.detailByTweetId !== "object") return null;

    return {
      bookmarks: Array.isArray(data.bookmarks) ? (data.bookmarks as Bookmark[]) : [],
      detailByTweetId: data.detailByTweetId as Record<string, DemoDetailEntry>,
      threadByTweetId:
        data.threadByTweetId && typeof data.threadByTweetId === "object"
          ? (data.threadByTweetId as Record<string, ThreadTweet[]>)
          : undefined,
      readingProgress: Array.isArray(data.readingProgress)
        ? (data.readingProgress as ReadingProgress[])
        : [],
      settings:
        data.settings && typeof data.settings === "object"
          ? (data.settings as Partial<UserSettings>)
          : undefined,
      themePreference: mergeTheme(data.themePreference),
      generatedAt: data.generatedAt,
      source: data.source,
    };
  } catch {
    return null;
  }
}

export function DemoNewTabApp() {
  const { themePreference, setThemePreference } = useTheme();
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [seedDetails, setSeedDetails] = useState<Record<string, DemoDetailEntry>>({});
  const [seedProgress, setSeedProgress] = useState<ReadingProgress[]>([]);
  const [dataReady, setDataReady] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [view, setView] = useState<DemoView>("home");
  const [selectedBookmark, setSelectedBookmark] = useState<Bookmark | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_DEMO_SETTINGS);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [shuffleSeed, setShuffleSeed] = useState(0);
  const [seedVersion, setSeedVersion] = useState(0);
  const syncTimeoutRef = useRef<number | null>(null);

  const { continueReading, allUnread, refresh: refreshContinueReading } =
    useContinueReading(bookmarks);

  const [readingTab, setReadingTab] = useState<ReadingTab>(() => {
    const stored = localStorage.getItem(DEMO_READING_TAB_KEY);
    if (stored === "unread" || stored === "continue" || stored === "read") {
      return stored;
    }
    return "unread";
  });

  const detailedTweetIds = useMemo(
    () => new Set(bookmarks.map((bookmark) => bookmark.tweetId)),
    [bookmarks],
  );

  const openedTweetIds = useMemo(
    () => new Set(continueReading.map((item) => item.progress.tweetId)),
    [continueReading],
  );

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const payload = (await loadPayloadFromFile()) ?? DEMO_FALLBACK_PAYLOAD;
      const seed = buildRuntimeSeed(payload);

      if (cancelled) return;

      setBookmarks(seed.bookmarks);
      setSeedDetails(seed.detailByTweetId);
      setSeedProgress(seed.readingProgress);
      setSettings(seed.settings);
      setThemePreference(seed.themePreference);
      setDataReady(true);
      setSeedVersion((value) => value + 1);

      if (payload !== DEMO_FALLBACK_PAYLOAD) {
        setToast({
          message: `Loaded ${seed.bookmarks.length} detailed tweets from ${seed.source || "data.json"}.`,
        });
      } else {
        setToast({
          message: "Could not load website/data.json. Using fallback demo data.",
        });
      }
    };

    load().catch(() => {
      if (cancelled) return;
      const seed = buildRuntimeSeed(DEMO_FALLBACK_PAYLOAD);
      setBookmarks(seed.bookmarks);
      setSeedDetails(seed.detailByTweetId);
      setSeedProgress(seed.readingProgress);
      setSettings(seed.settings);
      setThemePreference(seed.themePreference);
      setDataReady(true);
      setSeedVersion((value) => value + 1);
      setToast({
        message: "Demo load failed. Using fallback fixtures.",
      });
    });

    return () => {
      cancelled = true;
    };
  }, [setThemePreference]);

  useEffect(() => {
    if (seedVersion === 0) return;

    let cancelled = false;

    const seedProgressState = async () => {
      await clearAllLocalData();
      for (const [tweetId, detail] of Object.entries(seedDetails)) {
        await upsertTweetDetailCache({
          tweetId,
          fetchedAt: detail.fetchedAt ?? Date.now(),
          focalTweet: detail.focalTweet,
          thread: detail.thread,
        });
      }
      for (const progress of seedProgress) {
        await upsertReadingProgress(progress);
      }
      if (!cancelled) {
        refreshContinueReading();
      }
    };

    seedProgressState()
      .then(() => {
        if (!cancelled) refreshContinueReading();
      })
      .catch(() => {
        if (!cancelled) refreshContinueReading();
      });

    return () => {
      cancelled = true;
    };
  }, [refreshContinueReading, seedDetails, seedProgress, seedVersion]);

  useEffect(
    () => () => {
      if (syncTimeoutRef.current !== null) {
        window.clearTimeout(syncTimeoutRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (!selectedBookmark) return;
    const stillExists = bookmarks.some((bookmark) => bookmark.tweetId === selectedBookmark.tweetId);
    if (!stillExists) {
      setSelectedBookmark(null);
    }
  }, [bookmarks, selectedBookmark]);

  const tabHasItems = useCallback(
    (tab: ReadingTab) => {
      if (tab === "unread") return allUnread.length > 0;
      if (tab === "continue") return continueReading.some((item) => !item.progress.completed);
      return continueReading.some((item) => item.progress.completed);
    },
    [allUnread, continueReading],
  );

  const restoreReadingTab = useCallback(() => {
    const stored = localStorage.getItem(DEMO_READING_TAB_KEY);
    if (stored === "unread" || stored === "continue" || stored === "read") {
      setReadingTab(stored);
    } else {
      setReadingTab("unread");
    }
  }, []);

  const handleReadingTabChange = useCallback(
    (tab: ReadingTab) => {
      setReadingTab(tab);
      if (tabHasItems(tab)) {
        localStorage.setItem(DEMO_READING_TAB_KEY, tab);
      }
    },
    [tabHasItems],
  );

  const handleSync = useCallback(() => {
    if (syncTimeoutRef.current !== null) {
      window.clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = null;
    }

    setSyncStatus("syncing");
    syncTimeoutRef.current = window.setTimeout(() => {
      setSyncStatus("idle");
      syncTimeoutRef.current = null;
    }, 900);
  }, []);

  const openBookmark = useCallback(
    (bookmark: Bookmark) => {
      ensureReadingProgressExists(bookmark.tweetId)
        .then(refreshContinueReading)
        .catch(() => {});
      setSelectedBookmark(bookmark);
    },
    [refreshContinueReading],
  );

  const closeReader = useCallback(() => {
    setSelectedBookmark(null);
    refreshContinueReading();
  }, [refreshContinueReading]);

  const selectedIndex = selectedBookmark
    ? bookmarks.findIndex((bookmark) => bookmark.tweetId === selectedBookmark.tweetId)
    : -1;
  const hasPrev = selectedIndex > 0;
  const hasNext = selectedIndex >= 0 && selectedIndex < bookmarks.length - 1;

  const goToPrev = useCallback(() => {
    if (selectedIndex <= 0) return;
    setSelectedBookmark(bookmarks[selectedIndex - 1]);
  }, [bookmarks, selectedIndex]);

  const goToNext = useCallback(() => {
    if (selectedIndex < 0 || selectedIndex >= bookmarks.length - 1) return;
    setSelectedBookmark(bookmarks[selectedIndex + 1]);
  }, [bookmarks, selectedIndex]);

  const handleShuffle = useCallback(() => {
    setShuffleSeed((seed) => seed + 1);
  }, []);

  const relatedBookmarks = useMemo(
    () => pickRelatedBookmarks(selectedBookmark, bookmarks, 3, shuffleSeed > 0),
    [bookmarks, selectedBookmark, shuffleSeed],
  );

  const handleDeleteBookmark = useCallback(() => {
    if (!selectedBookmark) return;
    const removedId = selectedBookmark.tweetId;
    setBookmarks((current) => current.filter((bookmark) => bookmark.tweetId !== removedId));
    setView("reading");
    setSelectedBookmark(null);
    refreshContinueReading();
    setToast({ message: "Removed from demo queue." });
  }, [refreshContinueReading, selectedBookmark]);

  const handleMarkAsRead = useCallback(
    (tweetId: string) => {
      markReadingProgressCompleted(tweetId)
        .then(refreshContinueReading)
        .catch(() => {});
    },
    [refreshContinueReading],
  );

  const handleMarkAsUnread = useCallback(
    (tweetId: string) => {
      markReadingProgressUncompleted(tweetId)
        .then(refreshContinueReading)
        .catch(() => {});
    },
    [refreshContinueReading],
  );

  const updateSettings = useCallback((patch: Partial<UserSettings>) => {
    setSettings((current) => ({ ...current, ...patch }));
  }, []);

  const resetDemo = useCallback(() => {
    window.location.reload();
  }, []);

  const mainContent = (() => {
    if (!dataReady) {
      return (
        <div className="min-h-dvh bg-[#0b1118] text-white grid place-items-center px-6 text-center">
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-white/60">Totem Demo</p>
            <h1 className="mt-3 text-2xl font-semibold">Loading demo data</h1>
            <p className="mt-2 text-white/70">Preparing detailed tweets from <code>website/data.json</code>.</p>
          </div>
        </div>
      );
    }

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
          onDeleteBookmark={handleDeleteBookmark}
          onMarkAsRead={handleMarkAsRead}
          onMarkAsUnread={handleMarkAsUnread}
        />
      );
    }

    if (view === "reading") {
      return (
        <BookmarksList
          continueReadingItems={continueReading}
          unreadBookmarks={allUnread}
          syncing={syncStatus === "syncing"}
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
        bookmarks={bookmarks}
        syncStatus={syncStatus}
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
        onOpenReading={() => {
          restoreReadingTab();
          setView("reading");
        }}
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
        onResetLocalData={resetDemo}
      />
      {toast && (
        <Toast
          message={toast.message}
          onDismiss={() => setToast(null)}
        />
      )}
    </>
  );
}
