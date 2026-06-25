import { useEffect, useRef, useState } from "react";
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
  // Mirrors useSettings: once the user picks a theme, a slower initial
  // storage.sync load must not clobber that choice when it resolves.
  const userPatchedRef = useRef(false);
  const [themePreference, setSyncedThemePreference] =
    useSyncedPreference<ThemePreference>(
      SYNC_THEME,
      normalizeThemePreference,
      "system",
      { skipInitialLoad: () => userPatchedRef.current },
    );
  const setThemePreference = (
    next: ThemePreference | ((prev: ThemePreference) => ThemePreference),
  ) => {
    userPatchedRef.current = true;
    setSyncedThemePreference(next);
  };
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
