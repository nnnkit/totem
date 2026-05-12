import { unzipSync } from "fflate";
import { DB_VERSION } from "../constants/db";
import {
  getAllBookmarks,
  getAllTweetDetails,
  getAllHighlights,
  getAllReadingProgress,
  upsertBookmarks,
  upsertTweetDetailCache,
  upsertHighlight,
  upsertReadingProgress,
} from "../../db";
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
  | "empty_zip";

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
}

export interface ImportResult {
  bookmarks: ImportStoreCounts;
  details: ImportStoreCounts;
  highlights: ImportStoreCounts;
  readingProgress: ImportStoreCounts;
}

export type ParsedZip =
  | { ok: true; manifest: ImportManifest; files: Record<string, Uint8Array> }
  | { ok: false; reason: RefusedReason };

export type ValidatedImport =
  | { ok: true; manifest: ImportManifest; files: Record<string, Uint8Array>; accountMatch: boolean }
  | { ok: false; reason: RefusedReason };

async function sha256hex(data: Uint8Array): Promise<string> {
  const buf = new ArrayBuffer(data.byteLength);
  new Uint8Array(buf).set(data);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function parseZip(file: Uint8Array): ParsedZip {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(file);
  } catch {
    return { ok: false, reason: "not_totem_export" };
  }

  const manifestBytes = entries["manifest.json"];
  if (!manifestBytes) {
    return { ok: false, reason: "not_totem_export" };
  }

  let manifest: ImportManifest;
  try {
    manifest = JSON.parse(new TextDecoder().decode(manifestBytes));
  } catch {
    return { ok: false, reason: "not_totem_export" };
  }

  if (
    !manifest.totem ||
    typeof manifest.totem.export_version !== "number" ||
    typeof manifest.totem.schema_version !== "number"
  ) {
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
  for (const shard of allShards) {
    const expected = manifest.checksums?.[shard];
    if (!expected) continue;
    const data = files[shard];
    if (!data) {
      return { ok: false, reason: "checksum_mismatch" };
    }
    const actual = `sha256:${await sha256hex(data)}`;
    if (actual !== expected) {
      return { ok: false, reason: "checksum_mismatch" };
    }
  }

  const encoder = new TextEncoder();
  const userIdHash = `sha256:${await sha256hex(encoder.encode(activeAccountUserId))}`;
  const accountMatch = manifest.account?.id_hash === userIdHash;

  return { ok: true, manifest, files, accountMatch };
}

function parseJsonlLines(data: Uint8Array): unknown[] {
  const text = new TextDecoder().decode(data);
  const rows: unknown[] = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    rows.push(JSON.parse(trimmed));
  }
  return rows;
}

function gatherShardRows(
  shards: string[],
  files: Record<string, Uint8Array>,
): unknown[] {
  const rows: unknown[] = [];
  for (const shard of shards) {
    const data = files[shard];
    if (data) rows.push(...parseJsonlLines(data));
  }
  return rows;
}

const BATCH_SIZE = 500;

export type ImportStoreProgress = {
  store: "bookmarks" | "details" | "highlights" | "reading_progress";
  added: number;
  alreadyHad: number;
  total: number;
};

export async function runImport(
  validated: Extract<ValidatedImport, { ok: true }>,
  onProgress?: (progress: ImportStoreProgress) => void,
): Promise<ImportResult> {
  const { manifest, files } = validated;

  const result: ImportResult = {
    bookmarks: { added: 0, alreadyHad: 0 },
    details: { added: 0, alreadyHad: 0 },
    highlights: { added: 0, alreadyHad: 0 },
    readingProgress: { added: 0, alreadyHad: 0 },
  };

  // Bookmarks — keyed by `id`
  {
    const rows = gatherShardRows(manifest.shards.bookmarks || [], files) as Bookmark[];
    const total = rows.length;
    const existingBookmarks = await getAllBookmarks();
    const existingIds = new Set(existingBookmarks.map((b) => b.id));
    const toInsert: Bookmark[] = [];

    for (const row of rows) {
      if (existingIds.has(row.id)) {
        result.bookmarks.alreadyHad++;
      } else {
        toInsert.push(row);
        result.bookmarks.added++;
      }
    }

    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
      await upsertBookmarks(toInsert.slice(i, i + BATCH_SIZE));
    }
    onProgress?.({ store: "bookmarks", ...result.bookmarks, total });
  }

  // Details — keyed by `tweetId`
  {
    const rows = gatherShardRows(manifest.shards.details || [], files) as TweetDetailCache[];
    const total = rows.length;
    const existingDetails = await getAllTweetDetails();
    const existingIds = new Set(existingDetails.map((d) => d.tweetId));

    for (const row of rows) {
      if (existingIds.has(row.tweetId)) {
        result.details.alreadyHad++;
      } else {
        await upsertTweetDetailCache(row);
        result.details.added++;
      }
    }
    onProgress?.({ store: "details", ...result.details, total });
  }

  // Highlights — keyed by `id`
  {
    const rows = gatherShardRows(manifest.shards.highlights || [], files) as Highlight[];
    const total = rows.length;
    const existingHighlights = await getAllHighlights();
    const existingIds = new Set(existingHighlights.map((h) => h.id));

    for (const row of rows) {
      if (existingIds.has(row.id)) {
        result.highlights.alreadyHad++;
      } else {
        await upsertHighlight(row);
        result.highlights.added++;
      }
    }
    onProgress?.({ store: "highlights", ...result.highlights, total });
  }

  // Reading progress — keyed by `tweetId`
  {
    const rows = gatherShardRows(manifest.shards.reading_progress || [], files) as ReadingProgress[];
    const total = rows.length;
    const existingProgress = await getAllReadingProgress();
    const existingIds = new Set(existingProgress.map((p) => p.tweetId));

    for (const row of rows) {
      if (existingIds.has(row.tweetId)) {
        result.readingProgress.alreadyHad++;
      } else {
        await upsertReadingProgress(row);
        result.readingProgress.added++;
      }
    }
    onProgress?.({ store: "reading_progress", ...result.readingProgress, total });
  }

  return result;
}
