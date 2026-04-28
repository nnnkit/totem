import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type {
  Bookmark,
  TweetDetailCache,
  ReadingProgress,
  Highlight,
  SavedSearch,
} from "../types";
import { sanitizeBookmark } from "../lib/sanitize";
import { emitReaderActivity } from "../lib/reader-activity";
import {
  DB_ACCOUNT_PREFIX,
  DB_NAME,
  DB_VERSION,
  STORE_BOOKMARKS as STORE_NAME,
  STORE_TWEET_DETAILS as DETAIL_STORE_NAME,
  STORE_READING_PROGRESS as PROGRESS_STORE_NAME,
  STORE_HIGHLIGHTS as HIGHLIGHTS_STORE_NAME,
  STORE_SAVED_SEARCHES as SAVED_SEARCHES_STORE_NAME,
  STORE_SEARCH_INDEX as SEARCH_INDEX_STORE_NAME,
  SEARCH_INDEX_KEY,
} from "../lib/constants";
import { LEGACY_IDB_DATABASE_NAME } from "../lib/storage-keys";

interface XBookmarksDbSchema extends DBSchema {
  bookmarks: {
    key: string;
    value: Bookmark;
    indexes: {
      tweetId: string;
      sortIndex: string;
      createdAt: number;
      screenName: string;
    };
  };
  tweet_details: {
    key: string;
    value: TweetDetailCache;
    indexes: {
      fetchedAt: number;
    };
  };
  reading_progress: {
    key: string;
    value: ReadingProgress;
    indexes: {
      lastReadAt: number;
    };
  };
  highlights: {
    key: string;
    value: Highlight;
    indexes: {
      tweetId: string;
      createdAt: number;
    };
  };
  saved_searches: {
    key: string;
    value: SavedSearch;
    indexes: {
      sortOrder: number;
      createdAt: number;
    };
  };
  search_index: {
    key: string;
    value: { id: string; json: string; savedAt: number };
  };
}

const dbPromises = new Map<string, Promise<IDBPDatabase<XBookmarksDbSchema>>>();
const migrationPromises = new Map<string, Promise<void>>();
let activeAccountId: string | null = null;
let activeDbName = DB_NAME;

const ACCOUNT_ID_SANITIZE_RE = /[^A-Za-z0-9_-]/g;

function normalizeAccountId(accountId: string | null | undefined): string | null {
  if (typeof accountId !== "string") return null;
  const trimmed = accountId.trim();
  if (!trimmed) return null;
  const sanitized = trimmed.replace(ACCOUNT_ID_SANITIZE_RE, "_").slice(0, 120);
  return sanitized || null;
}

export function getDbNameForAccount(accountId: string | null | undefined): string {
  const normalized = normalizeAccountId(accountId);
  return normalized ? `${DB_ACCOUNT_PREFIX}${normalized}` : DB_NAME;
}

export function setActiveAccountId(accountId: string | null | undefined): string {
  const normalized = normalizeAccountId(accountId);
  const nextDbName = getDbNameForAccount(normalized);
  if (nextDbName === activeDbName && normalized === activeAccountId) {
    return activeDbName;
  }
  activeAccountId = normalized;
  activeDbName = nextDbName;
  return activeDbName;
}

