import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { BookmarkReader } from "../../../../../src/components/BookmarkReader";
import { BookmarksList } from "../../../../../src/components/BookmarksList";
import { NewTabHome } from "../../../../../src/components/NewTabHome";
import { SettingsModal } from "../../../../../src/components/SettingsModal";
import { Toast } from "../../../../../src/components/ui/Toast";
import { useContinueReading } from "../../../../../src/hooks/useContinueReading";
import type { UseTodayQueueResult } from "../../../../../src/hooks/useTodayQueue";
import { useTheme } from "../../../../../src/hooks/useTheme";
import { pickRelatedBookmarks } from "../../../../../src/lib/related";
import { LS_READING_TAB } from "../../../../../src/lib/storage-keys";
import type { ReadingTab } from "../../../../../src/lib/reading-list";
import type { TodayQueueHandledReason } from "../../../../../src/lib/today-queue";
import type { FooterState, SyncButtonState } from "../../../../../src/stores/selectors";
import type { ThemePreference } from "../../../../../src/types";
import type {
  Bookmark,
  ReadingProgress,
  SyncStatus,
  ThreadTweet,
  TotemSeedPayload,
  UserSettings,
} from "../../../../../src/types";
import {
  clearAllLocalData,
  ensureReadingProgressExists,
  markReadingProgressCompleted,
  markReadingProgressUncompleted,
  upsertTweetDetailCache,
  upsertReadingProgress,
} from "../../../../../src/db";
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

interface DemoState {
  bookmarks: Bookmark[];
  seedDetails: Record<string, DemoDetailEntry>;
  seedProgress: ReadingProgress[];
  dataReady: boolean;
  syncStatus: SyncStatus;
  view: DemoView;
  selectedTweetId: string | null;
  settingsOpen: boolean;
  settings: UserSettings;
  toast: ToastState | null;
  shuffleSeed: number;
  seedVersion: number;
  readingTab: ReadingTab;
}

interface DemoTodayQueueState {
  activeIds: string[];
  handledReasons: Partial<Record<string, TodayQueueHandledReason>>;
}

type DemoStatePatch = Partial<DemoState> | ((state: DemoState) => Partial<DemoState>);

function isReadingTab(value: string | null): value is ReadingTab {
  return (
    value === "today" ||
    value === "unread" ||
    value === "continue" ||
    value === "read"
  );
}

function readInitialReadingTab(): ReadingTab {
  const stored = localStorage.getItem(DEMO_READING_TAB_KEY);
  return isReadingTab(stored) ? stored : "unread";
}

function createDemoTodayQueueState(bookmarks: Bookmark[]): DemoTodayQueueState {
  const queueIds = bookmarks.slice(0, 5).map((bookmark) => bookmark.tweetId);
  const handledCount = Math.min(2, Math.max(0, queueIds.length - 1));
  const handledReasons: DemoTodayQueueState["handledReasons"] = {};

  for (const tweetId of queueIds.slice(0, handledCount)) {
    handledReasons[tweetId] = "read";
  }

  return {
    activeIds: queueIds.slice(handledCount),
    handledReasons,
  };
}

function createInitialDemoState(): DemoState {
  return {
    bookmarks: [],
    seedDetails: {},
    seedProgress: [],
    dataReady: false,
    syncStatus: "idle",
    view: "home",
    selectedTweetId: null,
    settingsOpen: false,
    settings: DEFAULT_DEMO_SETTINGS,
    toast: null,
    shuffleSeed: 0,
    seedVersion: 0,
    readingTab: readInitialReadingTab(),
  };
}

