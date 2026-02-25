import { clearAllLocalData, closeDb } from "../db";
import {
  IDB_DATABASE_NAME,
  LEGACY_IDB_DATABASE_NAME,
  LOCAL_STORAGE_KEYS,
  CHROME_SYNC_KEYS,
  LEGACY_LOCAL_STORAGE_KEY_MAP,
  LEGACY_CHROME_SYNC_KEY_MAP,
  LEGACY_CHROME_LOCAL_KEY_MAP,
  CS_DB_CLEANUP_AT,
  CS_LAST_RECONCILE,
  CS_LAST_SYNC,
  CS_BOOKMARK_EVENTS,
  CS_LAST_SOFT_SYNC,
  CS_SOFT_SYNC_NEEDED,
} from "./storage-keys";

// chrome.storage.local keys to remove on reset.
// Auth and query-ID keys are intentionally preserved so the auth flow
// doesn't re-trigger and open a background tab.
const CHROME_LOCAL_RESET_KEYS = [
  CS_DB_CLEANUP_AT,
  CS_LAST_RECONCILE,
  CS_LAST_SYNC,
  CS_BOOKMARK_EVENTS,
  CS_LAST_SOFT_SYNC,
  CS_SOFT_SYNC_NEEDED,
];

const IDB_DATABASE_NAMES = Array.from(
  new Set([IDB_DATABASE_NAME, LEGACY_IDB_DATABASE_NAME]),
);

const LOCAL_STORAGE_RESET_KEYS = Array.from(
  new Set([
    ...LOCAL_STORAGE_KEYS,
    ...Object.keys(LEGACY_LOCAL_STORAGE_KEY_MAP),
  ]),
);

const CHROME_LOCAL_RESET_KEYS_WITH_LEGACY = Array.from(
  new Set([
    ...CHROME_LOCAL_RESET_KEYS,
    ...Object.keys(LEGACY_CHROME_LOCAL_KEY_MAP),
  ]),
);

const CHROME_SYNC_RESET_KEYS = Array.from(
  new Set([
    ...CHROME_SYNC_KEYS,
    ...Object.keys(LEGACY_CHROME_SYNC_KEY_MAP),
  ]),
);

export async function resetLocalData(): Promise<void> {
  // 1. Clear all IndexedDB object stores, then delete the database entirely
  try {
    await clearAllLocalData();
    closeDb();
    for (const dbName of IDB_DATABASE_NAMES) {
      indexedDB.deleteDatabase(dbName);
    }
  } catch {
    try {
      for (const dbName of IDB_DATABASE_NAMES) {
        indexedDB.deleteDatabase(dbName);
      }
    } catch {
      // best-effort
    }
  }

  // 2. Remove all known localStorage keys
  if (typeof localStorage !== "undefined") {
    for (const key of LOCAL_STORAGE_RESET_KEYS) {
      localStorage.removeItem(key);
    }
  }

  // 3. Clear non-auth chrome.storage.local keys
  if (typeof chrome !== "undefined" && chrome.storage?.local) {
    await chrome.storage.local.remove(CHROME_LOCAL_RESET_KEYS_WITH_LEGACY);
  }

  // 4. Clear chrome.storage.sync (theme, settings)
  if (typeof chrome !== "undefined" && chrome.storage?.sync) {
    await chrome.storage.sync.remove(CHROME_SYNC_RESET_KEYS);
  }
}
