import type {
  Bookmark,
  BookmarkQueueMetadata,
  Highlight,
  ReadingProgress,
  TodayQueueExposure,
  TodayQueueSnapshot,
  TweetDetailCache,
} from "../../types";
import { getArticleMarkdownString } from "./article-download";
import { slugifyArticleBasename } from "./article-filename";
import { deriveExportTitle, resolveReaderExportArticle } from "./tweet-export";
import {
  buildHighlightsDigest,
  countHighlightsAndNotes,
  type HighlightsDigestSource,
} from "./highlights-markdown";
import {
  getAllHighlights,
  getBookmarkById,
  getHighlightById,
  getReadingProgress,
  getTweetDetailCache,
  iterateBookmarks,
  iterateTweetDetails,
  iterateHighlights,
  iterateReadingProgress,
  iterateQueueBookmarkMetadata,
  iterateTodayQueueExposures,
  iterateTodayQueueSnapshots,
} from "../../db";
import { DB_VERSION } from "../constants/db";
import { createSha256Hex, sha256hex } from "../crypto";
import { stripCardUrlsFromTweetText } from "../tweet-text";
import { sortIndexToTimestamp } from "../time";
import {
  makeZipEntriesStream,
  type StreamZipEntry,
} from "./stream-zip";

const APP_VERSION = __TOTEM_APP_VERSION__;

function csvEscape(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function csvRow(values: string[]): string {
  return values.map(csvEscape).join(",") + "\r\n";
}

function isoFromMs(ms: number): string {
  return new Date(ms).toISOString();
}

function dateFromMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function yearFromMs(ms: number): string {
  return new Date(ms).getUTCFullYear().toString();
}

function bookmarkSavedAtMs(bookmark: Bookmark): number {
  try {
    const savedAt = sortIndexToTimestamp(bookmark.sortIndex);
    if (Number.isFinite(savedAt)) return savedAt;
  } catch {
    // Fall back to tweet creation time for legacy or malformed sort indexes.
  }
  return bookmark.createdAt;
}

function redactHandle(handle: string): string {
  if (handle.length <= 4) return `@${handle[0]}***`;
  return `@${handle[0]}***${handle.slice(-4)}`;
}

function tweetUrl(bookmark: Bookmark): string {
  return `https://x.com/${bookmark.author.screenName}/status/${bookmark.tweetId}`;
}

function mediaUrlsJoined(bookmark: Bookmark): string {
  const urls: string[] = [];
  for (const m of bookmark.media) {
    if (m.type === "photo" && m.url) urls.push(m.url);
    if ((m.type === "video" || m.type === "animated_gif") && m.videoUrl)
      urls.push(m.videoUrl);
  }
  return urls.join("|");
}

function quotedTweetUrl(bookmark: Bookmark): string {
  const qt = bookmark.quotedTweet;
  if (!qt) return "";
  return `https://x.com/${qt.author.screenName}/status/${qt.tweetId}`;
}

const CSV_COLUMNS = [
  "tweet_id",
  "tweet_url",
  "author_handle",
  "author_name",
  "text",
  "created_at",
  "bookmarked_at",
  "media_urls",
  "quoted_tweet_url",
  "is_thread",
  "has_full_thread",
] as const;

const BOM = "﻿";

function truncateTitle(text: string, max = 90): string {
  const first = text.split("\n")[0].trim();
  if (!first) return "(No text)";
  return first.length <= max ? first : `${first.slice(0, max - 1)}…`;
}

function readmeLinkText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/]/g, "\\]");
}

// Holds the bookmark row (small) but not its TweetDetailCache: detail rows
// carry full thread JSON, and retaining one per bookmark for the whole export
// would buffer the heaviest store in memory. Details are re-fetched when the
// markdown file is written.
interface BookmarkMarkdownFile {
  bookmarkId: string;
  bookmark: Bookmark;
  year: string;
  path: string;
  title: string;
  sourceUrl: string;
}

