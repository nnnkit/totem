import { clearAllLocalData, closeDb } from "../db";
import {
  IDB_DATABASE_NAME,
  LOCAL_STORAGE_KEYS,
  CHROME_SYNC_KEYS,
  CS_MANUAL_LOGIN,
} from "./storage-keys";

export const MANUAL_LOGIN_REQUIRED_KEY = CS_MANUAL_LOGIN;

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
    await chrome.storage.local.set({ [CS_MANUAL_LOGIN]: true });
  }

  // 4. Clear chrome.storage.sync (theme, settings)
  if (typeof chrome !== "undefined" && chrome.storage?.sync) {
    await chrome.storage.sync.remove([...CHROME_SYNC_KEYS]);
  }
}
