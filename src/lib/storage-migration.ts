import {
  LEGACY_LOCAL_STORAGE_KEY_MAP,
  LEGACY_CHROME_LOCAL_KEY_MAP,
  LEGACY_CHROME_SYNC_KEY_MAP,
} from "./storage-keys";

type StorageAreaLike = Pick<chrome.storage.StorageArea, "get" | "set" | "remove">;

let localStorageMigrated = false;
let chromeStorageMigrationPromise: Promise<void> | null = null;

function migrateKeyMapInLocalStorage(keyMap: Readonly<Record<string, string>>) {
  for (const [oldKey, newKey] of Object.entries(keyMap)) {
    const oldValue = localStorage.getItem(oldKey);
    if (oldValue === null) continue;
    if (localStorage.getItem(newKey) === null) {
      localStorage.setItem(newKey, oldValue);
    }
    localStorage.removeItem(oldKey);
  }
}

async function migrateKeyMapInStorageArea(
  area: StorageAreaLike | undefined,
  keyMap: Readonly<Record<string, string>>,
) {
  if (!area) return;

  const oldKeys = Object.keys(keyMap);
  const newKeys = Object.values(keyMap);
  const stored = await area.get([...oldKeys, ...newKeys]);
  const updates: Record<string, unknown> = {};
  const removals: string[] = [];

  for (const [oldKey, newKey] of Object.entries(keyMap)) {
    if (stored[oldKey] === undefined) continue;
    if (stored[newKey] === undefined) {
      updates[newKey] = stored[oldKey];
    }
    removals.push(oldKey);
  }

  if (Object.keys(updates).length > 0) {
    await area.set(updates);
  }
  if (removals.length > 0) {
    await area.remove(removals);
  }
}

export function migrateLegacyLocalStorageKeys() {
  if (localStorageMigrated || typeof localStorage === "undefined") return;
  localStorageMigrated = true;
  migrateKeyMapInLocalStorage(LEGACY_LOCAL_STORAGE_KEY_MAP);
}

export function migrateLegacyChromeStorageKeys(): Promise<void> {
  if (chromeStorageMigrationPromise) return chromeStorageMigrationPromise;

  chromeStorageMigrationPromise = (async () => {
    if (typeof chrome === "undefined" || !chrome.storage) return;
    await Promise.all([
      migrateKeyMapInStorageArea(
        chrome.storage.local as StorageAreaLike | undefined,
        LEGACY_CHROME_LOCAL_KEY_MAP,
      ),
      migrateKeyMapInStorageArea(
        chrome.storage.sync as StorageAreaLike | undefined,
        LEGACY_CHROME_SYNC_KEY_MAP,
      ),
    ]);
  })();

  return chromeStorageMigrationPromise;
}