interface BookmarkMarkdownMetadata {
  exportBookmark: Bookmark;
  sourceUrl: string;
  title: string;
}

function bookmarkMarkdownTitle(bookmark: Bookmark): string {
  return (
    bookmark.article?.title?.trim() ||
    truncateTitle(stripCardUrlsFromTweetText(bookmark.text, bookmark.urls))
  );
}

// Filenames are keyed on tweetId (unique per bookmark) so re-exports overwrite
// the same file in a vault instead of piling up duplicates. The slug is only a
// human-readable prefix; the tweetId is what makes the path stable.
function makeBookmarkMarkdownPath(
  bookmark: Bookmark,
  title: string,
  usedPaths: Set<string>,
): string {
  const titleSlug = slugifyArticleBasename({
    title,
    plainText: stripCardUrlsFromTweetText(bookmark.text, bookmark.urls),
  });
  const base = `${titleSlug}-${bookmark.tweetId}`;
  let path = `bookmarks/${base}.md`;
  let suffix = 2;
  while (usedPaths.has(path)) {
    path = `bookmarks/${base}-${suffix}.md`;
    suffix++;
  }
  usedPaths.add(path);
  return path;
}

function getBookmarkMarkdownMetadata(
  bookmark: Bookmark,
  detail: TweetDetailCache | null,
): BookmarkMarkdownMetadata {
  const exportBookmark = detail?.focalTweet
    ? {
        ...detail.focalTweet,
        sortIndex: bookmark.sortIndex,
        bookmarked: bookmark.bookmarked,
      }
    : bookmark;
  const sourceUrl = tweetUrl(exportBookmark);
  const title = deriveExportTitle(exportBookmark) || bookmarkMarkdownTitle(exportBookmark);
  return { exportBookmark, sourceUrl, title };
}

function bookmarkTags(handle: string): string[] {
  const tags = ["totem/bookmark"];
  const clean = handle.replace(/^@/, "").trim();
  if (clean) tags.push(`twitter/${clean}`);
  return tags;
}

function buildBookmarkMarkdown(
  bookmark: Bookmark,
  detail: TweetDetailCache | null,
  exportedAtLabel: string,
  highlights: Highlight[],
): { body: string; title: string; sourceUrl: string; exportBookmark: Bookmark } {
  const metadata = getBookmarkMarkdownMetadata(bookmark, detail);
  const article = resolveReaderExportArticle(
    metadata.exportBookmark,
    detail?.thread ?? [],
    { includeThreadInExport: true },
  );
  const counts = countHighlightsAndNotes(highlights);
  const body = getArticleMarkdownString(article, {
    authorProfileImageUrl: metadata.exportBookmark.author.profileImageUrl,
    metadata: {
      postUrl: metadata.sourceUrl,
      exportedAtLabel,
      authorName: metadata.exportBookmark.author.name,
      authorHandle: metadata.exportBookmark.author.screenName,
      savedDate: dateFromMs(bookmarkSavedAtMs(metadata.exportBookmark)),
      tags: bookmarkTags(metadata.exportBookmark.author.screenName),
      highlightCount: counts.highlights,
      noteCount: counts.notes,
    },
    highlights,
  });
  return { ...metadata, body };
}

