import { useCallback, useEffect, useState } from "react";

export interface TopSite {
  title: string;
  url: string;
  hostname: string;
  faviconUrl: string;
}

async function hasTopSitesPermission(): Promise<boolean> {
  try {
    return await chrome.permissions.contains({ permissions: ["topSites"] });
  } catch {
    return false;
  }
}

export function useTopSites(limit = 8, enabled = true) {
  const [sites, setSites] = useState<TopSite[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSites = useCallback(async () => {
    if (!enabled) {
      setSites([]);
      setLoading(false);
      return;
    }

    const permitted = await hasTopSitesPermission();
    if (!permitted || !chrome.topSites?.get) {
      setSites([]);
      setLoading(false);
      return;
    }

    try {
      const raw = await chrome.topSites.get();
      const mapped: TopSite[] = raw.slice(0, limit).map((s) => {
        const hostname = new URL(s.url).hostname;
        return {
          title: s.title || hostname,
          url: s.url,
          hostname,
          faviconUrl: `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=${encodeURIComponent(s.url)}&size=64`,
        };
      });
      setSites(mapped);
    } catch {
      // topSites unavailable
    } finally {
      setLoading(false);
    }
  }, [limit, enabled]);

  useEffect(() => {
    fetchSites();

    const onVisibility = () => {
      if (document.visibilityState === "visible") fetchSites();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [fetchSites]);

  return { sites, loading };
}
