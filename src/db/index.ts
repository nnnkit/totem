import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type {
  Bookmark,
  TweetDetailCache,
  ReadingProgress,
  Highlight,
  SavedSearch,
  TodayQueueSnapshot,
  BookmarkQueueMetadata,
  TodayQueueExposure,
} from "../types";
import { sanitizeBookmark } from "../lib/sanitize";
import { emitReaderActivity } from "../lib/reader-activity";
import { selectStaleTodayQueueSnapshotKeys } from "../lib/today-queue";
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
  STORE_TODAY_QUEUE_SNAPSHOTS as TODAY_QUEUE_SNAPSHOTS_STORE_NAME,
  STORE_BOOKMARK_QUEUE_METADATA as BOOKMARK_QUEUE_METADATA_STORE_NAME,
  STORE_TODAY_QUEUE_EXPOSURES as TODAY_QUEUE_EXPOSURES_STORE_NAME,
  SEARCH_INDEX_KEY,
} from "../lib/constants/db";
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
  today_queue_snapshots: {
    key: string;
    value: TodayQueueSnapshot;
    indexes: {
      localDate: string;
      generatedAt: number;
    };
  };
  bookmark_queue_metadata: {
    key: string;
    value: BookmarkQueueMetadata;
    indexes: {
      intent: string;
      updatedAt: number;
    };
  };
  today_queue_exposures: {
    key: string;
    value: TodayQueueExposure;
    indexes: {
      tweetId: string;
      localDate: string;
      createdAt: number;
    };
  };
}