function buildReadme(
  handle: string,
  bookmarkFiles: BookmarkMarkdownFile[],
  generatedAtMs: number,
): string {
  const count = bookmarkFiles.length.toLocaleString("en-US");
  const today = dateFromMs(generatedAtMs);
  const links = bookmarkFiles
    .map(
      (file) =>
        `- [${readmeLinkText(file.title)}](${file.path}) · [Open on X](${file.sourceUrl})`,
    )
    .join("\n");

  return `# Totem export — ${count} bookmarks

Generated ${today} from @${handle}.

## What's inside

| File | Purpose |
|------|---------|
| bookmarks.csv | Opens in Excel, Sheets, Notion — one row per bookmark |
| highlights.csv | One row per highlight and note — for Notion or spreadsheets |
| highlights.md | Every highlight and note in one file, grouped by source |
| readme.md | Index of every exported bookmark |
| bookmarks/*.md | One Markdown file per bookmark (Obsidian-ready), with your highlights and notes appended |
| data/*.jsonl | Canonical data — used for re-import into Totem |
| manifest.json | Export metadata, checksums, counts |

## Bookmarks

${links || "No bookmarks exported."}

## How to re-import

1. Open Totem on any Chrome install
2. Use the Import link shown when your library is empty
3. Drop this entire ZIP file — the importer reads \`data/*.jsonl\` only

CSV and Markdown are for your convenience. The importer ignores them.

## Schema docs

Full field-by-field documentation: https://usetotem.xyz/export-format/v1

## Privacy

This file contains your X bookmark data. Treat it like your X account data.
`;
}

export interface ExportAccountInfo {
  userId: string;
  handle: string;
}

export interface QuickExportResult {
  bookmarkCount: number;
  detailCount: number;
  highlightCount: number;
  readingProgressCount: number;
  todayQueueSnapshotCount: number;
  queueMetadataCount: number;
  todayQueueExposureCount: number;
}

function hasSaveFilePicker(): boolean {
  return typeof window !== "undefined" && typeof window.showSaveFilePicker === "function";
}

async function openWritable(
  suggestedName: string,
): Promise<{ kind: "fsa"; dest: FileSystemWritableFileStream } | { kind: "blob" }> {
  if (hasSaveFilePicker()) {
    const fileHandle = await window.showSaveFilePicker({
      suggestedName,
      types: [
        {
          description: "ZIP archive",
          accept: { "application/zip": [".zip"] },
        },
      ],
    });
    const dest = await fileHandle.createWritable();
    return { kind: "fsa", dest };
  }
  return { kind: "blob" };
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function bookmarkCsvLine(
  bookmark: Bookmark,
  fullThreadIds: Set<string>,
): string {
  const text = stripCardUrlsFromTweetText(bookmark.text, bookmark.urls).trim();
  const savedAt = bookmarkSavedAtMs(bookmark);
  return csvRow([
    bookmark.tweetId,
    tweetUrl(bookmark),
    bookmark.author.screenName,
    bookmark.author.name,
    text,
    isoFromMs(bookmark.createdAt),
    isoFromMs(savedAt),
    mediaUrlsJoined(bookmark),
    quotedTweetUrl(bookmark),
    String(bookmark.isThread),
    String(fullThreadIds.has(bookmark.tweetId)),
  ]);
}

async function* csvLines(
  bookmarkFiles: BookmarkMarkdownFile[],
  fullThreadIds: Set<string>,
): AsyncIterable<string> {
  yield BOM + csvRow([...CSV_COLUMNS]);
  for (const file of bookmarkFiles) {
    yield bookmarkCsvLine(file.bookmark, fullThreadIds);
  }
}

async function* jsonlLines<T>(rows: AsyncIterable<T>): AsyncIterable<string> {
  for await (const row of rows) {
    yield `${JSON.stringify(row)}\n`;
  }
}

function textStream(lines: AsyncIterable<string>): ReadableStream<Uint8Array> {
  const iterator = lines[Symbol.asyncIterator]();
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { value, done } = await iterator.next();
      if (done) {
        controller.close();
        return;
      }
      controller.enqueue(encoder.encode(value));
    },
    async cancel(reason) {
      if (typeof iterator.return === "function") {
        await iterator.return(reason);
      }
    },
  });
}

