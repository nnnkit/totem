import { unzipSync } from "fflate";
import { DB_VERSION } from "../constants/db";
import {
  getAllBookmarks,
  getAllTweetDetails,
  getAllHighlights,
  getAllReadingProgress,
  upsertBookmarks,
  upsertTweetDetailCaches,
  upsertHighlights,
  upsertReadingProgressRows,
} from "../../db";
import { sha256hex } from "../crypto";
import type {
  Bookmark,
  TweetDetailCache,
  Highlight,
  ReadingProgress,
} from "../../types";

export type RefusedReason =
  | "not_totem_export"
  | "schema_too_new"
  | "checksum_mismatch"
  | "not_logged_in"
  | "empty_zip"
  | "too_large";

export interface ImportManifest {
  totem: { export_version: number; schema_version: number };
  account: { id_hash: string; handle_redacted: string };
  counts: {
    bookmarks: number;
    details: number;
    highlights: number;
    reading_progress: number;
  };
  shards: {
    bookmarks: string[];
    details: string[];
    highlights: string[];
    reading_progress: string[];
  };
  checksums: Record<string, string>;
}

export interface ImportStoreCounts {
  added: number;
  alreadyHad: number;
  total: number;
}

export type ImportStoreOutcome =
  | ({ status: "succeeded" } & ImportStoreCounts)
  | ({ status: "failed"; message: string } & ImportStoreCounts);

export interface ImportResult {
  status: "complete" | "partial";
  bookmarks: ImportStoreOutcome;
  details: ImportStoreOutcome;
  highlights: ImportStoreOutcome;
  readingProgress: ImportStoreOutcome;
}

export type ParsedZip =
  | { ok: true; manifest: ImportManifest; files: Record<string, Uint8Array> }
  | { ok: false; reason: RefusedReason };

export type ValidatedImport =
  | { ok: true; manifest: ImportManifest; files: Record<string, Uint8Array>; accountMatch: boolean }
  | { ok: false; reason: RefusedReason };

const SUPPORTED_EXPORT_VERSION = 1;
const JSONL_PARSE_CHUNK_SIZE = 64 * 1024;
// Bound the work a single ZIP can force. unzipSync inflates everything into
// memory synchronously on the main thread, so a zip bomb (tiny compressed,
// petabytes inflated) could hang or OOM the tab. The filter sees each entry's
// declared uncompressed size before it is inflated, so we can bail early.
export const MAX_INPUT_ZIP_BYTES = 2 * 1024 * 1024 * 1024; // 2 GiB compressed
const MAX_TOTAL_UNCOMPRESSED_BYTES = 1024 * 1024 * 1024; // 1 GiB inflated

class ImportZipTooLargeError extends Error {}

export class ImportPartialFailure extends Error {
  result: ImportResult;

  constructor(result: ImportResult) {
    super("Import completed with some failed stores");
    this.name = "ImportPartialFailure";
    this.result = result;
  }
}

class ImportJsonlParseError extends Error {
  constructor(path: string, lineNumber: number, cause: unknown) {
    const message = cause instanceof Error ? cause.message : "Invalid JSON";
    super(`${path}:${lineNumber}: ${message}`);
    this.name = "ImportJsonlParseError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isImportableAuthor(value: unknown): value is Bookmark["author"] {
  return (
    isRecord(value) &&
    typeof value.name === "string" &&
    typeof value.screenName === "string" &&
    typeof value.profileImageUrl === "string"
  );
}

function isImportableBookmark(value: unknown): value is Bookmark {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.tweetId === "string" &&
    typeof value.text === "string" &&
    isNumber(value.createdAt) &&
    typeof value.sortIndex === "string" &&
    typeof value.bookmarked === "boolean" &&
    isImportableAuthor(value.author) &&
    isRecord(value.metrics) &&
    Array.isArray(value.media) &&
    Array.isArray(value.urls) &&
    typeof value.isThread === "boolean" &&
    typeof value.hasImage === "boolean" &&
    typeof value.hasVideo === "boolean" &&
    typeof value.hasLink === "boolean"
  );
}

function isImportableDetail(value: unknown): value is TweetDetailCache {
  return (
    isRecord(value) &&
    typeof value.tweetId === "string" &&
    isNumber(value.fetchedAt) &&
    (value.focalTweet === null || isImportableBookmark(value.focalTweet)) &&
    Array.isArray(value.thread)
  );
}

function isImportableHighlight(value: unknown): value is Highlight {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.tweetId === "string" &&
    typeof value.sectionId === "string" &&
    isNumber(value.startOffset) &&
    isNumber(value.endOffset) &&
    typeof value.selectedText === "string" &&
    (value.note === null || typeof value.note === "string") &&
    typeof value.color === "string" &&
    isNumber(value.createdAt)
  );
}