const dbPromises = new Map<string, Promise<IDBPDatabase<XBookmarksDbSchema>>>();
const migrationPromises = new Map<string, Promise<void>>();
let activeAccountId: string | null = null;
let activeDbName = DB_NAME;
const detailCacheListeners = new Set<(tweetId: string) => void>();

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

      const queueStore = db.objectStoreNames.contains(
        TODAY_QUEUE_SNAPSHOTS_STORE_NAME,
      )
        ? tx.objectStore(TODAY_QUEUE_SNAPSHOTS_STORE_NAME)
        : db.createObjectStore(TODAY_QUEUE_SNAPSHOTS_STORE_NAME, {
            keyPath: "key",
          });

      if (!queueStore.indexNames.contains("localDate")) {
        queueStore.createIndex("localDate", "localDate", { unique: false });
      }
      if (!queueStore.indexNames.contains("generatedAt")) {
        queueStore.createIndex("generatedAt", "generatedAt", { unique: false });
      }

      const queueMetadataStore = db.objectStoreNames.contains(
        BOOKMARK_QUEUE_METADATA_STORE_NAME,
      )
        ? tx.objectStore(BOOKMARK_QUEUE_METADATA_STORE_NAME)
        : db.createObjectStore(BOOKMARK_QUEUE_METADATA_STORE_NAME, {
            keyPath: "tweetId",
          });

      if (!queueMetadataStore.indexNames.contains("intent")) {
        queueMetadataStore.createIndex("intent", "intent", { unique: false });
      }
      if (!queueMetadataStore.indexNames.contains("updatedAt")) {
        queueMetadataStore.createIndex("updatedAt", "updatedAt", {
          unique: false,
        });
      }

      const queueExposureStore = db.objectStoreNames.contains(
        TODAY_QUEUE_EXPOSURES_STORE_NAME,
      )
        ? tx.objectStore(TODAY_QUEUE_EXPOSURES_STORE_NAME)
        : db.createObjectStore(TODAY_QUEUE_EXPOSURES_STORE_NAME, {
            keyPath: "id",
          });

      if (!queueExposureStore.indexNames.contains("tweetId")) {
        queueExposureStore.createIndex("tweetId", "tweetId", { unique: false });
      }
      if (!queueExposureStore.indexNames.contains("localDate")) {
        queueExposureStore.createIndex("localDate", "localDate", {
          unique: false,
        });
      }
      if (!queueExposureStore.indexNames.contains("createdAt")) {
        queueExposureStore.createIndex("createdAt", "createdAt", {
          unique: false,
        });
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
    const queueSnapshots = sourceDb.objectStoreNames.contains(
      TODAY_QUEUE_SNAPSHOTS_STORE_NAME,
    )
      ? await sourceDb.getAll(TODAY_QUEUE_SNAPSHOTS_STORE_NAME)
      : [];
    const queueMetadata = sourceDb.objectStoreNames.contains(
      BOOKMARK_QUEUE_METADATA_STORE_NAME,
    )
      ? await sourceDb.getAll(BOOKMARK_QUEUE_METADATA_STORE_NAME)
      : [];
    const queueExposures = sourceDb.objectStoreNames.contains(
      TODAY_QUEUE_EXPOSURES_STORE_NAME,
    )
      ? await sourceDb.getAll(TODAY_QUEUE_EXPOSURES_STORE_NAME)
      : [];

    if (
      bookmarks.length === 0 &&
      details.length === 0 &&
      progress.length === 0 &&
      highlights.length === 0 &&
      queueSnapshots.length === 0 &&
      queueMetadata.length === 0 &&
      queueExposures.length === 0
    ) {
      return false;
    }

    const tx = db.transaction(
      [
        STORE_NAME,
        DETAIL_STORE_NAME,
        PROGRESS_STORE_NAME,
        HIGHLIGHTS_STORE_NAME,
        TODAY_QUEUE_SNAPSHOTS_STORE_NAME,
        BOOKMARK_QUEUE_METADATA_STORE_NAME,
        TODAY_QUEUE_EXPOSURES_STORE_NAME,
      ],
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
    for (const row of queueSnapshots) {
      tx.objectStore(TODAY_QUEUE_SNAPSHOTS_STORE_NAME).put(row);
    }
    for (const row of queueMetadata) {
      tx.objectStore(BOOKMARK_QUEUE_METADATA_STORE_NAME).put(row);
    }
    for (const row of queueExposures) {
      tx.objectStore(TODAY_QUEUE_EXPOSURES_STORE_NAME).put(row);
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
  const [
    bookmarkCount,
    detailCount,
    progressCount,
    highlightCount,
    queueSnapshotCount,
    queueMetadataCount,
    queueExposureCount,
  ] =
    await Promise.all([
      db.count(STORE_NAME),
      db.count(DETAIL_STORE_NAME),
      db.count(PROGRESS_STORE_NAME),
      db.count(HIGHLIGHTS_STORE_NAME),
      db.count(TODAY_QUEUE_SNAPSHOTS_STORE_NAME),
      db.count(BOOKMARK_QUEUE_METADATA_STORE_NAME),
      db.count(TODAY_QUEUE_EXPOSURES_STORE_NAME),
    ]);

  // If the target DB already has user data, don't overwrite it.
  if (
    bookmarkCount +
      detailCount +
      progressCount +
      highlightCount +
      queueSnapshotCount +
      queueMetadataCount +
      queueExposureCount >
    0
  ) return;

  const migrationSourceNames = dbName === DB_NAME
    ? [LEGACY_IDB_DATABASE_NAME]
    : [DB_NAME, LEGACY_IDB_DATABASE_NAME];

  await migrateFromFirstAvailableDatabase(db, dbName, migrationSourceNames);
}

async function migrateFromFirstAvailableDatabase(
  db: IDBPDatabase<XBookmarksDbSchema>,
  dbName: string,
  sourceNames: string[],
  index = 0,
): Promise<boolean> {
  const sourceName = sourceNames[index];
  if (!sourceName) return false;
  if (sourceName === dbName) {
    return migrateFromFirstAvailableDatabase(db, dbName, sourceNames, index + 1);
  }
  const didMigrate = await migrateFromDatabase(db, sourceName).catch(() => false);
  if (didMigrate) return true;
  return migrateFromFirstAvailableDatabase(db, dbName, sourceNames, index + 1);
}

async function getDb(
  dbName: string = activeDbName,
): Promise<IDBPDatabase<XBookmarksDbSchema>> {
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

export async function upsertBookmarks(
  bookmarks: Bookmark[],
  dbName: string = activeDbName,
): Promise<void> {
  if (bookmarks.length === 0) return;

  const db = await getDb(dbName);
  const tx = db.transaction(STORE_NAME, "readwrite");
  for (const bookmark of bookmarks) {
    tx.store.put(bookmark);
  }
  await tx.done;
}

function normalizeBookmarkForRead(bookmark: Bookmark): Bookmark {
  sanitizeBookmark(bookmark);
  if (typeof bookmark.bookmarked !== "boolean") {
    bookmark.bookmarked = true;
  }
  return bookmark;
}

export async function getBookmarkById(
  id: string,
  dbName: string = activeDbName,
): Promise<Bookmark | null> {
  if (!id) return null;
  const db = await getDb(dbName);
  const bookmark = await db.get(STORE_NAME, id);
  return bookmark ? normalizeBookmarkForRead(bookmark) : null;
}

export function iterateBookmarks(
  dbName: string = activeDbName,
): AsyncIterable<Bookmark> {
  return {
    async *[Symbol.asyncIterator](): AsyncIterator<Bookmark> {
      const db = await getDb(dbName);
      const tx = db.transaction(STORE_NAME, "readonly");
      const rows: Bookmark[] = [];
      let cursor = await tx.store.index("sortIndex").openCursor(null, "prev");
      while (cursor) {
        rows.push(cursor.value);
        cursor = await cursor.continue();
      }
      await tx.done;

      for (const row of rows) {
        yield normalizeBookmarkForRead(row);
      }
    },
  };
}

export async function getAllBookmarks(
  dbName: string = activeDbName,
): Promise<Bookmark[]> {
  const db = await getDb(dbName);
  const tx = db.transaction(STORE_NAME, "readonly");
  const rows: Bookmark[] = [];

  let cursor = await tx.store.index("sortIndex").openCursor(null, "prev");
  while (cursor) {
    rows.push(cursor.value);
    cursor = await cursor.continue();
  }

  await tx.done;
  for (const row of rows) {
    normalizeBookmarkForRead(row);
  }
  return rows;
}

export async function clearAllLocalData(
  dbName: string = activeDbName,
): Promise<void> {
  const db = await getDb(dbName);
  const tx = db.transaction(
    [
      STORE_NAME,
      DETAIL_STORE_NAME,
      PROGRESS_STORE_NAME,
      HIGHLIGHTS_STORE_NAME,
      TODAY_QUEUE_SNAPSHOTS_STORE_NAME,
      BOOKMARK_QUEUE_METADATA_STORE_NAME,
      TODAY_QUEUE_EXPOSURES_STORE_NAME,
    ],
    "readwrite",
  );
  tx.objectStore(STORE_NAME).clear();
  tx.objectStore(DETAIL_STORE_NAME).clear();
  tx.objectStore(PROGRESS_STORE_NAME).clear();
  tx.objectStore(HIGHLIGHTS_STORE_NAME).clear();
  tx.objectStore(TODAY_QUEUE_SNAPSHOTS_STORE_NAME).clear();
  tx.objectStore(BOOKMARK_QUEUE_METADATA_STORE_NAME).clear();
  tx.objectStore(TODAY_QUEUE_EXPOSURES_STORE_NAME).clear();
  await tx.done;
}

// Clears caches and the bookmarks store (which re-syncs from upstream),
// but preserves user-generated content: highlights, reading progress,
// and saved searches. Used by the "Reset app" path.
export async function clearTransientStores(
  dbName: string = activeDbName,
): Promise<void> {
  const db = await getDb(dbName);
  const tx = db.transaction(
    [
      STORE_NAME,
      DETAIL_STORE_NAME,
      SEARCH_INDEX_STORE_NAME,
      TODAY_QUEUE_SNAPSHOTS_STORE_NAME,
    ],
    "readwrite",
  );
  tx.objectStore(STORE_NAME).clear();
  tx.objectStore(DETAIL_STORE_NAME).clear();
  tx.objectStore(SEARCH_INDEX_STORE_NAME).clear();
  tx.objectStore(TODAY_QUEUE_SNAPSHOTS_STORE_NAME).clear();
  await tx.done;
}

export interface DeleteBookmarksOptions {
  purgeHighlights?: boolean;
}

export async function deleteBookmarksByTweetIds(
  tweetIds: string[],
  options: DeleteBookmarksOptions = {},
  dbName: string = activeDbName,
): Promise<void> {
  if (tweetIds.length === 0) return;

  const uniqueIds = Array.from(new Set(tweetIds.filter(Boolean)));
  if (uniqueIds.length === 0) return;
  const { purgeHighlights = false } = options;

  const db = await getDb(dbName);
  const tx = db.transaction(
    [
      STORE_NAME,
      DETAIL_STORE_NAME,
      PROGRESS_STORE_NAME,
      HIGHLIGHTS_STORE_NAME,
      BOOKMARK_QUEUE_METADATA_STORE_NAME,
    ],
    "readwrite",
  );
  const bookmarkStore = tx.objectStore(STORE_NAME);
  const detailStore = tx.objectStore(DETAIL_STORE_NAME);
  const progressStore = tx.objectStore(PROGRESS_STORE_NAME);
  const queueMetadataStore = tx.objectStore(BOOKMARK_QUEUE_METADATA_STORE_NAME);
  const tweetIndex = bookmarkStore.index("tweetId");
  const highlightsStore = tx.objectStore(HIGHLIGHTS_STORE_NAME);
  const highlightTweetIndex = highlightsStore.index("tweetId");

  await Promise.all(uniqueIds.map(async (tweetId) => {
    const bookmarkIds = await tweetIndex.getAllKeys(IDBKeyRange.only(tweetId));
    await Promise.all(bookmarkIds.map((bookmarkId) => bookmarkStore.delete(bookmarkId as string)));
    if (purgeHighlights) {
      const highlightIds = await highlightTweetIndex.getAllKeys(
        IDBKeyRange.only(tweetId),
      );
      await Promise.all(highlightIds.map((hId) => highlightsStore.delete(hId as string)));
    }
    await Promise.all([
      detailStore.delete(tweetId),
      progressStore.delete(tweetId),
      queueMetadataStore.delete(tweetId),
    ]);
  }));

  await tx.done;
}

export async function upsertTweetDetailCache(
  detail: TweetDetailCache,
  dbName: string = activeDbName,
): Promise<void> {
  await upsertTweetDetailCaches([detail], dbName);
}

export async function upsertTweetDetailCaches(
  details: TweetDetailCache[],
  dbName: string = activeDbName,
): Promise<void> {
  if (details.length === 0) return;

  const db = await getDb(dbName);
  const tx = db.transaction(DETAIL_STORE_NAME, "readwrite");
  for (const detail of details) {
    tx.store.put(detail);
  }
  await tx.done;

  for (const detail of details) {
    for (const listener of detailCacheListeners) {
      try {
        listener(detail.tweetId);
      } catch {
      }
    }
  }
}

export function subscribeTweetDetailCache(
  listener: (tweetId: string) => void,
): () => void {
  detailCacheListeners.add(listener);
  return () => {
    detailCacheListeners.delete(listener);
  };
}

export async function getTweetDetailCache(
  tweetId: string,
  dbName: string = activeDbName,
): Promise<TweetDetailCache | null> {
  if (!tweetId) return null;

  const db = await getDb(dbName);
  const cached = await db.get(DETAIL_STORE_NAME, tweetId);
  return cached || null;
}

export async function upsertReadingProgress(
  progress: ReadingProgress,
  dbName: string = activeDbName,
): Promise<void> {
  await upsertReadingProgressRows([progress], dbName);
}

export async function upsertReadingProgressRows(
  progressRows: ReadingProgress[],
  dbName: string = activeDbName,
): Promise<void> {
  if (progressRows.length === 0) return;

  const db = await getDb(dbName);
  const tx = db.transaction(PROGRESS_STORE_NAME, "readwrite");
  for (const progress of progressRows) {
    tx.store.put(progress);
  }
  await tx.done;
  emitReaderActivity();
}

// Don't double-count fast successive opens within a single reading session.
const REOPEN_DEBOUNCE_MS = 5 * 60 * 1000;

export async function ensureReadingProgressExists(
  tweetId: string,
  dbName: string = activeDbName,
): Promise<void> {
  if (!tweetId) return;
  const db = await getDb(dbName);
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
  dbName: string = activeDbName,
): Promise<void> {
  if (!tweetId) return;
  const db = await getDb(dbName);
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
  dbName: string = activeDbName,
): Promise<void> {
  if (!tweetId) return;
  const db = await getDb(dbName);
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
  dbName: string = activeDbName,
): Promise<ReadingProgress | null> {
  if (!tweetId) return null;
  const db = await getDb(dbName);
  const record = await db.get(PROGRESS_STORE_NAME, tweetId);
  return record || null;
}

export async function getAllReadingProgress(
  dbName: string = activeDbName,
): Promise<ReadingProgress[]> {
  const db = await getDb(dbName);
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

export function iterateReadingProgress(
  dbName: string = activeDbName,
): AsyncIterable<ReadingProgress> {
  return {
    async *[Symbol.asyncIterator](): AsyncIterator<ReadingProgress> {
      const db = await getDb(dbName);
      const tx = db.transaction(PROGRESS_STORE_NAME, "readonly");
      const ids: string[] = [];
      let cursor = await tx.store.index("lastReadAt").openKeyCursor(null, "prev");
      while (cursor) {
        ids.push(cursor.primaryKey as string);
        cursor = await cursor.continue();
      }
      await tx.done;

      for (const id of ids) {
        const row = await db.get(PROGRESS_STORE_NAME, id);
        if (row) yield row;
      }
    },
  };
}

export async function getDetailedTweetIds(
  dbName: string = activeDbName,
): Promise<Set<string>> {
  const db = await getDb(dbName);
  const keys = await db.getAllKeys(DETAIL_STORE_NAME);
  return new Set(keys);
}

export async function getCompletedTweetIds(
  dbName: string = activeDbName,
): Promise<Set<string>> {
  const db = await getDb(dbName);
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

export async function upsertHighlight(
  highlight: Highlight,
  dbName: string = activeDbName,
): Promise<void> {
  await upsertHighlights([highlight], dbName);
}

export async function upsertHighlights(
  highlights: Highlight[],
  dbName: string = activeDbName,
): Promise<void> {
  if (highlights.length === 0) return;

  const db = await getDb(dbName);
  const tx = db.transaction(HIGHLIGHTS_STORE_NAME, "readwrite");
  for (const highlight of highlights) {
    tx.store.put(highlight);
  }
  await tx.done;
  emitReaderActivity();
}

export async function deleteHighlight(
  id: string,
  dbName: string = activeDbName,
): Promise<void> {
  if (!id) return;
  const db = await getDb(dbName);
  await db.delete(HIGHLIGHTS_STORE_NAME, id);
  emitReaderActivity();
}

export async function getHighlightById(
  id: string,
  dbName: string = activeDbName,
): Promise<Highlight | null> {
  if (!id) return null;
  const db = await getDb(dbName);
  return (await db.get(HIGHLIGHTS_STORE_NAME, id)) ?? null;
}

export async function getHighlightsByTweetId(
  tweetId: string,
  dbName: string = activeDbName,
): Promise<Highlight[]> {
  if (!tweetId) return [];
  const db = await getDb(dbName);
  return db.getAllFromIndex(HIGHLIGHTS_STORE_NAME, "tweetId", tweetId);
}

export interface HighlightCounts {
  highlights: number;
  notes: number;
}

export async function getHighlightCountsByTweetIds(
  tweetIds: string[],
  dbName: string = activeDbName,
): Promise<Map<string, HighlightCounts>> {
  const result = new Map<string, HighlightCounts>();
  if (tweetIds.length === 0) return result;
  const db = await getDb(dbName);
  const index = db.transaction(HIGHLIGHTS_STORE_NAME, "readonly").store.index("tweetId");
  const entries = await Promise.all(tweetIds.map(async (tweetId) => {
    const highlights = await index.getAll(IDBKeyRange.only(tweetId));
    if (highlights.length > 0) {
      const notes = highlights.filter((highlight) =>
        highlight.type === "note" || Boolean(highlight.note)
      ).length;
      return [tweetId, {
        highlights: highlights.length - notes,
        notes,
      }] as const;
    }
    return null;
  }));
  for (const entry of entries) {
    if (entry) result.set(entry[0], entry[1]);
  }
  return result;
}

/**
 * Build a lightweight per-bookmark signals map for ranking — last-read
 * timestamp and reopen count. Used by the search engine's `boostDocument`.
 */
export async function getBookmarkSignals(
  dbName: string = activeDbName,
): Promise<
  Map<string, { lastReadAt?: number; reopenCount?: number }>
> {
  const out = new Map<string, { lastReadAt?: number; reopenCount?: number }>();
  try {
    const all = await getAllReadingProgress(dbName);
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

export async function getTodayQueueSnapshot(
  key: string,
  dbName: string = activeDbName,
): Promise<TodayQueueSnapshot | null> {
  if (!key) return null;
  const db = await getDb(dbName);
  return (await db.get(TODAY_QUEUE_SNAPSHOTS_STORE_NAME, key)) ?? null;
}

export async function upsertTodayQueueSnapshot(
  snapshot: TodayQueueSnapshot,
  dbName: string = activeDbName,
): Promise<void> {
  await upsertTodayQueueSnapshots([snapshot], dbName);
}

export async function upsertTodayQueueSnapshots(
  snapshots: TodayQueueSnapshot[],
  dbName: string = activeDbName,
): Promise<void> {
  if (snapshots.length === 0) return;
  const db = await getDb(dbName);
  const tx = db.transaction(TODAY_QUEUE_SNAPSHOTS_STORE_NAME, "readwrite");
  for (const snapshot of snapshots) {
    tx.store.put(snapshot);
  }
  await tx.done;
  emitReaderActivity();
}

export async function deleteTodayQueueSnapshot(
  key: string,
  dbName: string = activeDbName,
): Promise<void> {
  if (!key) return;
  const db = await getDb(dbName);
  await db.delete(TODAY_QUEUE_SNAPSHOTS_STORE_NAME, key);
  emitReaderActivity();
}

export async function getQueueBookmarkMetadataByTweetId(
  tweetId: string,
  dbName: string = activeDbName,
): Promise<BookmarkQueueMetadata | null> {
  if (!tweetId) return null;
  const db = await getDb(dbName);
  return (await db.get(BOOKMARK_QUEUE_METADATA_STORE_NAME, tweetId)) ?? null;
}

export async function getAllQueueBookmarkMetadata(
  dbName: string = activeDbName,
): Promise<
  BookmarkQueueMetadata[]
> {
  const db = await getDb(dbName);
  return db.getAll(BOOKMARK_QUEUE_METADATA_STORE_NAME);
}

export async function getAllTodayQueueSnapshots(
  dbName: string = activeDbName,
): Promise<
  TodayQueueSnapshot[]
> {
  const db = await getDb(dbName);
  return db.getAll(TODAY_QUEUE_SNAPSHOTS_STORE_NAME);
}

// Thin shell around the pure stale-key decision: drop any daily-set record left
// behind by an earlier scoring version (including imported older-version
// records). All stale keys are removed in a single readwrite transaction so the
// sweep is one commit and one reader-activity emit, not one per key. Safe to
// call with no records — it simply deletes nothing.
export async function sweepStaleTodayQueueSnapshots(
  dbName: string = activeDbName,
): Promise<void> {
  const db = await getDb(dbName);
  const records = await db.getAll(TODAY_QUEUE_SNAPSHOTS_STORE_NAME);
  const staleKeys = selectStaleTodayQueueSnapshotKeys(records);
  if (staleKeys.length === 0) return;
  const tx = db.transaction(TODAY_QUEUE_SNAPSHOTS_STORE_NAME, "readwrite");
  for (const key of staleKeys) {
    if (key) tx.store.delete(key);
  }
  await tx.done;
  emitReaderActivity();
}

export async function getAllTodayQueueExposures(
  dbName: string = activeDbName,
): Promise<
  TodayQueueExposure[]
> {
  const db = await getDb(dbName);
  return db.getAll(TODAY_QUEUE_EXPOSURES_STORE_NAME);
}

export function iterateTodayQueueSnapshots(
  dbName: string = activeDbName,
): AsyncIterable<TodayQueueSnapshot> {
  return {
    async *[Symbol.asyncIterator](): AsyncIterator<TodayQueueSnapshot> {
      const db = await getDb(dbName);
      const rows = await db.getAll(TODAY_QUEUE_SNAPSHOTS_STORE_NAME);
      for (const row of rows) yield row;
    },
  };
}

export function iterateQueueBookmarkMetadata(
  dbName: string = activeDbName,
): AsyncIterable<
  BookmarkQueueMetadata
> {
  return {
    async *[Symbol.asyncIterator](): AsyncIterator<BookmarkQueueMetadata> {
      const db = await getDb(dbName);
      const rows = await db.getAll(BOOKMARK_QUEUE_METADATA_STORE_NAME);
      for (const row of rows) yield row;
    },
  };
}

export function iterateTodayQueueExposures(
  dbName: string = activeDbName,
): AsyncIterable<
  TodayQueueExposure
> {
  return {
    async *[Symbol.asyncIterator](): AsyncIterator<TodayQueueExposure> {
      const db = await getDb(dbName);
      const rows = await db.getAll(TODAY_QUEUE_EXPOSURES_STORE_NAME);
      for (const row of rows) yield row;
    },
  };
}

export async function upsertQueueBookmarkMetadataRows(
  rows: BookmarkQueueMetadata[],
  dbName: string = activeDbName,
): Promise<void> {
  if (rows.length === 0) return;
  const db = await getDb(dbName);
  const tx = db.transaction(BOOKMARK_QUEUE_METADATA_STORE_NAME, "readwrite");
  for (const row of rows) {
    tx.store.put(row);
  }
  await tx.done;
  emitReaderActivity();
}

export async function upsertQueueBookmarkMetadata(
  row: BookmarkQueueMetadata,
  dbName: string = activeDbName,
): Promise<void> {
  await upsertQueueBookmarkMetadataRows([row], dbName);
}

export async function deleteQueueBookmarkMetadata(
  tweetId: string,
  dbName: string = activeDbName,
): Promise<void> {
  if (!tweetId) return;
  const db = await getDb(dbName);
  await db.delete(BOOKMARK_QUEUE_METADATA_STORE_NAME, tweetId);
  emitReaderActivity();
}

export async function recordTodayQueueExposures(
  exposures: TodayQueueExposure[],
  dbName: string = activeDbName,
): Promise<void> {
  await upsertTodayQueueExposures(exposures, dbName);
}

export async function upsertTodayQueueExposures(
  exposures: TodayQueueExposure[],
  dbName: string = activeDbName,
): Promise<void> {
  if (exposures.length === 0) return;
  const db = await getDb(dbName);
  const tx = db.transaction(TODAY_QUEUE_EXPOSURES_STORE_NAME, "readwrite");
  for (const exposure of exposures) {
    tx.store.put(exposure);
  }
  await tx.done;
  emitReaderActivity();
}

export async function getTodayQueueExposuresSince(
  sinceMs: number,
  dbName: string = activeDbName,
): Promise<TodayQueueExposure[]> {
  const db = await getDb(dbName);
  const tx = db.transaction(TODAY_QUEUE_EXPOSURES_STORE_NAME, "readonly");
  const rows: TodayQueueExposure[] = [];
  let cursor = await tx.store.index("createdAt").openCursor(
    IDBKeyRange.lowerBound(sinceMs),
    "prev",
  );
  while (cursor) {
    rows.push(cursor.value);
    cursor = await cursor.continue();
  }
  await tx.done;
  return rows;
}

// ─── Search index persistence ────────────────────────────────────────────

/** Load the serialized MiniSearch index, or null if none exists / is stale. */
export async function loadSearchIndexJson(
  dbName: string = activeDbName,
): Promise<string | null> {
  try {
    const db = await getDb(dbName);
    const row = await db.get(SEARCH_INDEX_STORE_NAME, SEARCH_INDEX_KEY);
    return row?.json ?? null;
  } catch {
    return null;
  }
}

export async function saveSearchIndexJson(
  json: string,
  dbName: string = activeDbName,
): Promise<void> {
  try {
    const db = await getDb(dbName);
    await db.put(SEARCH_INDEX_STORE_NAME, {
      id: SEARCH_INDEX_KEY,
      json,
      savedAt: Date.now(),
    });
  } catch {
    // Persistence is a cache, never authoritative — silent on failure.
  }
}

export async function clearSearchIndexJson(
  dbName: string = activeDbName,
): Promise<void> {
  try {
    const db = await getDb(dbName);
    await db.delete(SEARCH_INDEX_STORE_NAME, SEARCH_INDEX_KEY);
  } catch {
    // ignore
  }
}

export async function findNextBookmarkNeedingHydration(
  dbName: string = activeDbName,
): Promise<string | null> {
  const [detailedIds, db] = await Promise.all([
    getDetailedTweetIds(dbName),
    getDb(dbName),
  ]);
  const tx = db.transaction(STORE_NAME, "readonly");
  let cursor = await tx.store.openCursor();
  while (cursor) {
    if (!detailedIds.has(cursor.value.tweetId)) {
      return cursor.value.tweetId;
    }
    cursor = await cursor.continue();
  }
  await tx.done;
  return null;
}

export async function countBookmarksNeedingHydration(
  dbName: string = activeDbName,
): Promise<number> {
  const [detailedIds, db] = await Promise.all([
    getDetailedTweetIds(dbName),
    getDb(dbName),
  ]);
  const tx = db.transaction(STORE_NAME, "readonly");
  let count = 0;
  let cursor = await tx.store.openCursor();
  while (cursor) {
    if (!detailedIds.has(cursor.value.tweetId)) {
      count++;
    }
    cursor = await cursor.continue();
  }
  await tx.done;
  return count;
}

export async function getAllTweetDetails(
  dbName: string = activeDbName,
): Promise<TweetDetailCache[]> {
  const db = await getDb(dbName);
  return db.getAll(DETAIL_STORE_NAME);
}

export async function getAllHighlights(
  dbName: string = activeDbName,
): Promise<Highlight[]> {
  const db = await getDb(dbName);
  return db.getAll(HIGHLIGHTS_STORE_NAME);
}

export function iterateTweetDetails(
  dbName: string = activeDbName,
): AsyncIterable<TweetDetailCache> {
  return {
    async *[Symbol.asyncIterator](): AsyncIterator<TweetDetailCache> {
      const db = await getDb(dbName);
      const tx = db.transaction(DETAIL_STORE_NAME, "readonly");
      const keys: string[] = [];
      let cursor = await tx.store.openKeyCursor();
      while (cursor) {
        keys.push(cursor.key as string);
        cursor = await cursor.continue();
      }
      await tx.done;

      for (const key of keys) {
        const row = await db.get(DETAIL_STORE_NAME, key);
        if (row) yield row;
      }
    },
  };
}

export function iterateHighlights(
  dbName: string = activeDbName,
): AsyncIterable<Highlight> {
  return {
    async *[Symbol.asyncIterator](): AsyncIterator<Highlight> {
      const db = await getDb(dbName);
      const tx = db.transaction(HIGHLIGHTS_STORE_NAME, "readonly");
      const keys: string[] = [];
      let cursor = await tx.store.openKeyCursor();
      while (cursor) {
        keys.push(cursor.key as string);
        cursor = await cursor.continue();
      }
      await tx.done;

      for (const key of keys) {
        const row = await db.get(HIGHLIGHTS_STORE_NAME, key);
        if (row) yield row;
      }
    },
  };
}

export async function cleanupOldTweetDetails(
  maxAgeMs: number,
  dbName: string = activeDbName,
): Promise<number> {
  if (!Number.isFinite(maxAgeMs) || maxAgeMs <= 0) return 0;

  const cutoff = Date.now() - maxAgeMs;
  const db = await getDb(dbName);
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

export interface AccountDb {
  upsertBookmarks(bookmarks: Bookmark[]): Promise<void>;
  getBookmarkById(id: string): Promise<Bookmark | null>;
  iterateBookmarks(): AsyncIterable<Bookmark>;
  getAllBookmarks(): Promise<Bookmark[]>;
  clearAllLocalData(): Promise<void>;
  clearTransientStores(): Promise<void>;
  deleteBookmarksByTweetIds(
    tweetIds: string[],
    options?: DeleteBookmarksOptions,
  ): Promise<void>;
  upsertTweetDetailCache(detail: TweetDetailCache): Promise<void>;
  upsertTweetDetailCaches(details: TweetDetailCache[]): Promise<void>;
  getTweetDetailCache(tweetId: string): Promise<TweetDetailCache | null>;
  upsertReadingProgress(progress: ReadingProgress): Promise<void>;
  upsertReadingProgressRows(progressRows: ReadingProgress[]): Promise<void>;
  ensureReadingProgressExists(tweetId: string): Promise<void>;
  markReadingProgressCompleted(tweetId: string): Promise<void>;
  markReadingProgressUncompleted(tweetId: string): Promise<void>;
  getReadingProgress(tweetId: string): Promise<ReadingProgress | null>;
  getAllReadingProgress(): Promise<ReadingProgress[]>;
  iterateReadingProgress(): AsyncIterable<ReadingProgress>;
  getDetailedTweetIds(): Promise<Set<string>>;
  getCompletedTweetIds(): Promise<Set<string>>;
  upsertHighlight(highlight: Highlight): Promise<void>;
  upsertHighlights(highlights: Highlight[]): Promise<void>;
  deleteHighlight(id: string): Promise<void>;
  getHighlightById(id: string): Promise<Highlight | null>;
  getHighlightsByTweetId(tweetId: string): Promise<Highlight[]>;
  getHighlightCountsByTweetIds(
    tweetIds: string[],
  ): Promise<Map<string, HighlightCounts>>;
  getBookmarkSignals(): Promise<
    Map<string, { lastReadAt?: number; reopenCount?: number }>
  >;
  getTodayQueueSnapshot(key: string): Promise<TodayQueueSnapshot | null>;
  upsertTodayQueueSnapshot(snapshot: TodayQueueSnapshot): Promise<void>;
  upsertTodayQueueSnapshots(snapshots: TodayQueueSnapshot[]): Promise<void>;
  deleteTodayQueueSnapshot(key: string): Promise<void>;
  getQueueBookmarkMetadataByTweetId(
    tweetId: string,
  ): Promise<BookmarkQueueMetadata | null>;
  getAllQueueBookmarkMetadata(): Promise<BookmarkQueueMetadata[]>;
  getAllTodayQueueSnapshots(): Promise<TodayQueueSnapshot[]>;
  sweepStaleTodayQueueSnapshots(): Promise<void>;
  getAllTodayQueueExposures(): Promise<TodayQueueExposure[]>;
  iterateTodayQueueSnapshots(): AsyncIterable<TodayQueueSnapshot>;
  iterateQueueBookmarkMetadata(): AsyncIterable<BookmarkQueueMetadata>;
  iterateTodayQueueExposures(): AsyncIterable<TodayQueueExposure>;
  upsertQueueBookmarkMetadataRows(rows: BookmarkQueueMetadata[]): Promise<void>;
  upsertQueueBookmarkMetadata(row: BookmarkQueueMetadata): Promise<void>;
  deleteQueueBookmarkMetadata(tweetId: string): Promise<void>;
  recordTodayQueueExposures(exposures: TodayQueueExposure[]): Promise<void>;
  upsertTodayQueueExposures(exposures: TodayQueueExposure[]): Promise<void>;
  getTodayQueueExposuresSince(sinceMs: number): Promise<TodayQueueExposure[]>;
  loadSearchIndexJson(): Promise<string | null>;
  saveSearchIndexJson(json: string): Promise<void>;
  clearSearchIndexJson(): Promise<void>;
  findNextBookmarkNeedingHydration(): Promise<string | null>;
  countBookmarksNeedingHydration(): Promise<number>;
  getAllTweetDetails(): Promise<TweetDetailCache[]>;
  getAllHighlights(): Promise<Highlight[]>;
  iterateTweetDetails(): AsyncIterable<TweetDetailCache>;
  iterateHighlights(): AsyncIterable<Highlight>;
  cleanupOldTweetDetails(maxAgeMs: number): Promise<number>;
}

const accountDbHandles = new Map<string, AccountDb>();

export function openAccountDb(accountId: string | null): AccountDb {
  const dbName = getDbNameForAccount(accountId);
  const existing = accountDbHandles.get(dbName);
  if (existing) return existing;

  const handle: AccountDb = {
    upsertBookmarks: (bookmarks) => upsertBookmarks(bookmarks, dbName),
    getBookmarkById: (id) => getBookmarkById(id, dbName),
    iterateBookmarks: () => iterateBookmarks(dbName),
    getAllBookmarks: () => getAllBookmarks(dbName),
    clearAllLocalData: () => clearAllLocalData(dbName),
    clearTransientStores: () => clearTransientStores(dbName),
    deleteBookmarksByTweetIds: (tweetIds, options) =>
      deleteBookmarksByTweetIds(tweetIds, options, dbName),
    upsertTweetDetailCache: (detail) => upsertTweetDetailCache(detail, dbName),
    upsertTweetDetailCaches: (details) =>
      upsertTweetDetailCaches(details, dbName),
    getTweetDetailCache: (tweetId) => getTweetDetailCache(tweetId, dbName),
    upsertReadingProgress: (progress) =>
      upsertReadingProgress(progress, dbName),
    upsertReadingProgressRows: (progressRows) =>
      upsertReadingProgressRows(progressRows, dbName),
    ensureReadingProgressExists: (tweetId) =>
      ensureReadingProgressExists(tweetId, dbName),
    markReadingProgressCompleted: (tweetId) =>
      markReadingProgressCompleted(tweetId, dbName),
    markReadingProgressUncompleted: (tweetId) =>
      markReadingProgressUncompleted(tweetId, dbName),
    getReadingProgress: (tweetId) => getReadingProgress(tweetId, dbName),
    getAllReadingProgress: () => getAllReadingProgress(dbName),
    iterateReadingProgress: () => iterateReadingProgress(dbName),
    getDetailedTweetIds: () => getDetailedTweetIds(dbName),
    getCompletedTweetIds: () => getCompletedTweetIds(dbName),
    upsertHighlight: (highlight) => upsertHighlight(highlight, dbName),
    upsertHighlights: (highlights) => upsertHighlights(highlights, dbName),
    deleteHighlight: (id) => deleteHighlight(id, dbName),
    getHighlightById: (id) => getHighlightById(id, dbName),
    getHighlightsByTweetId: (tweetId) =>
      getHighlightsByTweetId(tweetId, dbName),
    getHighlightCountsByTweetIds: (tweetIds) =>
      getHighlightCountsByTweetIds(tweetIds, dbName),
    getBookmarkSignals: () => getBookmarkSignals(dbName),
    getTodayQueueSnapshot: (key) => getTodayQueueSnapshot(key, dbName),
    upsertTodayQueueSnapshot: (snapshot) =>
      upsertTodayQueueSnapshot(snapshot, dbName),
    upsertTodayQueueSnapshots: (snapshots) =>
      upsertTodayQueueSnapshots(snapshots, dbName),
    deleteTodayQueueSnapshot: (key) => deleteTodayQueueSnapshot(key, dbName),
    getQueueBookmarkMetadataByTweetId: (tweetId) =>
      getQueueBookmarkMetadataByTweetId(tweetId, dbName),
    getAllQueueBookmarkMetadata: () => getAllQueueBookmarkMetadata(dbName),
    getAllTodayQueueSnapshots: () => getAllTodayQueueSnapshots(dbName),
    sweepStaleTodayQueueSnapshots: () =>
      sweepStaleTodayQueueSnapshots(dbName),
    getAllTodayQueueExposures: () => getAllTodayQueueExposures(dbName),
    iterateTodayQueueSnapshots: () => iterateTodayQueueSnapshots(dbName),
    iterateQueueBookmarkMetadata: () => iterateQueueBookmarkMetadata(dbName),
    iterateTodayQueueExposures: () => iterateTodayQueueExposures(dbName),
    upsertQueueBookmarkMetadataRows: (rows) =>
      upsertQueueBookmarkMetadataRows(rows, dbName),
    upsertQueueBookmarkMetadata: (row) =>
      upsertQueueBookmarkMetadata(row, dbName),
    deleteQueueBookmarkMetadata: (tweetId) =>
      deleteQueueBookmarkMetadata(tweetId, dbName),
    recordTodayQueueExposures: (exposures) =>
      recordTodayQueueExposures(exposures, dbName),
    upsertTodayQueueExposures: (exposures) =>
      upsertTodayQueueExposures(exposures, dbName),
    getTodayQueueExposuresSince: (sinceMs) =>
      getTodayQueueExposuresSince(sinceMs, dbName),
    loadSearchIndexJson: () => loadSearchIndexJson(dbName),
    saveSearchIndexJson: (json) => saveSearchIndexJson(json, dbName),
    clearSearchIndexJson: () => clearSearchIndexJson(dbName),
    findNextBookmarkNeedingHydration: () =>
      findNextBookmarkNeedingHydration(dbName),
    countBookmarksNeedingHydration: () =>
      countBookmarksNeedingHydration(dbName),
    getAllTweetDetails: () => getAllTweetDetails(dbName),
    getAllHighlights: () => getAllHighlights(dbName),
    iterateTweetDetails: () => iterateTweetDetails(dbName),
    iterateHighlights: () => iterateHighlights(dbName),
    cleanupOldTweetDetails: (maxAgeMs) =>
      cleanupOldTweetDetails(maxAgeMs, dbName),
  };

  accountDbHandles.set(dbName, handle);
  return handle;
}
