import { useState, useCallback, useRef, useEffect } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import type { WallpaperCredit } from "../hooks/useWallpaper";

interface UnsplashPhoto {
  id: string;
  description: string | null;
  alt_description: string | null;
  color: string;
  blur_hash: string;
  width: number;
  height: number;
  urls: { raw: string; regular: string };
  links: { download_location: string };
  user: {
    name: string;
    username: string;
    portfolio_url: string | null;
    links: { html: string };
  };
}

interface CuratedPhoto {
  id: string;
  description: string;
  color: string;
  blurHash: string;
  width: number;
  height: number;
  previewUrl: string;
  rawUrl: string;
  downloadLocation: string;
  unsplashUrl: string;
  photographer: {
    name: string;
    username: string;
    profileUrl: string;
    portfolioUrl: string | null;
  };
}

export interface CuratorResult {
  wallpaperUrl: string | null;
  wallpaperCredit: WallpaperCredit | null;
  curatorHud: { count: number; total: number; rateRemaining: number | null; loading: boolean; justSelected: boolean } | null;
}

const MAX_SELECTIONS = 15;

function mapPhoto(photo: UnsplashPhoto): CuratedPhoto {
  return {
    id: photo.id,
    description: photo.description || photo.alt_description || "Untitled",
    color: photo.color,
    blurHash: photo.blur_hash,
    width: photo.width,
    height: photo.height,
    previewUrl: photo.urls.regular,
    rawUrl: photo.urls.raw,
    downloadLocation: photo.links.download_location,
    unsplashUrl: `https://unsplash.com/photos/${photo.id}`,
    photographer: {
      name: photo.user.name,
      username: photo.user.username,
      profileUrl: photo.user.links.html,
      portfolioUrl: photo.user.portfolio_url,
    },
  };
}

export function useUnsplashCurator(): CuratorResult {
  const [photo, setPhoto] = useState<CuratedPhoto | null>(null);
  const [selections, setSelections] = useState<CuratedPhoto[]>([]);
  const [loading, setLoading] = useState(false);
  const [rateRemaining, setRateRemaining] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchNext = useCallback(async () => {
    const key = import.meta.env.VITE_UNSPLASH_ACCESS_KEY;
    if (!key) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    try {
      const res = await fetch(
        "https://api.unsplash.com/photos/random?orientation=landscape&query=nature+wallpaper&content_filter=high",
        {
          headers: { Authorization: `Client-ID ${key}` },
          signal: controller.signal,
        },
      );
      const remaining = res.headers.get("X-Ratelimit-Remaining");
      if (remaining) setRateRemaining(Number(remaining));
      if (!res.ok) return;
      const data: UnsplashPhoto = await res.json();
      setPhoto(mapPhoto(data));
    } catch {
      // ignore abort errors
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNext();
  }, [fetchNext]);

  const [justSelected, setJustSelected] = useState(false);
  const selectCurrent = useCallback(() => {
    if (!photo) return;
    if (selections.length >= MAX_SELECTIONS) return;
    if (selections.some((s) => s.id === photo.id)) return;
    const next = [...selections, photo];
    setSelections(next);
    setJustSelected(true);
    if (next.length >= MAX_SELECTIONS) {
      const blob = new Blob([JSON.stringify(next, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "curated-wallpapers.json";
      a.click();
      URL.revokeObjectURL(url);
    } else {
      setTimeout(() => fetchNext(), 600);
    }
  }, [photo, selections, fetchNext]);

  useHotkeys("space", (e) => { e.preventDefault(); setJustSelected(false); if (!loading) fetchNext(); }, [loading, fetchNext]);
  useHotkeys("y", () => selectCurrent(), [selectCurrent]);
  useHotkeys("e", () => {
    if (selections.length === 0) return;
    const blob = new Blob([JSON.stringify(selections, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "curated-wallpapers.json";
    a.click();
    URL.revokeObjectURL(url);
  }, [selections]);

  return {
    wallpaperUrl: photo?.previewUrl ?? null,
    wallpaperCredit: photo
      ? { name: photo.photographer.name, url: photo.photographer.profileUrl }
      : null,
    curatorHud: {
      count: selections.length,
      total: MAX_SELECTIONS,
      rateRemaining,
      loading,
      justSelected,
    },
  };
}
