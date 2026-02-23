import { clearAllLocalData, closeDb } from "../db";
import {
  IDB_DATABASE_NAME,
  LOCAL_STORAGE_KEYS,
  CHROME_SYNC_KEYS,
  CS_DB_CLEANUP_AT,
  CS_LAST_RECONCILE,
  CS_LAST_SYNC,
  CS_BOOKMARK_EVENTS,
  CS_LAST_LIGHT_SYNC,
  CS_LIGHT_SYNC_NEEDED,
} from "./storage-keys";

// chrome.storage.local keys to remove on reset.
// Auth and query-ID keys are intentionally preserved so the auth flow
// doesn't re-trigger and open a background tab.
const CHROME_LOCAL_RESET_KEYS = [
  CS_DB_CLEANUP_AT,
  CS_LAST_RECONCILE,
  CS_LAST_SYNC,
  CS_BOOKMARK_EVENTS,
  CS_LAST_LIGHT_SYNC,
  CS_LIGHT_SYNC_NEEDED,
];

export async function resetLocalData(): Promise<void> {
  // 1. Clear all IndexedDB object stores, then delete the database entirely
  try {
    await clearAllLocalData();
    closeDb();
    indexedDB.deleteDatabase(IDB_DATABASE_NAME);
  } catch {
    try {
      indexedDB.deleteDatabase(IDB_DATABASE_NAME);
    } catch {
      // best-effort
    }
  }

  // 2. Remove all known localStorage keys
  if (typeof localStorage !== "undefined") {
    for (const key of LOCAL_STORAGE_KEYS) {
      localStorage.removeItem(key);
    }
  }

  // 3. Clear non-auth chrome.storage.local keys
  if (typeof chrome !== "undefined" && chrome.storage?.local) {
    await chrome.storage.local.remove(CHROME_LOCAL_RESET_KEYS);
  }

  // 4. Clear chrome.storage.sync (theme, settings)
  if (typeof chrome !== "undefined" && chrome.storage?.sync) {
    await chrome.storage.sync.remove([...CHROME_SYNC_KEYS]);
  }
}
