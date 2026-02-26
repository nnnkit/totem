import { useEffect, useRef, useState } from "react";
import type { BackgroundMode, SearchEngineId, UserSettings } from "../types";
import { hasChromeStorageSync, hasChromeStorageOnChanged } from "../lib/chrome";
import { SYNC_SETTINGS } from "../lib/storage-keys";

const VALID_BACKGROUND_MODES: BackgroundMode[] = ["gradient", "images"];
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
  topSitesLimit: 5,
  backgroundMode: "images",
  searchEngine: "google",
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
  };
}

export function useSettings() {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const userPatchedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!hasChromeStorageSync()) return;

      try {
        const stored = await chrome.storage.sync.get({
          [SYNC_SETTINGS]: DEFAULT_SETTINGS,
        });
        if (!cancelled && !userPatchedRef.current) {
          setSettings(normalizeSettings(stored[SYNC_SETTINGS]));
        }
      } catch {
        // fallback to defaults
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hasChromeStorageOnChanged()) return;

    const onStorageChange = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string,
    ) => {
      if (areaName !== "sync") return;
      const change = changes[SYNC_SETTINGS];
      if (!change) return;
      setSettings(normalizeSettings(change.newValue));
    };

    chrome.storage.onChanged.addListener(onStorageChange);
    return () => chrome.storage.onChanged.removeListener(onStorageChange);
  }, []);

  const updateSettings = (patch: Partial<UserSettings>) => {
    userPatchedRef.current = true;
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      if (hasChromeStorageSync()) {
        chrome.storage.sync.set({ [SYNC_SETTINGS]: next }).catch(() => {});
      }
      return next;
    });
  };

  return { settings, updateSettings };
}