function createDb(dbName: string) {
  return openDB<XBookmarksDbSchema>(dbName, DB_VERSION, {
    upgrade(db, _oldVersion, _newVersion, tx) {
      const bookmarksStore = db.objectStoreNames.contains(STORE_NAME)
        ? tx.objectStore(STORE_NAME)
        : db.createObjectStore(STORE_NAME, { keyPath: "id" });

      if (!bookmarksStore.indexNames.contains("tweetId")) {
        bookmarksStore.createIndex("tweetId", "tweetId", { unique: false });
      }
      if (!bookmarksStore.indexNames.contains("sortIndex")) {
        bookmarksStore.createIndex("sortIndex", "sortIndex", { unique: false });
      }
      if (!bookmarksStore.indexNames.contains("createdAt")) {
        bookmarksStore.createIndex("createdAt", "createdAt", { unique: false });
      }
      if (!bookmarksStore.indexNames.contains("screenName")) {
        bookmarksStore.createIndex("screenName", "author.screenName", {
          unique: false,
        });
      }

      const detailStore = db.objectStoreNames.contains(DETAIL_STORE_NAME)
        ? tx.objectStore(DETAIL_STORE_NAME)
        : db.createObjectStore(DETAIL_STORE_NAME, {
            keyPath: "tweetId",
          });

      if (!detailStore.indexNames.contains("fetchedAt")) {
        detailStore.createIndex("fetchedAt", "fetchedAt", { unique: false });
      }

      const progressStore = db.objectStoreNames.contains(PROGRESS_STORE_NAME)
        ? tx.objectStore(PROGRESS_STORE_NAME)
        : db.createObjectStore(PROGRESS_STORE_NAME, { keyPath: "tweetId" });

      if (!progressStore.indexNames.contains("lastReadAt")) {
        progressStore.createIndex("lastReadAt", "lastReadAt", {
          unique: false,
        });
      }

      const highlightsStore = db.objectStoreNames.contains(
        HIGHLIGHTS_STORE_NAME,
      )
        ? tx.objectStore(HIGHLIGHTS_STORE_NAME)
        : db.createObjectStore(HIGHLIGHTS_STORE_NAME, { keyPath: "id" });

      if (!highlightsStore.indexNames.contains("tweetId")) {
        highlightsStore.createIndex("tweetId", "tweetId", { unique: false });
      }
      if (!highlightsStore.indexNames.contains("createdAt")) {
        highlightsStore.createIndex("createdAt", "createdAt", {
          unique: false,
        });
      }

      const savedSearchesStore = db.objectStoreNames.contains(
        SAVED_SEARCHES_STORE_NAME,
      )
        ? tx.objectStore(SAVED_SEARCHES_STORE_NAME)
        : db.createObjectStore(SAVED_SEARCHES_STORE_NAME, { keyPath: "id" });

      if (!savedSearchesStore.indexNames.contains("sortOrder")) {
        savedSearchesStore.createIndex("sortOrder", "sortOrder", {
          unique: false,
        });
      }
      if (!savedSearchesStore.indexNames.contains("createdAt")) {
        savedSearchesStore.createIndex("createdAt", "createdAt", {
          unique: false,
        });
      }

      if (!db.objectStoreNames.contains(SEARCH_INDEX_STORE_NAME)) {
        db.createObjectStore(SEARCH_INDEX_STORE_NAME, { keyPath: "id" });
      }
    },
    blocked() {
      // Keep existing tabs open; app can continue with in-memory state until next refresh.
    },
    blocking() {
      dbPromises.delete(dbName);
    },
    terminated() {
      dbPromises.delete(dbName);
    },
  });
}

async function hasDatabase(name: string): Promise<boolean> {
  if (typeof indexedDB === "undefined" || typeof indexedDB.databases !== "function") {
    return false;
  }
  try {
    const databases = await indexedDB.databases();
    return databases.some((entry) => entry.name === name);
  } catch {
    return false;
  }
}

async function migrateFromDatabase(
  db: IDBPDatabase<XBookmarksDbSchema>,
  sourceName: string,
): Promise<boolean> {
  if (!(await hasDatabase(sourceName))) return false;

  let sourceDb: IDBPDatabase<XBookmarksDbSchema> | null = null;
  try {
    sourceDb = await openDB<XBookmarksDbSchema>(sourceName);
  } catch {
    return false;
  }

  try {
    const bookmarks = sourceDb.objectStoreNames.contains(STORE_NAME)
      ? await sourceDb.getAll(STORE_NAME)
      : [];
    const details = sourceDb.objectStoreNames.contains(DETAIL_STORE_NAME)
      ? await sourceDb.getAll(DETAIL_STORE_NAME)
      : [];
    const progress = sourceDb.objectStoreNames.contains(PROGRESS_STORE_NAME)
      ? await sourceDb.getAll(PROGRESS_STORE_NAME)
      : [];
    const highlights = sourceDb.objectStoreNames.contains(HIGHLIGHTS_STORE_NAME)
      ? await sourceDb.getAll(HIGHLIGHTS_STORE_NAME)
      : [];

    if (
      bookmarks.length === 0 &&
      details.length === 0 &&
      progress.length === 0 &&
      highlights.length === 0
    ) {
      return false;
    }

    const tx = db.transaction(
      [STORE_NAME, DETAIL_STORE_NAME, PROGRESS_STORE_NAME, HIGHLIGHTS_STORE_NAME],
      "readwrite",
    );
    for (const row of bookmarks) {
      tx.objectStore(STORE_NAME).put(row);
    }
    for (const row of details) {
      tx.objectStore(DETAIL_STORE_NAME).put(row);
    }
    for (const row of progress) {
      tx.objectStore(PROGRESS_STORE_NAME).put(row);
    }
    for (const row of highlights) {
      tx.objectStore(HIGHLIGHTS_STORE_NAME).put(row);
    }
    await tx.done;
    return true;
  } finally {
    sourceDb.close();
  }
}

