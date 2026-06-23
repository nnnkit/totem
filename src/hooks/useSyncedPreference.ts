import { useEffect, useRef, useState } from "react";
import { hasChromeStorageSync, hasChromeStorageOnChanged } from "../lib/chrome";

type UseSyncedPreferenceOptions = {
  // When this returns true, the async initial load is dropped so it can't
  // clobber a value the user already set before the load resolved.
  skipInitialLoad?: () => boolean;
};

type SetSyncedValue<T> = (next: T | ((prev: T) => T)) => void;

export function useSyncedPreference<T>(
  key: string,
  normalize: (raw: unknown) => T,
  defaultValue: T,
  options: UseSyncedPreferenceOptions = {},
): [T, SetSyncedValue<T>] {
  const [value, setValue] = useState<T>(defaultValue);

  const normalizeRef = useRef(normalize);
  normalizeRef.current = normalize;
  const skipInitialLoadRef = useRef(options.skipInitialLoad);
  skipInitialLoadRef.current = options.skipInitialLoad;

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!hasChromeStorageSync()) return;

      try {
        const stored = await chrome.storage.sync.get({ [key]: defaultValue });
        if (!cancelled && !skipInitialLoadRef.current?.()) {
          setValue(normalizeRef.current(stored[key]));
        }
      } catch {}
    };

    load();
    return () => {
      cancelled = true;
    };
    // defaultValue is intentionally read once at mount; callers pass a stable value.
  }, [key]);

  useEffect(() => {
    if (!hasChromeStorageOnChanged()) return;

    const onStorageChange = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string,
    ) => {
      if (areaName !== "sync") return;
      const change = changes[key];
      if (!change) return;
      setValue(normalizeRef.current(change.newValue));
    };

    chrome.storage.onChanged.addListener(onStorageChange);
    return () => chrome.storage.onChanged.removeListener(onStorageChange);
  }, [key]);

  const setSyncedValue: SetSyncedValue<T> = (next) => {
    setValue((prev) => {
      const resolved =
        typeof next === "function" ? (next as (prev: T) => T)(prev) : next;
      if (hasChromeStorageSync()) {
        chrome.storage.sync.set({ [key]: resolved }).catch(() => {});
      }
      return resolved;
    });
  };

  return [value, setSyncedValue];
}
