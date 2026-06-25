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

  // Mirrors the latest value so setSyncedValue can resolve a functional update
  // and persist OUTSIDE the setState updater. Keeping the updater pure (a plain
  // value, no side effect) stops React's StrictMode / concurrent double-invoke
  // from firing chrome.storage.sync.set twice for a single set.
  const valueRef = useRef(value);
  const applyValue = (next: T) => {
    valueRef.current = next;
    setValue(next);
  };

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
          applyValue(normalizeRef.current(stored[key]));
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
      applyValue(normalizeRef.current(change.newValue));
    };

    chrome.storage.onChanged.addListener(onStorageChange);
    return () => chrome.storage.onChanged.removeListener(onStorageChange);
  }, [key]);

  const setSyncedValue: SetSyncedValue<T> = (next) => {
    const resolved =
      typeof next === "function"
        ? (next as (prev: T) => T)(valueRef.current)
        : next;
    applyValue(resolved);
    if (hasChromeStorageSync()) {
      chrome.storage.sync.set({ [key]: resolved }).catch(() => {});
    }
  };

  return [value, setSyncedValue];
}