function demoStateReducer(state: DemoState, patch: DemoStatePatch): DemoState {
  return {
    ...state,
    ...(typeof patch === "function" ? patch(state) : patch),
  };
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

function getDemoReaderHref(tweetId: string): string {
  return `#read=${encodeURIComponent(tweetId)}`;
}

function getDemoReaderTweetId(): string | null {
  const hash = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  const tweetId = new URLSearchParams(hash).get("read")?.trim() ?? "";
  return tweetId || null;
}

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
    showOpenInTotem:
      typeof raw.showOpenInTotem === "boolean"
        ? raw.showOpenInTotem
        : DEFAULT_DEMO_SETTINGS.showOpenInTotem,
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
    recommendationSource:
      raw.recommendationSource === "today" ||
      raw.recommendationSource === "random" ||
      raw.recommendationSource === "pinned"
        ? raw.recommendationSource
        : DEFAULT_DEMO_SETTINGS.recommendationSource,
    todayQueueBudgetMinutes:
      raw.todayQueueBudgetMinutes === 5 ||
      raw.todayQueueBudgetMinutes === 15 ||
      raw.todayQueueBudgetMinutes === 30
        ? raw.todayQueueBudgetMinutes
        : DEFAULT_DEMO_SETTINGS.todayQueueBudgetMinutes,
    defaultHighlightColor:
      typeof raw.defaultHighlightColor === "string"
        ? raw.defaultHighlightColor
        : DEFAULT_DEMO_SETTINGS.defaultHighlightColor,
  };
}

function mergeTheme(value?: ThemePreference): ThemePreference {
  return value === "light" || value === "dark" || value === "system" ? value : "system";
}

function hasVisualPreview(bookmark: Bookmark): boolean {
  const hasMedia =
    Array.isArray(bookmark.media) &&
    bookmark.media.some((item) => Boolean(item?.url || item?.videoUrl));
  const hasCardImage =
    Array.isArray(bookmark.urls) &&
    bookmark.urls.some((item) => Boolean(item?.card?.imageUrl));
  const hasArticleCover = Boolean(bookmark.article?.coverImageUrl);
  return hasMedia || hasCardImage || hasArticleCover;
}

