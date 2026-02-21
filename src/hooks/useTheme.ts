import { useCallback, useEffect, useMemo, useState } from "react";
import { hasChromeStorageSync, hasChromeStorageOnChanged } from "../lib/chrome";
import { SYNC_THEME } from "../lib/storage-keys";

export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "dark";
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function normalizeThemePreference(value: unknown): ThemePreference {
  return value === "light" || value === "dark" || value === "system"
    ? value
    : "system";
}

export function useTheme() {
  const [themePreference, setThemePreference] = useState<ThemePreference>("system");
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(() => getSystemTheme());
  const resolvedTheme: ResolvedTheme = useMemo(
    () => (themePreference === "system" ? systemTheme : themePreference),
    [themePreference, systemTheme],
  );

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (event: MediaQueryListEvent) => {
      setSystemTheme(event.matches ? "dark" : "light");
    };

    setSystemTheme(mediaQuery.matches ? "dark" : "light");
    mediaQuery.addEventListener("change", onChange);
    return () => mediaQuery.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadPreference = async () => {
      if (!hasChromeStorageSync()) return;

      try {
        const stored = await chrome.storage.sync.get({
          [SYNC_THEME]: "system",
        });
        if (!cancelled) {
          setThemePreference(normalizeThemePreference(stored[SYNC_THEME]));
        }
      } catch {
        // Use default system preference if sync storage is not available.
      }
    };

    loadPreference();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (themePreference === "system") {
      delete root.dataset.theme;
    } else {
      root.dataset.theme = themePreference;
    }
    root.style.colorScheme = resolvedTheme;
  }, [themePreference, resolvedTheme]);

  useEffect(() => {
    if (!hasChromeStorageOnChanged()) return;

    const onStorageChange = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string,
    ) => {
      if (areaName !== "sync") return;
      const change = changes[SYNC_THEME];
      if (!change) return;
      setThemePreference(normalizeThemePreference(change.newValue));
    };

    chrome.storage.onChanged.addListener(onStorageChange);
    return () => chrome.storage.onChanged.removeListener(onStorageChange);
  }, []);

  const updateThemePreference = useCallback((pref: ThemePreference) => {
    setThemePreference(pref);
    if (hasChromeStorageSync()) {
      chrome.storage.sync.set({ [SYNC_THEME]: pref }).catch(() => {});
    }
  }, []);

  return {
    themePreference,
    resolvedTheme,
    setThemePreference: updateThemePreference,
  };
}