function hashingTextEntry(
  name: string,
  lines: AsyncIterable<string>,
  checksums: Record<string, string>,
  lastModified: Date,
): { entry: StreamZipEntry; done: Promise<void> } {
  const encoder = new TextEncoder();
  const hasher = createSha256Hex();
  let resolveDone!: () => void;
  let rejectDone!: (error: unknown) => void;
  const done = new Promise<void>((resolve, reject) => {
    resolveDone = resolve;
    rejectDone = reject;
  });

  const input = textStream((async function* () {
    try {
      for await (const line of lines) {
        hasher.update(encoder.encode(line));
        yield line;
      }
      checksums[name] = `sha256:${hasher.digestHex()}`;
      resolveDone();
    } catch (error) {
      rejectDone(error);
      throw error;
    }
  })());

  return {
    entry: { name, input, lastModified },
    done,
  };
}

async function* singleTextLine(
  makeText: () => string | Promise<string>,
): AsyncIterable<string> {
  yield await makeText();
}

async function collectDetailSummary(): Promise<{
  keys: string[];
  count: number;
  fullThreadIds: Set<string>;
}> {
  const keys: string[] = [];
  const fullThreadIds = new Set<string>();
  for await (const detail of iterateTweetDetails()) {
    keys.push(detail.tweetId);
    if (detail.detailsStatus !== "unavailable") {
      fullThreadIds.add(detail.tweetId);
    }
  }
  return { keys, count: keys.length, fullThreadIds };
}

async function collectHighlightIds(): Promise<string[]> {
  const ids: string[] = [];
  for await (const highlight of iterateHighlights()) {
    ids.push(highlight.id);
  }
  return ids;
}

async function collectHighlightsByTweetId(): Promise<Map<string, Highlight[]>> {
  const all = await getAllHighlights();
  const byTweetId = new Map<string, Highlight[]>();
  for (const highlight of all) {
    const list = byTweetId.get(highlight.tweetId);
    if (list) list.push(highlight);
    else byTweetId.set(highlight.tweetId, [highlight]);
  }
  return byTweetId;
}

const HIGHLIGHT_CSV_COLUMNS = [
  "tweet_id",
  "source_url",
  "author_handle",
  "author_name",
  "type",
  "color",
  "selected_text",
  "note",
  "created_at",
] as const;

function highlightType(highlight: Highlight): string {
  if (highlight.type) return highlight.type;
  return highlight.selectedText?.trim() ? "highlight" : "note";
}

async function* highlightCsvLines(
  files: BookmarkMarkdownFile[],
  highlightsByTweetId: Map<string, Highlight[]>,
): AsyncIterable<string> {
  yield BOM + csvRow([...HIGHLIGHT_CSV_COLUMNS]);
  for (const file of files) {
    const highlights = highlightsByTweetId.get(file.bookmark.tweetId);
    if (!highlights || highlights.length === 0) continue;
    const sorted = [...highlights].sort((a, b) => a.createdAt - b.createdAt);
    for (const highlight of sorted) {
      yield csvRow([
        highlight.tweetId,
        file.sourceUrl,
        file.bookmark.author.screenName,
        file.bookmark.author.name,
        highlightType(highlight),
        highlight.color,
        highlight.selectedText ?? "",
        highlight.note ?? "",
        isoFromMs(highlight.createdAt),
      ]);
    }
  }
}

function buildHighlightDigestSources(
  files: BookmarkMarkdownFile[],
  highlightsByTweetId: Map<string, Highlight[]>,
): HighlightsDigestSource[] {
  const sources: HighlightsDigestSource[] = [];
  for (const file of files) {
    const highlights = highlightsByTweetId.get(file.bookmark.tweetId);
    if (!highlights || highlights.length === 0) continue;
    sources.push({
      title: file.title,
      sourceUrl: file.sourceUrl,
      authorName: file.bookmark.author.name,
      authorHandle: file.bookmark.author.screenName,
      highlights,
    });
  }
  return sources;
}

async function collectReadingProgressIds(): Promise<string[]> {
  const ids: string[] = [];
  for await (const progress of iterateReadingProgress()) {
    ids.push(progress.tweetId);
  }
  return ids;
}

