import { useRef } from "react";
import type {
  BackgroundMode,
  RecommendationSource,
  SearchEngineId,
  TodayQueueBudgetMinutes,
  UserSettings,
} from "../types";
import { SYNC_SETTINGS } from "../lib/storage-keys";
import { useSyncedPreference } from "./useSyncedPreference";
import {
  DEFAULT_HIGHLIGHT_COLOR,
  resolveHighlightColor,
} from "../lib/highlight-colors";

const VALID_BACKGROUND_MODES: BackgroundMode[] = ["gradient", "images"];
const VALID_RECOMMENDATION_SOURCES: RecommendationSource[] = [
  "today",
  "random",
  "pinned",
];
const VALID_TODAY_QUEUE_BUDGETS: TodayQueueBudgetMinutes[] = [5, 15, 30];
const VALID_SEARCH_ENGINES: SearchEngineId[] = [
  "google",
  "bing",
  "duckduckgo",
  "yahoo",
  "brave",
  "ecosia",
  "default",
];

const DEFAULT_SETTINGS: UserSettings = {
  showTopSites: false,
  showSearchBar: true,
  showOpenInTotem: true,
  topSitesLimit: 5,
  backgroundMode: "images",
  searchEngine: "google",
  recommendationSource: "today",
  todayQueueBudgetMinutes: 15,
  defaultHighlightColor: DEFAULT_HIGHLIGHT_COLOR,
};

function normalizeSettings(value: unknown): UserSettings {
  if (!value || typeof value !== "object") return DEFAULT_SETTINGS;
  const raw = value as Record<string, unknown>;
  return {
    showTopSites:
      typeof raw.showTopSites === "boolean"
        ? raw.showTopSites
        : DEFAULT_SETTINGS.showTopSites,
    showSearchBar:
      typeof raw.showSearchBar === "boolean"
        ? raw.showSearchBar
        : DEFAULT_SETTINGS.showSearchBar,
    showOpenInTotem:
      typeof raw.showOpenInTotem === "boolean"
        ? raw.showOpenInTotem
        : DEFAULT_SETTINGS.showOpenInTotem,
    topSitesLimit:
      typeof raw.topSitesLimit === "number" &&
      raw.topSitesLimit >= 1 &&
      raw.topSitesLimit <= 10
        ? raw.topSitesLimit
        : DEFAULT_SETTINGS.topSitesLimit,
    backgroundMode:
      VALID_BACKGROUND_MODES.includes(raw.backgroundMode as BackgroundMode)
        ? (raw.backgroundMode as BackgroundMode)
        : DEFAULT_SETTINGS.backgroundMode,
    searchEngine:
      VALID_SEARCH_ENGINES.includes(raw.searchEngine as SearchEngineId)
        ? (raw.searchEngine as SearchEngineId)
        : DEFAULT_SETTINGS.searchEngine,
    recommendationSource:
      VALID_RECOMMENDATION_SOURCES.includes(raw.recommendationSource as RecommendationSource)
        ? (raw.recommendationSource as RecommendationSource)
        : DEFAULT_SETTINGS.recommendationSource,
    todayQueueBudgetMinutes:
      VALID_TODAY_QUEUE_BUDGETS.includes(
        raw.todayQueueBudgetMinutes as TodayQueueBudgetMinutes,
      )
        ? (raw.todayQueueBudgetMinutes as TodayQueueBudgetMinutes)
        : DEFAULT_SETTINGS.todayQueueBudgetMinutes,
    defaultHighlightColor: resolveHighlightColor(
      typeof raw.defaultHighlightColor === "string"
        ? raw.defaultHighlightColor
        : undefined,
    ),
  };
}

export function useSettings() {
  const userPatchedRef = useRef(false);
  const [settings, setSettings] = useSyncedPreference<UserSettings>(
    SYNC_SETTINGS,
    normalizeSettings,
    DEFAULT_SETTINGS,
    { skipInitialLoad: () => userPatchedRef.current },
  );

  const updateSettings = (patch: Partial<UserSettings>) => {
    userPatchedRef.current = true;
    setSettings((prev) => ({ ...prev, ...patch }));
  };

  return { settings, updateSettings };
}
