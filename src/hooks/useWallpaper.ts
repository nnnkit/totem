import { useState } from "react";
import { LOCAL_WALLPAPERS } from "../data/local-wallpapers";
import { generateGradient } from "../lib/gradient";
import { LS_WALLPAPER_INDEX } from "../lib/storage-keys";
import type { BackgroundMode } from "../types";

export interface WallpaperCredit {
  name: string;
  url: string;
}

export interface UseWallpaperResult {
  wallpaperUrl: string | null;
  wallpaperCredit: WallpaperCredit | null;
  gradientCss: string | null;
}

function getNextIndex(): number {
  if (LOCAL_WALLPAPERS.length === 0) return 0;

  const stored = localStorage.getItem(LS_WALLPAPER_INDEX);
  const prev = stored !== null ? parseInt(stored, 10) : -1;
  const next = (prev + 1) % LOCAL_WALLPAPERS.length;
  localStorage.setItem(LS_WALLPAPER_INDEX, String(next));
  return next;
}

function resolveLocalWallpaper(index: number): { url: string; credit: WallpaperCredit } | null {
  if (LOCAL_WALLPAPERS.length === 0) return null;

  const wp = LOCAL_WALLPAPERS[index];
  const url =
    typeof chrome !== "undefined" && chrome.runtime?.getURL
      ? chrome.runtime.getURL(wp.path)
      : wp.path;

  return { url, credit: { name: wp.photographer, url: wp.photographerUrl } };
}

export function useWallpaper(backgroundMode: BackgroundMode): UseWallpaperResult {
  const [gradientCss] = useState(() => generateGradient(String(Date.now())));
  const [wallpaperIndex] = useState(getNextIndex);

  if (backgroundMode === "gradient") {
    return { wallpaperUrl: null, wallpaperCredit: null, gradientCss };
  }

  const local = resolveLocalWallpaper(wallpaperIndex);
  return {
    wallpaperUrl: local?.url ?? null,
    wallpaperCredit: local?.credit ?? null,
    gradientCss,
  };
}
