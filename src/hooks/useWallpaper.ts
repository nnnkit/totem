import { useState } from "react";
import { LOCAL_WALLPAPERS } from "../data/local-wallpapers";
import { generateGradient } from "../lib/gradient";
import type { BackgroundMode } from "../types";

export interface UseWallpaperResult {
  wallpaperUrl: string | null;
  wallpaperTitle: string | null;
  gradientCss: string | null;
}

function todayLocal(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function resolveLocalWallpaper(): { url: string; title: string } | null {
  if (LOCAL_WALLPAPERS.length === 0) return null;

  const index = simpleHash(todayLocal()) % LOCAL_WALLPAPERS.length;
  const wp = LOCAL_WALLPAPERS[index];

  const url =
    typeof chrome !== "undefined" && chrome.runtime?.getURL
      ? chrome.runtime.getURL(wp.path)
      : wp.path;

  return { url, title: wp.title };
}

export function useWallpaper(backgroundMode: BackgroundMode): UseWallpaperResult {
  const [gradientCss] = useState(() => generateGradient(String(Date.now())));

  if (backgroundMode === "gradient") {
    return { wallpaperUrl: null, wallpaperTitle: null, gradientCss };
  }

  const local = resolveLocalWallpaper();
  return {
    wallpaperUrl: local?.url ?? null,
    wallpaperTitle: local?.title ?? null,
    gradientCss,
  };
}