function isImportableReadingProgress(value: unknown): value is ReadingProgress {
  return (
    isRecord(value) &&
    typeof value.tweetId === "string" &&
    isNumber(value.openedAt) &&
    isNumber(value.lastReadAt) &&
    isNumber(value.scrollY) &&
    isNumber(value.scrollHeight) &&
    typeof value.completed === "boolean"
  );
}

function isCountMap(value: unknown): value is ImportManifest["counts"] {
  if (!isRecord(value)) return false;
  return (
    typeof value.bookmarks === "number" &&
    typeof value.details === "number" &&
    typeof value.highlights === "number" &&
    typeof value.reading_progress === "number"
  );
}

function isShardMap(value: unknown): value is ImportManifest["shards"] {
  if (!isRecord(value)) return false;
  return (
    isStringArray(value.bookmarks) &&
    isStringArray(value.details) &&
    isStringArray(value.highlights) &&
    isStringArray(value.reading_progress)
  );
}

function isChecksumMap(value: unknown): value is Record<string, string> {
  return isRecord(value) && Object.values(value).every((item) => typeof item === "string");
}

function isImportManifest(value: unknown): value is ImportManifest {
  if (!isRecord(value)) return false;
  const totem = value.totem;
  const account = value.account;
  return (
    isRecord(totem) &&
    typeof totem.export_version === "number" &&
    typeof totem.schema_version === "number" &&
    isRecord(account) &&
    typeof account.id_hash === "string" &&
    typeof account.handle_redacted === "string" &&
    isCountMap(value.counts) &&
    isShardMap(value.shards) &&
    isChecksumMap(value.checksums)
  );
}

export interface ParseZipLimits {
  maxInputBytes?: number;
  maxUncompressedBytes?: number;
}

export function parseZip(file: Uint8Array, limits: ParseZipLimits = {}): ParsedZip {
  const maxInputBytes = limits.maxInputBytes ?? MAX_INPUT_ZIP_BYTES;
  const maxUncompressedBytes = limits.maxUncompressedBytes ?? MAX_TOTAL_UNCOMPRESSED_BYTES;

  if (file.byteLength > maxInputBytes) {
    return { ok: false, reason: "too_large" };
  }

  let entries: Record<string, Uint8Array>;
  try {
    let totalUncompressed = 0;
    entries = unzipSync(file, {
      filter: (info) => {
        totalUncompressed += info.originalSize;
        if (
          info.originalSize > maxUncompressedBytes ||
          totalUncompressed > maxUncompressedBytes
        ) {
          // Refuse before inflating the oversized entry.
          throw new ImportZipTooLargeError();
        }
        return true;
      },
    });
  } catch (error) {
    if (error instanceof ImportZipTooLargeError) {
      return { ok: false, reason: "too_large" };
    }
    return { ok: false, reason: "not_totem_export" };
  }

  const manifestBytes = entries["manifest.json"];
  if (!manifestBytes) {
    return { ok: false, reason: "not_totem_export" };
  }

  let manifest: unknown;
  try {
    manifest = JSON.parse(new TextDecoder().decode(manifestBytes));
  } catch {
    return { ok: false, reason: "not_totem_export" };
  }

  if (!isImportManifest(manifest)) {
    return { ok: false, reason: "not_totem_export" };
  }

  const hasData =
    manifest.shards &&
    (manifest.shards.bookmarks?.length > 0 ||
      manifest.shards.details?.length > 0 ||
      manifest.shards.highlights?.length > 0 ||
      manifest.shards.reading_progress?.length > 0);

  if (!hasData) {
    return { ok: false, reason: "empty_zip" };
  }

  return { ok: true, manifest, files: entries };
}