async function migrateLegacyDatabaseIfNeeded(
  db: IDBPDatabase<XBookmarksDbSchema>,
  dbName: string,
): Promise<void> {
  const [bookmarkCount, detailCount, progressCount, highlightCount] =
    await Promise.all([
      db.count(STORE_NAME),
      db.count(DETAIL_STORE_NAME),
      db.count(PROGRESS_STORE_NAME),
      db.count(HIGHLIGHTS_STORE_NAME),
    ]);

  // If the target DB already has user data, don't overwrite it.
  if (bookmarkCount + detailCount + progressCount + highlightCount > 0) return;

  const migrationSourceNames = dbName === DB_NAME
    ? [LEGACY_IDB_DATABASE_NAME]
    : [DB_NAME, LEGACY_IDB_DATABASE_NAME];

  for (const sourceName of migrationSourceNames) {
    if (sourceName === dbName) continue;
    const didMigrate = await migrateFromDatabase(db, sourceName).catch(() => false);
    if (didMigrate) {
      return;
    }
  }
}

async function getDb(): Promise<IDBPDatabase<XBookmarksDbSchema>> {
  const dbName = activeDbName;
  let dbPromise = dbPromises.get(dbName);
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await createDb(dbName);
      let migrationPromise = migrationPromises.get(dbName);
      if (!migrationPromise) {
        migrationPromise = migrateLegacyDatabaseIfNeeded(db, dbName).catch(() => {});
        migrationPromises.set(dbName, migrationPromise);
      }
      await migrationPromise;
      return db;
    })().catch((error) => {
      dbPromises.delete(dbName);
      throw error;
    });
    dbPromises.set(dbName, dbPromise);
  }
  return dbPromise;
}

export function closeDb(): void {
  const openPromises = Array.from(dbPromises.values());
  dbPromises.clear();
  for (const promise of openPromises) {
    promise.then((db) => db.close()).catch(() => {});
  }
}

export async function upsertBookmarks(bookmarks: Bookmark[]): Promise<void> {
  if (bookmarks.length === 0) return;

  const db = await getDb();
  const tx = db.transaction(STORE_NAME, "readwrite");
  for (const bookmark of bookmarks) {
    tx.store.put(bookmark);
  }
  await tx.done;
}

export async function getAllBookmarks(): Promise<Bookmark[]> {
  const db = await getDb();
  const tx = db.transaction(STORE_NAME, "readonly");
  const rows: Bookmark[] = [];

  let cursor = await tx.store.index("sortIndex").openCursor(null, "prev");
  while (cursor) {
    rows.push(cursor.value);
    cursor = await cursor.continue();
  }

  await tx.done;
  for (const row of rows) {
    sanitizeBookmark(row);
    if (typeof row.bookmarked !== "boolean") {
      row.bookmarked = true;
    }
  }
  return rows;
}

export async function clearAllLocalData(): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(
    [STORE_NAME, DETAIL_STORE_NAME, PROGRESS_STORE_NAME, HIGHLIGHTS_STORE_NAME],
    "readwrite",
  );
  tx.objectStore(STORE_NAME).clear();
  tx.objectStore(DETAIL_STORE_NAME).clear();
  tx.objectStore(PROGRESS_STORE_NAME).clear();
  tx.objectStore(HIGHLIGHTS_STORE_NAME).clear();
  await tx.done;
}

// Clears caches and the bookmarks store (which re-syncs from upstream),
// but preserves user-generated content: highlights, reading progress,
// and saved searches. Used by the "Reset app" path.
export async function clearTransientStores(): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(
    [STORE_NAME, DETAIL_STORE_NAME, SEARCH_INDEX_STORE_NAME],
    "readwrite",
  );
  tx.objectStore(STORE_NAME).clear();
  tx.objectStore(DETAIL_STORE_NAME).clear();
  tx.objectStore(SEARCH_INDEX_STORE_NAME).clear();
  await tx.done;
}

export interface DeleteBookmarksOptions {
  purgeHighlights?: boolean;
}