function buildRuntimeSeed(payload: TotemSeedPayload): RuntimeSeed {
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

  const bookmarks: Bookmark[] = [];
  const detailByTweetId: Record<string, DemoDetailEntry> = {};

  for (const [tweetId, detail] of Object.entries(details)) {
    if (!tweetId) continue;

    const fallbackBookmark = bookmarkByTweetId.get(tweetId) ?? null;
    const focal = detail?.focalTweet ?? fallbackBookmark;
    if (!focal) continue;

    const normalizedFocal: Bookmark = {
      ...focal,
      sortIndex: focal.tweetId, // Force sortIndex = tweetId to suppress "New" badge in demo
    };

    detailByTweetId[tweetId] = {
      tweetId,
      focalTweet: normalizedFocal,
      thread: Array.isArray(detail?.thread) ? (detail.thread as ThreadTweet[]) : [],
      fetchedAt: detail?.fetchedAt,
    };

    bookmarks.push(normalizedFocal);
  }

  // If supplied detail entries are text-only, enrich demo with visual bookmarks
  // so media rendering can be previewed without requiring fresh network calls.
  if (bookmarks.length > 0 && !bookmarks.some(hasVisualPreview)) {
    const visualSupplements = (Array.isArray(payload.bookmarks) ? payload.bookmarks : [])
      .filter(
        (bookmark) =>
          Boolean(bookmark?.tweetId) &&
          !detailByTweetId[bookmark.tweetId] &&
          hasVisualPreview(bookmark),
      )
      .slice(0, 24);

    for (const bookmark of visualSupplements) {
      const normalizedBookmark: Bookmark = {
        ...bookmark,
        sortIndex: bookmark.tweetId,
      };
      detailByTweetId[bookmark.tweetId] = {
        tweetId: bookmark.tweetId,
        focalTweet: normalizedBookmark,
        thread: [],
        fetchedAt: Date.now(),
      };
      bookmarks.push(normalizedBookmark);
    }
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

async function loadPayloadFromFile(): Promise<TotemSeedPayload | null> {
  try {
    // Bundled at build time (content-hashed, immutably cached) instead of
    // fetching /demo-data.json — a runtime fetch here once turned into an
    // infinite request loop against production when the seed effect re-ran.
    const data = (await import("../../data/demo-data.json"))
      .default as unknown as Partial<TotemSeedPayload>;
    if (!data || typeof data !== "object") return null;
    if (!data.detailByTweetId || typeof data.detailByTweetId !== "object") return null;

    return {
      version: 1,
      source:
        data.source === "extension-export" ||
        data.source === "demo-fixture" ||
        data.source === "demo-json"
          ? data.source
          : "demo-json",
      bookmarks: Array.isArray(data.bookmarks) ? (data.bookmarks as Bookmark[]) : [],
      detailByTweetId: data.detailByTweetId as Record<string, DemoDetailEntry>,
      readingProgress: Array.isArray(data.readingProgress)
        ? (data.readingProgress as ReadingProgress[])
        : [],
      settings: mergeSettings(
        data.settings && typeof data.settings === "object"
          ? (data.settings as Partial<UserSettings>)
          : undefined,
      ),
      themePreference: mergeTheme(data.themePreference),
      generatedAt: data.generatedAt,
    };
  } catch {
    return null;
  }
}

function useDemoNewTabModel() {
  const { themePreference, setThemePreference } = useTheme();
  const [state, updateState] = useReducer(
    demoStateReducer,
    undefined,
    createInitialDemoState,
  );
  const [demoTodayQueueState, setDemoTodayQueueState] =
    useState<DemoTodayQueueState>(() => createDemoTodayQueueState([]));
  const demoTodayQueueSeedVersionRef = useRef(0);
  const {
    bookmarks,
    seedDetails,
    seedProgress,
    dataReady,
    syncStatus,
    view,
    selectedTweetId,
    settingsOpen,
    settings,
    toast,
    shuffleSeed,
    seedVersion,
    readingTab,
  } = state;
  const syncTimeoutRef = useRef<number | null>(null);

  const { continueReading, allUnread, refresh: refreshContinueReading } =
    useContinueReading(bookmarks);

  const detailedTweetIds = useMemo(
    () => new Set(bookmarks.map((bookmark) => bookmark.tweetId)),
    [bookmarks],
  );

  const openedTweetIds = useMemo(
    () => new Set(continueReading.map((item) => item.progress.tweetId)),
    [continueReading],
  );

  useEffect(() => {
    if (
      seedVersion === 0 ||
      demoTodayQueueSeedVersionRef.current === seedVersion
    ) {
      return;
    }

    demoTodayQueueSeedVersionRef.current = seedVersion;
    setDemoTodayQueueState(createDemoTodayQueueState(bookmarks));
  }, [bookmarks, seedVersion]);

  const restoreDemoTodayQueueItem = useCallback((tweetId: string) => {
    setDemoTodayQueueState((current) => {
      const handledReasons = { ...current.handledReasons };
      delete handledReasons[tweetId];
      return {
        activeIds: current.activeIds.includes(tweetId)
          ? current.activeIds
          : [...current.activeIds, tweetId],
        handledReasons,
      };
    });
  }, []);

  const handleDemoTodayQueueItem = useCallback(
    (tweetId: string, reason: TodayQueueHandledReason) => {
      setDemoTodayQueueState((current) => ({
        activeIds: current.activeIds.filter((id) => id !== tweetId),
        handledReasons: {
          ...current.handledReasons,
          [tweetId]: reason,
        },
      }));
    },
    [],
  );

  const demoTodayQueue = useMemo<UseTodayQueueResult | undefined>(() => {
    const bookmarkByTweetId = new Map(
      bookmarks.map((bookmark) => [bookmark.tweetId, bookmark]),
    );
    const toItem = (bookmark: Bookmark) => ({
      bookmark,
      progress: null,
      metadata: null,
    });
    const activeItems = demoTodayQueueState.activeIds.flatMap((tweetId) => {
      const bookmark = bookmarkByTweetId.get(tweetId);
      return bookmark ? [toItem(bookmark)] : [];
    });
    const handledItems = Object.entries(
      demoTodayQueueState.handledReasons,
    ).flatMap(([tweetId, reason]) => {
      const bookmark = bookmarkByTweetId.get(tweetId);
      return bookmark && reason ? [{ ...toItem(bookmark), reason }] : [];
    });
    const snapshotTweetIds = [
      ...activeItems.map((item) => item.bookmark.tweetId),
      ...handledItems.map((item) => item.bookmark.tweetId),
    ];
    if (snapshotTweetIds.length === 0 && bookmarks.length === 0) return undefined;
    const activeCount = activeItems.length;
    const handledCount = handledItems.length;

    return {
      status: "ready",
      localDate: "demo",
      snapshot: {
        key: "demo",
        localDate: "demo",
        budgetMinutes: settings.todayQueueBudgetMinutes,
        version: 1,
        tweetIds: snapshotTweetIds,
        generatedAt: 0,
      },
      items: activeItems,
      handledItems,
      budgetMinutes: settings.todayQueueBudgetMinutes,
      activeCount,
      handledCount,
      totalCount: snapshotTweetIds.length,
      completedCount: handledItems.filter((item) => item.reason === "read").length,
      isDone: snapshotTweetIds.length > 0 && activeCount === 0,
      canAddMore: false,
      isAddingMore: false,
      refresh: () => {},
      addToTodayQueue: async (tweetId: string) => restoreDemoTodayQueueItem(tweetId),
      addTwoMore: async () => {},
      recordOpen: async () => {},
      recordRead: async (tweetId: string) =>
        handleDemoTodayQueueItem(tweetId, "read"),
      recordPinned: async () => {},
      snooze: async (tweetId: string) =>
        handleDemoTodayQueueItem(tweetId, "snoozed"),
      setIntent: async (tweetId, intent) => {
        if (intent === "reference") {
          handleDemoTodayQueueItem(tweetId, "archived");
        } else if (intent === "act") {
          handleDemoTodayQueueItem(tweetId, "action");
        } else {
          restoreDemoTodayQueueItem(tweetId);
        }
      },
      clearFeedback: async (tweetId: string) => restoreDemoTodayQueueItem(tweetId),
      undoHandled: async (tweetId: string) => restoreDemoTodayQueueItem(tweetId),
    };
  }, [
    bookmarks,
    demoTodayQueueState,
    handleDemoTodayQueueItem,
    restoreDemoTodayQueueItem,
    settings.todayQueueBudgetMinutes,
  ]);
  const selectedBookmark = useMemo(
    () => bookmarks.find((bookmark) => bookmark.tweetId === selectedTweetId) ?? null,
    [bookmarks, selectedTweetId],
  );
  const demoSyncButtonState = useMemo<SyncButtonState>(
    () => ({
      visible: true,
      disabled: syncStatus === "syncing",
      syncing: syncStatus === "syncing",
      title: syncStatus === "syncing" ? "Syncing bookmarks..." : "Sync bookmarks",
    }),
    [syncStatus],
  );
  const demoFooterState = useMemo<FooterState>(() => {
    if (bookmarks.length > 0) return "bookmark_card";
    if (syncStatus === "syncing") return "syncing_bootstrap";
    if (syncStatus === "error") return "sync_error";
    return "empty_can_sync";
  }, [bookmarks.length, syncStatus]);

  useEffect(() => {
    let cancelled = false;

    const applySeed = (payload: DemoPayload, loadedFromFile: boolean) => {
      const seed = buildRuntimeSeed(payload);
      if (cancelled) return;

      setThemePreference(seed.themePreference);
      const toast = loadedFromFile
        ? (() => {
            const count = seed.bookmarks.length;
            const tweetLabel = count === 1 ? "tweet" : "tweets";
            const sourceLabel = seed.source || "bundled demo data";
            return {
              message: `Demo ready: ${count} ${tweetLabel} loaded from ${sourceLabel}.`,
            };
          })()
        : {
            message: "Could not load the bundled demo data, so we loaded fallback demo data.",
          };
      updateState((current) => ({
        bookmarks: seed.bookmarks,
        seedDetails: seed.detailByTweetId,
        seedProgress: seed.readingProgress,
        settings: seed.settings,
        dataReady: true,
        seedVersion: current.seedVersion + 1,
        toast,
      }));
    };

    loadPayloadFromFile().then((payload) => {
      applySeed(payload ?? DEMO_FALLBACK_PAYLOAD, payload !== null);
    }).catch(() => {
      if (cancelled) return;
      applySeed(DEMO_FALLBACK_PAYLOAD, false);
      updateState({
        toast: {
          message: "Demo data failed to load, so fallback fixtures were used.",
        },
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
      await Promise.all([
        ...Object.entries(seedDetails).map(([tweetId, detail]) =>
          upsertTweetDetailCache({
            tweetId,
            fetchedAt: detail.fetchedAt ?? Date.now(),
            focalTweet: detail.focalTweet,
            thread: detail.thread,
          }),
        ),
        ...seedProgress.map((progress) => upsertReadingProgress(progress)),
      ]);
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

  const tabHasItems = useCallback(
    (tab: ReadingTab) => {
      if (tab === "today") return (demoTodayQueue?.totalCount ?? 0) > 0;
      if (tab === "unread") return allUnread.length > 0;
      if (tab === "continue") return continueReading.some((item) => !item.progress.completed);
      return continueReading.some((item) => item.progress.completed);
    },
    [allUnread, continueReading, demoTodayQueue?.totalCount],
  );

  const restoreReadingTab = useCallback(() => {
    const stored = localStorage.getItem(DEMO_READING_TAB_KEY);
    if (isReadingTab(stored) && tabHasItems(stored)) {
      updateState({ readingTab: stored });
    } else {
      updateState({ readingTab: "unread" });
    }
  }, [tabHasItems]);

  const handleReadingTabChange = useCallback(
    (tab: ReadingTab) => {
      updateState({ readingTab: tab });
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

    updateState({ syncStatus: "syncing" });
    syncTimeoutRef.current = window.setTimeout(() => {
      updateState({ syncStatus: "idle" });
      syncTimeoutRef.current = null;
    }, 900);
  }, []);
  const loadDetail = useCallback(
    async (tweetId: string) => {
      const detail = seedDetails[tweetId];
      if (!detail) {
        throw new Error("DETAIL_ERROR");
      }
      return {
        focalTweet: detail.focalTweet,
        thread: detail.thread,
      };
    },
    [seedDetails],
  );

  const openBookmark = useCallback(
    (bookmark: Bookmark) => {
      ensureReadingProgressExists(bookmark.tweetId)
        .then(refreshContinueReading)
        .catch(() => {});
      updateState({ selectedTweetId: bookmark.tweetId });
      window.location.hash = `read=${encodeURIComponent(bookmark.tweetId)}`;
    },
    [refreshContinueReading],
  );

  const closeReader = useCallback(() => {
    updateState({ selectedTweetId: null });
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    refreshContinueReading();
  }, [refreshContinueReading]);

  useEffect(() => {
    const syncReaderFromHash = () => {
      const tweetId = getDemoReaderTweetId();
      if (!tweetId) {
        updateState({ selectedTweetId: null });
        return;
      }
      const target = bookmarks.find((bookmark) => bookmark.tweetId === tweetId) || null;
      updateState({ selectedTweetId: target?.tweetId ?? null });
      if (target) {
        ensureReadingProgressExists(target.tweetId)
          .then(refreshContinueReading)
          .catch(() => {});
      }
    };

    syncReaderFromHash();
    window.addEventListener("hashchange", syncReaderFromHash);
    return () => window.removeEventListener("hashchange", syncReaderFromHash);
  }, [bookmarks, refreshContinueReading]);

  const selectedIndex = selectedBookmark
    ? bookmarks.findIndex((bookmark) => bookmark.tweetId === selectedBookmark.tweetId)
    : -1;
  const hasPrev = selectedIndex > 0;
  const hasNext = selectedIndex >= 0 && selectedIndex < bookmarks.length - 1;

  const handleShuffle = useCallback(() => {
    updateState((current) => ({ shuffleSeed: current.shuffleSeed + 1 }));
  }, []);

  const relatedBookmarks = useMemo(
    () => pickRelatedBookmarks(selectedBookmark, bookmarks, 3, shuffleSeed > 0),
    [bookmarks, selectedBookmark, shuffleSeed],
  );

  const handleDeleteBookmark = useCallback(() => {
    if (!selectedBookmark) return;
    const removedId = selectedBookmark.tweetId;
    updateState((current) => ({
      bookmarks: current.bookmarks.filter((bookmark) => bookmark.tweetId !== removedId),
      view: "reading",
      selectedTweetId: null,
      toast: { message: "Removed from demo queue." },
    }));
    refreshContinueReading();
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
    updateState((current) => ({ settings: { ...current.settings, ...patch } }));
  }, []);

  const resetDemo = useCallback(() => {
    window.location.reload();
  }, []);

  const mainContent = renderDemoContent({
    dataReady,
    selectedBookmark,
    relatedBookmarks,
    bookmarks,
    selectedIndex,
    hasPrev,
    hasNext,
    view,
    continueReading,
    allUnread,
    readingTab,
    demoSyncButtonState,
    detailedTweetIds,
    settings,
    demoTodayQueue,
    openedTweetIds,
    demoFooterState,
    closeReader,
    handleShuffle,
    handleDeleteBookmark,
    handleMarkAsRead,
    handleMarkAsUnread,
    loadDetail,
    handleReadingTabChange,
    openBookmark,
    handleSync,
    updateSettings,
    restoreReadingTab,
    updateState,
  });

  return {
    mainContent,
    resetDemo,
    setThemePreference,
    settings,
    settingsOpen,
    themePreference,
    toast,
    updateSettings,
    updateState,
  };
}

export function DemoNewTabApp() {
  return renderDemoNewTabApp(useDemoNewTabModel());
}

function renderDemoNewTabApp({
  mainContent,
  resetDemo,
  setThemePreference,
  settings,
  settingsOpen,
  themePreference,
  toast,
  updateSettings,
  updateState,
}: ReturnType<typeof useDemoNewTabModel>) {
  return (
    <>
      {mainContent}
      <SettingsModal
        open={settingsOpen}
        onClose={() => updateState({ settingsOpen: false })}
        settings={settings}
        onUpdateSettings={updateSettings}
        themePreference={themePreference}
        onThemePreferenceChange={setThemePreference}
        onResetAppState={resetDemo}
        onDeleteAllData={resetDemo}
        onImport={() => {
          updateState({ toast: { message: "Import is available in the extension." } });
        }}
        onExport={() => {
          updateState({ toast: { message: "Export is available in the extension." } });
        }}
      />
      {toast && (
        <Toast
          message={toast.message}
          onDismiss={() => updateState({ toast: null })}
        />
      )}
    </>
  );
}

interface DemoContentArgs {
  dataReady: boolean;
  selectedBookmark: Bookmark | null;
  relatedBookmarks: Bookmark[];
  bookmarks: Bookmark[];
  selectedIndex: number;
  hasPrev: boolean;
  hasNext: boolean;
  view: DemoView;
  continueReading: ReturnType<typeof useContinueReading>["continueReading"];
  allUnread: Bookmark[];
  readingTab: ReadingTab;
  demoSyncButtonState: SyncButtonState;
  detailedTweetIds: Set<string>;
  settings: UserSettings;
  demoTodayQueue: UseTodayQueueResult | undefined;
  openedTweetIds: Set<string>;
  demoFooterState: FooterState;
  closeReader: () => void;
  handleShuffle: () => void;
  handleDeleteBookmark: () => void;
  handleMarkAsRead: (tweetId: string) => void;
  handleMarkAsUnread: (tweetId: string) => void;
  loadDetail: (tweetId: string) => Promise<{
    focalTweet: Bookmark | null;
    thread: ThreadTweet[];
  }>;
  handleReadingTabChange: (tab: ReadingTab) => void;
  openBookmark: (bookmark: Bookmark) => void;
  handleSync: () => void;
  updateSettings: (patch: Partial<UserSettings>) => void;
  restoreReadingTab: () => void;
  updateState: (patch: DemoStatePatch) => void;
}

function renderDemoContent({
  dataReady,
  selectedBookmark,
  relatedBookmarks,
  bookmarks,
  selectedIndex,
  hasPrev,
  hasNext,
  view,
  continueReading,
  allUnread,
  readingTab,
  demoSyncButtonState,
  detailedTweetIds,
  settings,
  demoTodayQueue,
  openedTweetIds,
  demoFooterState,
  closeReader,
  handleShuffle,
  handleDeleteBookmark,
  handleMarkAsRead,
  handleMarkAsUnread,
  loadDetail,
  handleReadingTabChange,
  openBookmark,
  handleSync,
  updateSettings,
  restoreReadingTab,
  updateState,
}: DemoContentArgs) {
  if (!dataReady) {
    return (
      <div className="min-h-dvh bg-[#0b1118] text-white grid place-items-center px-6 text-center">
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-white/60">Totem Demo</p>
          <h1 className="mt-3 text-2xl font-semibold">Loading demo data</h1>
          <p className="mt-2 text-white/70">Preparing detailed tweets.</p>
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
        getBookmarkHref={(bookmark) => getDemoReaderHref(bookmark.tweetId)}
        onBack={closeReader}
        onShuffle={handleShuffle}
        prevHref={hasPrev ? getDemoReaderHref(bookmarks[selectedIndex - 1].tweetId) : undefined}
        nextHref={hasNext ? getDemoReaderHref(bookmarks[selectedIndex + 1].tweetId) : undefined}
        bookmarkAction={{
          label: "Unbookmark",
          active: true,
          onClick: handleDeleteBookmark,
        }}
        onMarkAsRead={handleMarkAsRead}
        onMarkAsUnread={handleMarkAsUnread}
        loadDetail={loadDetail}
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
        getBookmarkHref={(bookmark) => getDemoReaderHref(bookmark.tweetId)}
        onSync={handleSync}
        onBack={() => updateState({ view: "home" })}
        todayQueue={demoTodayQueue}
        syncButtonStateOverride={demoSyncButtonState}
        offlineModeOverride={false}
      />
    );
  }

  return (
    <NewTabHome
      bookmarks={bookmarks}
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
      getBookmarkHref={(bookmark) => getDemoReaderHref(bookmark.tweetId)}
      recommendationSource={settings.recommendationSource}
      todayQueue={demoTodayQueue}
      onOpenSettings={() => updateState({ settingsOpen: true })}
      onOpenImport={() => {
        updateState({ toast: { message: "Import is available in the extension." } });
      }}
      onOpenExport={() => {
        updateState({ toast: { message: "Export is available in the extension." } });
      }}
      onOpenReading={() => {
        restoreReadingTab();
        updateState({ view: "reading" });
      }}
      footerStateOverride={demoFooterState}
      syncButtonStateOverride={demoSyncButtonState}
      offlineModeOverride={false}
    />
  );
}
