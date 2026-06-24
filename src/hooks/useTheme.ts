import { useEffect, useState } from "react";
import { SYNC_THEME } from "../lib/storage-keys";
import { useSyncedPreference } from "./useSyncedPreference";

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
  const [themePreference, setThemePreference] =
    useSyncedPreference<ThemePreference>(
      SYNC_THEME,
      normalizeThemePreference,
      "system",
    );
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(() => getSystemTheme());
  const resolvedTheme: ResolvedTheme =
    themePreference === "system" ? systemTheme : themePreference;

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
    const root = document.documentElement;
    if (themePreference === "system") {
      delete root.dataset.theme;
    } else {
      root.dataset.theme = themePreference;
    }
    root.style.colorScheme = resolvedTheme;
  }, [themePreference, resolvedTheme]);

  return {
    themePreference,
    resolvedTheme,
    setThemePreference,
  };
}