async function* bookmarksForYear(
  year: string,
  bookmarkFiles: BookmarkMarkdownFile[],
  counter: { n: number },
): AsyncIterable<Bookmark> {
  for (const file of bookmarkFiles) {
    if (file.year !== year) continue;
    counter.n++;
    yield file.bookmark;
  }
}

async function collectBookmarkMarkdownFiles(
  tweetIdFilter?: Set<string>,
): Promise<{ files: BookmarkMarkdownFile[]; years: string[] }> {
  const files: BookmarkMarkdownFile[] = [];
  const years = new Set<string>();
  const usedPaths = new Set<string>();
  const bookmarkSnapshots: Bookmark[] = [];

  for await (const bookmark of iterateBookmarks()) {
    // Filtering on the snapshot's tweetId avoids per-bookmark detail reads for
    // the whole library when only annotated bookmarks are wanted.
    if (tweetIdFilter && !tweetIdFilter.has(bookmark.tweetId)) continue;
    bookmarkSnapshots.push(bookmark);
  }

  for (const snapshot of bookmarkSnapshots) {
    const bookmark = await getBookmarkById(snapshot.id);
    if (!bookmark) continue; // row removed between snapshot and read; skip it
    const detail = await getTweetDetailCache(bookmark.tweetId);
    const rendered = getBookmarkMarkdownMetadata(bookmark, detail);
    const year = yearFromMs(bookmarkSavedAtMs(bookmark));
    const path = makeBookmarkMarkdownPath(
      rendered.exportBookmark,
      rendered.title,
      usedPaths,
    );
    years.add(year);
    files.push({
      bookmarkId: bookmark.id,
      bookmark,
      year,
      path,
      title: rendered.title,
      sourceUrl: rendered.sourceUrl,
    });
  }

  return { files, years: Array.from(years).toSorted() };
}

async function* detailsByIdJsonl(
  keys: string[],
  counter: { n: number },
): AsyncIterable<TweetDetailCache> {
  for (const key of keys) {
    const detail = await getTweetDetailCache(key);
    if (!detail) continue; // row removed mid-export; skip it
    counter.n++;
    yield detail;
  }
}

async function* highlightsByIdJsonl(
  keys: string[],
  counter: { n: number },
): AsyncIterable<Highlight> {
  for (const key of keys) {
    const highlight = await getHighlightById(key);
    if (!highlight) continue; // row removed mid-export; skip it
    counter.n++;
    yield highlight;
  }
}

async function* readingProgressByIdJsonl(
  keys: string[],
  counter: { n: number },
): AsyncIterable<ReadingProgress> {
  for (const key of keys) {
    const progress = await getReadingProgress(key);
    if (!progress) continue; // row removed mid-export; skip it
    counter.n++;
    yield progress;
  }
}

async function* todayQueueSnapshotsJsonl(
  counter: { n: number },
): AsyncIterable<TodayQueueSnapshot> {
  for await (const snapshot of iterateTodayQueueSnapshots()) {
    counter.n++;
    yield snapshot;
  }
}

async function* queueMetadataJsonl(
  counter: { n: number },
): AsyncIterable<BookmarkQueueMetadata> {
  for await (const row of iterateQueueBookmarkMetadata()) {
    counter.n++;
    yield row;
  }
}

async function* todayQueueExposuresJsonl(
  counter: { n: number },
): AsyncIterable<TodayQueueExposure> {
  for await (const exposure of iterateTodayQueueExposures()) {
    counter.n++;
    yield exposure;
  }
}

