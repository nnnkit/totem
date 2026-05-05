import { closeDb, clearTransientStores } from "../db";
import {
  IDB_ACCOUNT_DATABASE_PREFIX,
  IDB_DATABASE_NAME,
  LEGACY_IDB_DATABASE_NAME,
  LOCAL_STORAGE_KEYS,
  CHROME_SYNC_KEYS,
  LEGACY_LOCAL_STORAGE_KEY_MAP,
  LEGACY_CHROME_SYNC_KEY_MAP,
  LEGACY_CHROME_LOCAL_KEY_MAP,
  CS_DB_CLEANUP_AT,
  CS_LAST_RECONCILE,
  CS_BOOKMARK_EVENTS,
  CS_RESET_EPOCH,
  CS_SYNC_AUTO_ENABLED,
  CS_RUNTIME_AUDIT,
} from "./storage-keys";
// Reset is the ONE runtime-side exception authorized to import SW-owned
// key constants. Its job is to wipe them during a full teardown, not to
// write values into them. Do not copy this import pattern to other
// runtime files. See ARCHITECTURE.md §16 Invariant #1.
import {
  CS_LAST_SYNC,
  CS_LAST_SOFT_SYNC,
  CS_SOFT_SYNC_NEEDED,
  CS_SYNC_ORCHESTRATOR_STATE,
  CS_RUNTIME_STATE_V2,
} from "../service-worker/storage-keys-sw";

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
  CS_SYNC_ORCHESTRATOR_STATE,
  CS_SYNC_AUTO_ENABLED,
  CS_RUNTIME_AUDIT,
  CS_RUNTIME_STATE_V2,
  CS_RESET_EPOCH,
];

const IDB_DATABASE_NAMES = Array.from(
  new Set([IDB_DATABASE_NAME, LEGACY_IDB_DATABASE_NAME]),
);

async function getAccountDatabaseNames(): Promise<string[]> {
  if (typeof indexedDB === "undefined" || typeof indexedDB.databases !== "function") {
    return [];
  }
  try {
    const databases = await indexedDB.databases();
    return databases
      .map((entry) => entry.name)
      .filter((name): name is string =>
        typeof name === "string" && name.startsWith(IDB_ACCOUNT_DATABASE_PREFIX),
      );
  } catch {
    return [];
  }
}

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

const RESET_DB_DELETE_TIMEOUT_MS = 3000;
const RESET_SW_ACK_TIMEOUT_MS = 5000;
// Give any other extension page time to react to the CS_RESET_EPOCH broadcast
// and drop its IDB handle before we call deleteDatabase(). Without this grace
// window the delete can land while another tab still holds a connection,
// which silently leaves the DB on disk (see FINDINGS §1).
const RESET_BROADCAST_DRAIN_MS = 400;

function deleteDatabaseWithTimeout(dbName: string): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(ok);
    };

    const timer = setTimeout(() => finish(false), RESET_DB_DELETE_TIMEOUT_MS);

    try {
      const request = indexedDB.deleteDatabase(dbName);
      request.onsuccess = () => finish(true);
      request.onerror = () => finish(false);
      request.onblocked = () => {
        // Some holder didn't react to the CS_RESET_EPOCH broadcast. Leave
        // the request pending; fall through to the timeout so the user
        // isn't wedged on a zombie connection.
      };
    } catch {
      finish(false);
    }
  });
}

export interface ResetOptions {
  // When true, preserve user-generated content (highlights, reading
  // progress, saved searches) and the cross-device settings stored in
  // chrome.storage.sync. Wipes only caches, flags, sync metadata, and
  // the bookmarks cache (which re-syncs from upstream). Used for the
  // "Reset app" path that fixes stuck UI without losing data.
  keepUserContent?: boolean;
}

export async function resetLocalData(options: ResetOptions = {}): Promise<void> {
  const { keepUserContent = false } = options;

  // Broadcast first: every open page's RuntimeProvider and the SW watch
  // CS_RESET_EPOCH and drop their IDB handles on change. Without this,
  // indexedDB.deleteDatabase() below gets blocked by live connections and
  // silently falls back to the timeout — leaving the DB on disk.
  try {
    await chrome.storage.local.set({ [CS_RESET_EPOCH]: Date.now() });
  } catch {}

  // Block on the SW's ack so no in-flight sync can write to the DB we're
  // about to delete. The SW handler owns flushing its in-memory orchestrator
  // lock, wiping its persisted orchestrator state, and closing its own IDB
  // handle before returning.
  try {
    await Promise.race([
      chrome.runtime.sendMessage({ type: "RESET_SW_STATE" }),
      new Promise<void>((_, reject) =>
        setTimeout(
          () => reject(new Error("RESET_SW_ACK_TIMEOUT")),
          RESET_SW_ACK_TIMEOUT_MS,
        ),
      ),
    ]);
  } catch {
    // Proceed even if the SW is unreachable — the runtime will still clear
    // local state, and any late SW write will land in a DB that no longer
    // exists and be discarded.
  }

  if (keepUserContent) {
    // Clear the bookmarks/details/search-index stores in the active DB
    // without touching the precious stores.
    try {
      await clearTransientStores();
    } catch (error) {
      console.warn("[Totem] reset: clearTransientStores failed", error);
    }
  } else {
    closeDb();

    // Let other extension pages' onChanged listeners finish dropping their
    // handles before the delete lands.
    await new Promise<void>((resolve) => setTimeout(resolve, RESET_BROADCAST_DRAIN_MS));

    const accountDbNames = await getAccountDatabaseNames();
    const allDbNames = Array.from(new Set([...IDB_DATABASE_NAMES, ...accountDbNames]));
    const deleteResults = await Promise.all(
      allDbNames.map((dbName) => deleteDatabaseWithTimeout(dbName)),
    );
    const stillPresent = allDbNames.filter((_, i) => !deleteResults[i]);
    if (stillPresent.length > 0) {
      console.warn("[Totem] reset: deleteDatabase did not complete for", stillPresent);
    }
  }

  for (const key of LOCAL_STORAGE_RESET_KEYS) {
    localStorage.removeItem(key);
  }

  try {
    await Promise.race([
      Promise.all([
        chrome.storage.local.remove(CHROME_LOCAL_RESET_KEYS_WITH_LEGACY),
        // chrome.storage.sync propagates across devices — only wipe it
        // on a full reset so a local "Reset app" can't blow away the
        // user's theme/settings on every device they're signed into.
        keepUserContent
          ? Promise.resolve()
          : chrome.storage.sync.remove(CHROME_SYNC_RESET_KEYS),
      ]),
      new Promise<void>((resolve) => setTimeout(resolve, 3000)),
    ]);
  } catch {}
}