export async function deleteBookmarksByTweetIds(
  tweetIds: string[],
  options: DeleteBookmarksOptions = {},
): Promise<void> {
  if (tweetIds.length === 0) return;

  const uniqueIds = Array.from(new Set(tweetIds.filter(Boolean)));
  if (uniqueIds.length === 0) return;
  const { purgeHighlights = false } = options;

  const db = await getDb();
  const tx = db.transaction(
    [STORE_NAME, DETAIL_STORE_NAME, PROGRESS_STORE_NAME, HIGHLIGHTS_STORE_NAME],
    "readwrite",
  );
  const bookmarkStore = tx.objectStore(STORE_NAME);
  const detailStore = tx.objectStore(DETAIL_STORE_NAME);
  const progressStore = tx.objectStore(PROGRESS_STORE_NAME);
  const tweetIndex = bookmarkStore.index("tweetId");
  const highlightsStore = tx.objectStore(HIGHLIGHTS_STORE_NAME);
  const highlightTweetIndex = highlightsStore.index("tweetId");

  for (const tweetId of uniqueIds) {
    const bookmarkIds = await tweetIndex.getAllKeys(IDBKeyRange.only(tweetId));
    for (const bookmarkId of bookmarkIds) {
      await bookmarkStore.delete(bookmarkId as string);
    }
    if (purgeHighlights) {
      const highlightIds = await highlightTweetIndex.getAllKeys(
        IDBKeyRange.only(tweetId),
      );
      for (const hId of highlightIds) {
        await highlightsStore.delete(hId as string);
      }
    }
    await detailStore.delete(tweetId);
    await progressStore.delete(tweetId);
  }

  await tx.done;
}

export async function upsertTweetDetailCache(
  detail: TweetDetailCache,
): Promise<void> {
  const db = await getDb();
  await db.put(DETAIL_STORE_NAME, detail);
}

export async function getTweetDetailCache(
  tweetId: string,
): Promise<TweetDetailCache | null> {
  if (!tweetId) return null;

  const db = await getDb();
  const cached = await db.get(DETAIL_STORE_NAME, tweetId);
  return cached || null;
}

export async function upsertReadingProgress(
  progress: ReadingProgress,
): Promise<void> {
  const db = await getDb();
  await db.put(PROGRESS_STORE_NAME, progress);
  emitReaderActivity();
}

// Don't double-count fast successive opens within a single reading session.
const REOPEN_DEBOUNCE_MS = 5 * 60 * 1000;

export async function ensureReadingProgressExists(
  tweetId: string,
): Promise<void> {
  if (!tweetId) return;
  const db = await getDb();
  const existing = await db.get(PROGRESS_STORE_NAME, tweetId);
  const now = Date.now();
  if (existing) {
    const previousReadAt = existing.lastReadAt ?? 0;
    const isFreshSession = now - previousReadAt >= REOPEN_DEBOUNCE_MS;
    const reopenCount = (existing.reopenCount ?? 0) + (isFreshSession ? 1 : 0);
    await db.put(PROGRESS_STORE_NAME, {
      ...existing,
      lastReadAt: now,
      reopenCount,
    });
  } else {
    await db.put(PROGRESS_STORE_NAME, {
      tweetId,
      openedAt: now,
      lastReadAt: now,
      scrollY: 0,
      scrollHeight: 0,
      completed: false,
      reopenCount: 1,
    });
  }
  emitReaderActivity();
}

export async function markReadingProgressCompleted(
  tweetId: string,
): Promise<void> {
  if (!tweetId) return;
  const db = await getDb();
  const existing = await db.get(PROGRESS_STORE_NAME, tweetId);
  const now = Date.now();
  if (existing) {
    await db.put(PROGRESS_STORE_NAME, {
      ...existing,
      lastReadAt: now,
      completed: true,
    });
  } else {
    await db.put(PROGRESS_STORE_NAME, {
      tweetId,
      openedAt: now,
      lastReadAt: now,
      scrollY: 0,
      scrollHeight: 0,
      completed: true,
    });
  }
  emitReaderActivity();
}

export async function markReadingProgressUncompleted(
  tweetId: string,
): Promise<void> {
  if (!tweetId) return;
  const db = await getDb();
  const existing = await db.get(PROGRESS_STORE_NAME, tweetId);
  if (existing) {
    await db.put(PROGRESS_STORE_NAME, {
      ...existing,
      lastReadAt: Date.now(),
      completed: false,
    });
    emitReaderActivity();
  }
}

export async function getReadingProgress(
  tweetId: string,
): Promise<ReadingProgress | null> {
  if (!tweetId) return null;
  const db = await getDb();
  const record = await db.get(PROGRESS_STORE_NAME, tweetId);
  return record || null;
}

export async function getAllReadingProgress(): Promise<ReadingProgress[]> {
  const db = await getDb();
  const tx = db.transaction(PROGRESS_STORE_NAME, "readonly");
  const rows: ReadingProgress[] = [];

  let cursor = await tx.store.index("lastReadAt").openCursor(null, "prev");
  while (cursor) {
    rows.push(cursor.value);
    cursor = await cursor.continue();
  }

  await tx.done;
  return rows;
}