export async function runQuickExport(
  account: ExportAccountInfo,
): Promise<QuickExportResult> {
  const today = dateFromMs(Date.now());
  const filename = `totem-export-${today}.zip`;
  const target = await openWritable(filename);
  const exportDate = new Date();
  const generatedAtMs = exportDate.getTime();
  const generatedAtIso = exportDate.toISOString();
  const exportedAtLabel = exportDate.toLocaleString();

  try {
    const [
      bookmarkFilesResult,
      detailSummary,
      highlightIds,
      highlightsByTweetId,
      readingProgressIds,
    ] = await Promise.all([
      collectBookmarkMarkdownFiles(),
      collectDetailSummary(),
      collectHighlightIds(),
      collectHighlightsByTweetId(),
      collectReadingProgressIds(),
    ]);
    const bookmarkMarkdownFiles = bookmarkFilesResult.files;
    const bookmarkYears = bookmarkFilesResult.years;
    const highlightDigestSources = buildHighlightDigestSources(
      bookmarkMarkdownFiles,
      highlightsByTweetId,
    );
    const encoder = new TextEncoder();
    const checksums: Record<string, string> = {};
    const shardNames = bookmarkYears.map((year) => `data/bookmarks-${year}.jsonl`);
    const accountIdHash = `sha256:${await sha256hex(encoder.encode(account.userId))}`;
    const now = exportDate;

    // Counts of rows actually streamed. Bookmarks are validated once after the
    // sorted snapshot so a concurrent delete can drop a row before export
    // starts; tracking emitted rows keeps the manifest honest.
    const bookmarkCounter = { n: 0 };
    const detailCounter = { n: 0 };
    const highlightCounter = { n: 0 };
    const progressCounter = { n: 0 };
    const queueSnapshotCounter = { n: 0 };
    const queueMetadataCounter = { n: 0 };
    const queueExposureCounter = { n: 0 };
    const writtenMarkdownPaths: string[] = [];

    async function* entries(): AsyncIterable<StreamZipEntry> {
      const readme = hashingTextEntry(
        "readme.md",
        singleTextLine(() =>
          buildReadme(account.handle, bookmarkMarkdownFiles, generatedAtMs)
        ),
        checksums,
        now,
      );
      yield readme.entry;
      await readme.done;

      const csv = hashingTextEntry(
        "bookmarks.csv",
        csvLines(bookmarkMarkdownFiles, detailSummary.fullThreadIds),
        checksums,
        now,
      );
      yield csv.entry;
      await csv.done;

      const highlightsCsv = hashingTextEntry(
        "highlights.csv",
        highlightCsvLines(bookmarkMarkdownFiles, highlightsByTweetId),
        checksums,
        now,
      );
      yield highlightsCsv.entry;
      await highlightsCsv.done;

      if (highlightDigestSources.length > 0) {
        const highlightsDigest = hashingTextEntry(
          "highlights.md",
          singleTextLine(() =>
            buildHighlightsDigest(highlightDigestSources, today),
          ),
          checksums,
          now,
        );
        yield highlightsDigest.entry;
        await highlightsDigest.done;
      }

      for (const year of bookmarkYears) {
        const name = `data/bookmarks-${year}.jsonl`;
        const entry = hashingTextEntry(
          name,
          jsonlLines(bookmarksForYear(year, bookmarkMarkdownFiles, bookmarkCounter)),
          checksums,
          now,
        );
        yield entry.entry;
        await entry.done;
      }

      const details = hashingTextEntry(
        "data/details.jsonl",
        jsonlLines(detailsByIdJsonl(detailSummary.keys, detailCounter)),
        checksums,
        now,
      );
      yield details.entry;
      await details.done;

      const highlights = hashingTextEntry(
        "data/highlights.jsonl",
        jsonlLines(highlightsByIdJsonl(highlightIds, highlightCounter)),
        checksums,
        now,
      );
      yield highlights.entry;
      await highlights.done;

      const progress = hashingTextEntry(
        "data/reading-progress.jsonl",
        jsonlLines(readingProgressByIdJsonl(readingProgressIds, progressCounter)),
        checksums,
        now,
      );
      yield progress.entry;
      await progress.done;

      const queueSnapshots = hashingTextEntry(
        "data/today-queue-snapshots.jsonl",
        jsonlLines(todayQueueSnapshotsJsonl(queueSnapshotCounter)),
        checksums,
        now,
      );
      yield queueSnapshots.entry;
      await queueSnapshots.done;

      const queueMetadata = hashingTextEntry(
        "data/bookmark-queue-metadata.jsonl",
        jsonlLines(queueMetadataJsonl(queueMetadataCounter)),
        checksums,
        now,
      );
      yield queueMetadata.entry;
      await queueMetadata.done;

      const queueExposures = hashingTextEntry(
        "data/today-queue-exposures.jsonl",
        jsonlLines(todayQueueExposuresJsonl(queueExposureCounter)),
        checksums,
        now,
      );
      yield queueExposures.entry;
      await queueExposures.done;

      for (const file of bookmarkMarkdownFiles) {
        const detail = await getTweetDetailCache(file.bookmark.tweetId);
        const body = buildBookmarkMarkdown(
          file.bookmark,
          detail,
          exportedAtLabel,
          highlightsByTweetId.get(file.bookmark.tweetId) ?? [],
        ).body;
        const markdown = hashingTextEntry(
          file.path,
          singleTextLine(() => body),
          checksums,
          now,
        );
        yield markdown.entry;
        await markdown.done;
        writtenMarkdownPaths.push(file.path);
      }

      const manifest = {
        totem: {
          export_version: 1,
          schema_version: DB_VERSION,
        },
        generated_at: generatedAtIso,
        generated_by: {
          app: "totem",
          version: APP_VERSION,
          platform: "chrome-extension",
        },
        account: {
          id_hash: accountIdHash,
          handle_redacted: redactHandle(account.handle),
        },
        kind: "library",
        counts: {
          bookmarks: bookmarkCounter.n,
          details: detailCounter.n,
          highlights: highlightCounter.n,
          reading_progress: progressCounter.n,
          today_queue_snapshots: queueSnapshotCounter.n,
          bookmark_queue_metadata: queueMetadataCounter.n,
          today_queue_exposures: queueExposureCounter.n,
        },
        shards: {
          bookmarks: shardNames,
          details: ["data/details.jsonl"],
          highlights: ["data/highlights.jsonl"],
          reading_progress: ["data/reading-progress.jsonl"],
          today_queue_snapshots: ["data/today-queue-snapshots.jsonl"],
          bookmark_queue_metadata: ["data/bookmark-queue-metadata.jsonl"],
          today_queue_exposures: ["data/today-queue-exposures.jsonl"],
        },
        derived: {
          csv: "bookmarks.csv",
          highlights_csv: "highlights.csv",
          highlights_digest:
            highlightDigestSources.length > 0 ? "highlights.md" : null,
          markdown_index: "readme.md",
          markdown_files: writtenMarkdownPaths,
        },
        checksums,
      };

      yield {
        input: encoder.encode(JSON.stringify(manifest, null, 2)),
        name: "manifest.json",
        lastModified: now,
      };
    }

    const zipStream = makeZipEntriesStream(entries());
    if (target.kind === "fsa") {
      await zipStream.pipeTo(target.dest);
    } else {
      const blob = await new Response(zipStream).blob();
      downloadBlob(blob, filename);
    }

    return {
      bookmarkCount: bookmarkCounter.n,
      detailCount: detailCounter.n,
      highlightCount: highlightCounter.n,
      readingProgressCount: progressCounter.n,
      todayQueueSnapshotCount: queueSnapshotCounter.n,
      queueMetadataCount: queueMetadataCounter.n,
      todayQueueExposureCount: queueExposureCounter.n,
    };
  } catch (error) {
    if (target.kind === "fsa") {
      await target.dest.abort().catch(() => {});
    }
    throw error;
  }
}