export async function validateImport(
  parsed: Extract<ParsedZip, { ok: true }>,
  activeAccountUserId: string | null,
): Promise<ValidatedImport> {
  const { manifest, files } = parsed;

  if (manifest.totem.export_version > SUPPORTED_EXPORT_VERSION) {
    return { ok: false, reason: "schema_too_new" };
  }

  if (manifest.totem.export_version !== SUPPORTED_EXPORT_VERSION) {
    return { ok: false, reason: "not_totem_export" };
  }

  if (manifest.totem.schema_version > DB_VERSION) {
    return { ok: false, reason: "schema_too_new" };
  }

  if (!activeAccountUserId) {
    return { ok: false, reason: "not_logged_in" };
  }

  const allShards = [
    ...(manifest.shards.bookmarks || []),
    ...(manifest.shards.details || []),
    ...(manifest.shards.highlights || []),
    ...(manifest.shards.reading_progress || []),
  ];
  const checksumResults = await Promise.all(allShards.map(async (shard) => {
    const expected = manifest.checksums?.[shard];
    if (!expected) {
      return false;
    }
    const data = files[shard];
    if (!data) {
      return false;
    }
    const actual = `sha256:${await sha256hex(data)}`;
    return actual === expected;
  }));
  if (checksumResults.some((ok) => !ok)) {
    return { ok: false, reason: "checksum_mismatch" };
  }

  const encoder = new TextEncoder();
  const userIdHash = `sha256:${await sha256hex(encoder.encode(activeAccountUserId))}`;
  const accountMatch = manifest.account?.id_hash === userIdHash;

  return { ok: true, manifest, files, accountMatch };
}

function parseJsonlLine(path: string, lineNumber: number, line: string): unknown | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch (error) {
    throw new ImportJsonlParseError(path, lineNumber, error);
  }
}

function* parseJsonlRows(path: string, data: Uint8Array): Generator<unknown> {
  const decoder = new TextDecoder();
  let carry = "";
  let lineNumber = 0;

  for (let offset = 0; offset < data.byteLength; offset += JSONL_PARSE_CHUNK_SIZE) {
    const end = Math.min(offset + JSONL_PARSE_CHUNK_SIZE, data.byteLength);
    carry += decoder.decode(data.subarray(offset, end), {
      stream: end < data.byteLength,
    });

    let lineStart = 0;
    let newlineIndex = carry.indexOf("\n", lineStart);
    while (newlineIndex !== -1) {
      const parsed = parseJsonlLine(
        path,
        ++lineNumber,
        carry.slice(lineStart, newlineIndex),
      );
      if (parsed !== null) yield parsed;
      lineStart = newlineIndex + 1;
      newlineIndex = carry.indexOf("\n", lineStart);
    }
    carry = carry.slice(lineStart);
  }

  carry += decoder.decode();
  if (carry.length > 0) {
    const parsed = parseJsonlLine(path, ++lineNumber, carry);
    if (parsed !== null) yield parsed;
  }
}

function gatherShardRows(
  shards: string[],
  files: Record<string, Uint8Array>,
): unknown[] {
  const rows: unknown[] = [];
  for (const shard of shards) {
    const data = files[shard];
    if (!data) continue;
    for (const row of parseJsonlRows(shard, data)) {
      rows.push(row);
    }
  }
  return rows;
}

const BATCH_SIZE = 500;

function dedupeRowsByStringKey<T>(
  rows: T[],
  getKey: (row: T) => unknown,
): T[] {
  const byKey = new Map<string, T>();
  for (const row of rows) {
    const key = getKey(row);
    // A row missing its primary key can't be imported (it has no identity), but
    // it must not take down the whole store — skip it and keep the valid rows.
    if (typeof key !== "string" || key.length === 0) continue;
    byKey.set(key, row);
  }
  return Array.from(byKey.values());
}

async function writeBatches<T>(
  rows: T[],
  writeBatch: (batch: T[]) => Promise<void>,
  counts: ImportStoreCounts,
): Promise<void> {
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    await writeBatch(batch);
    counts.added += batch.length;
  }
}

export type ImportStoreProgress = {
  store: "bookmarks" | "details" | "highlights" | "reading_progress";
  added: number;
  alreadyHad: number;
  total: number;
};

function emptyOutcome(): ImportStoreOutcome {
  return {
    status: "succeeded",
    added: 0,
    alreadyHad: 0,
    total: 0,
  };
}

function failOutcome(
  counts: ImportStoreCounts,
  error: unknown,
): ImportStoreOutcome {
  return {
    status: "failed",
    added: counts.added,
    alreadyHad: counts.alreadyHad,
    total: counts.total,
    message: error instanceof Error ? error.message : "Import failed",
  };
}