export async function getDetailedTweetIds(): Promise<Set<string>> {
  const db = await getDb();
  const keys = await db.getAllKeys(DETAIL_STORE_NAME);
  return new Set(keys);
}

export async function getCompletedTweetIds(): Promise<Set<string>> {
  const db = await getDb();
  const tx = db.transaction(PROGRESS_STORE_NAME, "readonly");
  const ids = new Set<string>();
  let cursor = await tx.store.openCursor();
  while (cursor) {
    if (cursor.value.completed) ids.add(cursor.key as string);
    cursor = await cursor.continue();
  }
  await tx.done;
  return ids;
}

export async function upsertHighlight(highlight: Highlight): Promise<void> {
  const db = await getDb();
  await db.put(HIGHLIGHTS_STORE_NAME, highlight);
  emitReaderActivity();
}

export async function deleteHighlight(id: string): Promise<void> {
  if (!id) return;
  const db = await getDb();
  await db.delete(HIGHLIGHTS_STORE_NAME, id);
  emitReaderActivity();
}

export async function getHighlightsByTweetId(tweetId: string): Promise<Highlight[]> {
  if (!tweetId) return [];
  const db = await getDb();
  return db.getAllFromIndex(HIGHLIGHTS_STORE_NAME, "tweetId", tweetId);
}

export interface HighlightCounts {
  highlights: number;
  notes: number;
}

export async function getHighlightCountsByTweetIds(
  tweetIds: string[],
): Promise<Map<string, HighlightCounts>> {
  const result = new Map<string, HighlightCounts>();
  if (tweetIds.length === 0) return result;
  const db = await getDb();
  const index = db.transaction(HIGHLIGHTS_STORE_NAME, "readonly").store.index("tweetId");
  for (const tweetId of tweetIds) {
    const highlights = await index.getAll(IDBKeyRange.only(tweetId));
    if (highlights.length > 0) {
      const notes = highlights.filter((highlight) =>
        highlight.type === "note" || Boolean(highlight.note)
      ).length;
      result.set(tweetId, {
        highlights: highlights.length - notes,
        notes,
      });
    }
  }
  return result;
}

/**
 * Build a lightweight per-bookmark signals map for ranking — last-read
 * timestamp and reopen count. Used by the search engine's `boostDocument`.
 */
export async function getBookmarkSignals(): Promise<
  Map<string, { lastReadAt?: number; reopenCount?: number }>
> {
  const out = new Map<string, { lastReadAt?: number; reopenCount?: number }>();
  try {
    const all = await getAllReadingProgress();
    for (const row of all) {
      out.set(row.tweetId, {
        lastReadAt: row.lastReadAt,
        reopenCount: row.reopenCount ?? 0,
      });
    }
  } catch {
    // ignore — empty signals just disable the click signal.
  }
  return out;
}

// ─── Search index persistence ────────────────────────────────────────────

/** Load the serialized MiniSearch index, or null if none exists / is stale. */
export async function loadSearchIndexJson(): Promise<string | null> {
  try {
    const db = await getDb();
    const row = await db.get(SEARCH_INDEX_STORE_NAME, SEARCH_INDEX_KEY);
    return row?.json ?? null;
  } catch {
    return null;
  }
}

export async function saveSearchIndexJson(json: string): Promise<void> {
  try {
    const db = await getDb();
    await db.put(SEARCH_INDEX_STORE_NAME, {
      id: SEARCH_INDEX_KEY,
      json,
      savedAt: Date.now(),
    });
  } catch {
    // Persistence is a cache, never authoritative — silent on failure.
  }
}

export async function clearSearchIndexJson(): Promise<void> {
  try {
    const db = await getDb();
    await db.delete(SEARCH_INDEX_STORE_NAME, SEARCH_INDEX_KEY);
  } catch {
    // ignore
  }
}

export async function cleanupOldTweetDetails(
  maxAgeMs: number,
): Promise<number> {
  if (!Number.isFinite(maxAgeMs) || maxAgeMs <= 0) return 0;

  const cutoff = Date.now() - maxAgeMs;
  const db = await getDb();
  const tx = db.transaction(DETAIL_STORE_NAME, "readwrite");
  const fetchedAtIndex = tx.store.index("fetchedAt");

  let removed = 0;
  let cursor = await fetchedAtIndex.openCursor(IDBKeyRange.upperBound(cutoff));
  while (cursor) {
    await cursor.delete();
    removed += 1;
    cursor = await cursor.continue();
  }

  await tx.done;
  return removed;
}