export interface HighlightsExportResult {
  annotatedBookmarkCount: number;
  highlightCount: number;
  noteCount: number;
}

function plainTextEntry(
  name: string,
  text: string,
  lastModified: Date,
): StreamZipEntry {
  return {
    name,
    input: textStream(singleTextLine(() => text)),
    lastModified,
  };
}

function buildHighlightsReadme(
  handle: string,
  files: BookmarkMarkdownFile[],
  generatedAtMs: number,
): string {
  const count = files.length.toLocaleString("en-US");
  const today = dateFromMs(generatedAtMs);
  const links = files
    .map(
      (file) =>
        `- [${readmeLinkText(file.title)}](${file.path}) · [Open on X](${file.sourceUrl})`,
    )
    .join("\n");

  return `# Totem highlights & notes — ${count} sources

Generated ${today} from @${handle}.

## What's inside

| File | Purpose |
|------|---------|
| highlights.md | Every highlight and note in one file, grouped by source |
| highlights.csv | One row per highlight and note — for Notion or spreadsheets |
| bookmarks/*.md | One Markdown file per annotated bookmark (Obsidian-ready), with its highlights and notes |

Only bookmarks you highlighted or added notes to are included. Drop the
\`bookmarks/\` folder into an Obsidian vault, or import \`highlights.csv\` into
Notion.

## Sources

${links || "No highlights or notes yet."}
`;
}