export async function runImport(
  validated: Extract<ValidatedImport, { ok: true }>,
  onProgress?: (progress: ImportStoreProgress) => void,
): Promise<ImportResult> {
  const { manifest, files } = validated;

  const result: ImportResult = {
    status: "complete",
    bookmarks: emptyOutcome(),
    details: emptyOutcome(),
    highlights: emptyOutcome(),
    readingProgress: emptyOutcome(),
  };

  // Bookmarks — keyed by `id`
  let bookmarkCounts: ImportStoreCounts = { added: 0, alreadyHad: 0, total: 0 };
  try {
    const rawRows = gatherShardRows(manifest.shards.bookmarks || [], files);
    bookmarkCounts.total = rawRows.length;
    const rows = dedupeRowsByStringKey(
      rawRows.filter(isImportableBookmark),
      (row) => row.id,
    );
    bookmarkCounts.total = rows.length;
    const existingBookmarks = await getAllBookmarks();
    const existingIds = new Set(existingBookmarks.map((b) => b.id));
    const toInsert: Bookmark[] = [];

    for (const row of rows) {
      if (existingIds.has(row.id)) {
        bookmarkCounts.alreadyHad++;
      } else {
        toInsert.push(row);
      }
    }

    await writeBatches(toInsert, upsertBookmarks, bookmarkCounts);
    result.bookmarks = { status: "succeeded", ...bookmarkCounts };
    onProgress?.({ store: "bookmarks", ...result.bookmarks, total: bookmarkCounts.total });
  } catch (error) {
    result.status = "partial";
    result.bookmarks = failOutcome(bookmarkCounts, error);
  }

  // Details — keyed by `tweetId`
  let detailsCounts: ImportStoreCounts = { added: 0, alreadyHad: 0, total: 0 };
  try {
    const rawRows = gatherShardRows(manifest.shards.details || [], files);
    detailsCounts.total = rawRows.length;
    const rows = dedupeRowsByStringKey(
      rawRows.filter(isImportableDetail),
      (row) => row.tweetId,
    );
    detailsCounts.total = rows.length;
    const existingDetails = await getAllTweetDetails();
    const existingIds = new Set(existingDetails.map((d) => d.tweetId));

    const toInsert: TweetDetailCache[] = [];
    for (const row of rows) {
      if (existingIds.has(row.tweetId)) {
        detailsCounts.alreadyHad++;
      } else {
        toInsert.push(row);
      }
    }
    await writeBatches(toInsert, upsertTweetDetailCaches, detailsCounts);
    result.details = { status: "succeeded", ...detailsCounts };
    onProgress?.({ store: "details", ...result.details, total: detailsCounts.total });
  } catch (error) {
    result.status = "partial";
    result.details = failOutcome(detailsCounts, error);
  }

  // Highlights — keyed by `id`
  let highlightCounts: ImportStoreCounts = { added: 0, alreadyHad: 0, total: 0 };
  try {
    const rawRows = gatherShardRows(manifest.shards.highlights || [], files);
    highlightCounts.total = rawRows.length;
    const rows = dedupeRowsByStringKey(
      rawRows.filter(isImportableHighlight),
      (row) => row.id,
    );
    highlightCounts.total = rows.length;
    const existingHighlights = await getAllHighlights();
    const existingIds = new Set(existingHighlights.map((h) => h.id));

    const toInsert: Highlight[] = [];
    for (const row of rows) {
      if (existingIds.has(row.id)) {
        highlightCounts.alreadyHad++;
      } else {
        toInsert.push(row);
      }
    }
    await writeBatches(toInsert, upsertHighlights, highlightCounts);
    result.highlights = { status: "succeeded", ...highlightCounts };
    onProgress?.({ store: "highlights", ...result.highlights, total: highlightCounts.total });
  } catch (error) {
    result.status = "partial";
    result.highlights = failOutcome(highlightCounts, error);
  }

  // Reading progress — keyed by `tweetId`
  let readingProgressCounts: ImportStoreCounts = { added: 0, alreadyHad: 0, total: 0 };
  try {
    const rawRows = gatherShardRows(
      manifest.shards.reading_progress || [],
      files,
    );
    readingProgressCounts.total = rawRows.length;
    const rows = dedupeRowsByStringKey(
      rawRows.filter(isImportableReadingProgress),
      (row) => row.tweetId,
    );
    readingProgressCounts.total = rows.length;
    const existingProgress = await getAllReadingProgress();
    const existingIds = new Set(existingProgress.map((p) => p.tweetId));

    const toInsert: ReadingProgress[] = [];
    for (const row of rows) {
      if (existingIds.has(row.tweetId)) {
        readingProgressCounts.alreadyHad++;
      } else {
        toInsert.push(row);
      }
    }
    await writeBatches(toInsert, upsertReadingProgressRows, readingProgressCounts);
    result.readingProgress = { status: "succeeded", ...readingProgressCounts };
    onProgress?.({
      store: "reading_progress",
      ...result.readingProgress,
      total: readingProgressCounts.total,
    });
  } catch (error) {
    result.status = "partial";
    result.readingProgress = failOutcome(readingProgressCounts, error);
  }

  if (result.status === "partial") {
    throw new ImportPartialFailure(result);
  }

  return result;
}
