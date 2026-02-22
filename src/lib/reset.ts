import { clearAllLocalData, closeDb } from "../db";
import {
  IDB_DATABASE_NAME,
  LOCAL_STORAGE_KEYS,
  CHROME_SYNC_KEYS,
} from "./storage-keys";

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

  // 3. Clear chrome.storage.local (all keys)
  if (typeof chrome !== "undefined" && chrome.storage?.local) {
    await chrome.storage.local.clear();
  }

  // 4. Reset service worker in-memory state
  if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
    try {
      await chrome.runtime.sendMessage({ type: "RESET_SW_STATE" });
    } catch {
      // Service worker may not be running
    }
  }

  // 5. Clear chrome.storage.sync (theme, settings)
  if (typeof chrome !== "undefined" && chrome.storage?.sync) {
    await chrome.storage.sync.remove([...CHROME_SYNC_KEYS]);
  }
}