export async function runHighlightsExport(
  account: ExportAccountInfo,
): Promise<HighlightsExportResult> {
  const today = dateFromMs(Date.now());
  const filename = `totem-highlights-${today}.zip`;
  const target = await openWritable(filename);
  const exportDate = new Date();
  const generatedAtMs = exportDate.getTime();
  const exportedAtLabel = exportDate.toLocaleString();
  const now = exportDate;

  try {
    const highlightsByTweetId = await collectHighlightsByTweetId();
    const bookmarkFilesResult = await collectBookmarkMarkdownFiles(
      new Set(highlightsByTweetId.keys()),
    );

    const annotated = bookmarkFilesResult.files.filter(
      (file) => (highlightsByTweetId.get(file.bookmark.tweetId)?.length ?? 0) > 0,
    );
    const digestSources = buildHighlightDigestSources(
      annotated,
      highlightsByTweetId,
    );

    let highlightCount = 0;
    let noteCount = 0;
    for (const file of annotated) {
      const counts = countHighlightsAndNotes(
        highlightsByTweetId.get(file.bookmark.tweetId) ?? [],
      );
      highlightCount += counts.highlights;
      noteCount += counts.notes;
    }

    async function* entries(): AsyncIterable<StreamZipEntry> {
      yield plainTextEntry(
        "readme.md",
        buildHighlightsReadme(account.handle, annotated, generatedAtMs),
        now,
      );
      yield plainTextEntry(
        "highlights.md",
        buildHighlightsDigest(digestSources, today),
        now,
      );
      yield {
        name: "highlights.csv",
        input: textStream(highlightCsvLines(annotated, highlightsByTweetId)),
        lastModified: now,
      };

      for (const file of annotated) {
        const detail = await getTweetDetailCache(file.bookmark.tweetId);
        const body = buildBookmarkMarkdown(
          file.bookmark,
          detail,
          exportedAtLabel,
          highlightsByTweetId.get(file.bookmark.tweetId) ?? [],
        ).body;
        yield plainTextEntry(file.path, body, now);
      }
    }

    const zipStream = makeZipEntriesStream(entries());
    if (target.kind === "fsa") {
      await zipStream.pipeTo(target.dest);
    } else {
      const blob = await new Response(zipStream).blob();
      downloadBlob(blob, filename);
    }

    return {
      annotatedBookmarkCount: annotated.length,
      highlightCount,
      noteCount,
    };
  } catch (error) {
    if (target.kind === "fsa") {
      await target.dest.abort().catch(() => {});
    }
    throw error;
  }
}
