import { useEffect, useState } from "react";
import { hasChromeStorageOnChanged } from "../lib/chrome";
import { CS_VIEWER_PROFILE } from "../lib/storage-keys";

export interface ViewerProfile {
  userId: string;
  screenName: string;
  name: string;
  profileImageUrl: string;
  capturedAt: number;
}

function normalizeViewerProfile(value: unknown): ViewerProfile | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const userId = typeof raw.userId === "string" ? raw.userId : "";
  const screenName = typeof raw.screenName === "string" ? raw.screenName : "";
  const name = typeof raw.name === "string" ? raw.name : "";
  const profileImageUrl =
    typeof raw.profileImageUrl === "string" ? raw.profileImageUrl : "";
  const capturedAt = typeof raw.capturedAt === "number" ? raw.capturedAt : 0;

  if (!userId && !screenName && !profileImageUrl) return null;

  return { userId, screenName, name, profileImageUrl, capturedAt };
}

function hasChromeStorageLocal(): boolean {
  return typeof chrome !== "undefined" && Boolean(chrome.storage?.local);
}

function hasChromeRuntimeSendMessage(): boolean {
  return (
    typeof chrome !== "undefined" && Boolean(chrome.runtime?.sendMessage)
  );
}

function requestViewerProfileRefresh(): void {
  if (!hasChromeRuntimeSendMessage()) return;
  chrome.runtime
    .sendMessage({ type: "FETCH_VIEWER_PROFILE" as const })
    .catch(() => {});
}

export function useViewerProfile(): ViewerProfile | null {
  const [profile, setProfile] = useState<ViewerProfile | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!hasChromeStorageLocal()) return;

    chrome.storage.local
      .get(CS_VIEWER_PROFILE)
      .then((stored) => {
        if (cancelled) return;
        const normalized = normalizeViewerProfile(stored[CS_VIEWER_PROFILE]);
        setProfile(normalized);
        if (!normalized) requestViewerProfileRefresh();
      })
      .catch(() => {});

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
      if (areaName !== "local") return;
      const change = changes[CS_VIEWER_PROFILE];
      if (!change) return;
      setProfile(normalizeViewerProfile(change.newValue));
    };

    chrome.storage.onChanged.addListener(onStorageChange);
    return () => chrome.storage.onChanged.removeListener(onStorageChange);
  }, []);

  return profile;
}
