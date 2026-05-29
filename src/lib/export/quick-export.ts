import type {
  Bookmark,
  Highlight,
  ReadingProgress,
  TweetDetailCache,
} from "../../types";
import { getArticleMarkdownString } from "./article-download";
import { slugifyArticleBasename } from "./article-filename";
import { resolveReaderExportArticle } from "./tweet-export";
import {
  getBookmarkById,
  getHighlightById,
  getReadingProgress,
  getTweetDetailCache,
  iterateBookmarks,
  iterateTweetDetails,
  iterateHighlights,
  iterateReadingProgress,
} from "../../db";
import { DB_VERSION } from "../constants/db";
import { sha256hex } from "../crypto";
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

interface BookmarkMarkdownFile {
  bookmarkId: string;
  year: string;
  path: string;
  title: string;
  sourceUrl: string;
}

function bookmarkMarkdownTitle(bookmark: Bookmark): string {
  return (
    bookmark.article?.title?.trim() ||
    truncateTitle(stripCardUrlsFromTweetText(bookmark.text, bookmark.urls))
  );
}

function makeBookmarkMarkdownPath(
  bookmark: Bookmark,
  title: string,
  index: number,
  ordinalWidth: number,
  usedPaths: Set<string>,
): string {
  const titleSlug = slugifyArticleBasename({
    title,
    plainText: stripCardUrlsFromTweetText(bookmark.text, bookmark.urls),
  });
  const ordinal = String(index + 1).padStart(ordinalWidth, "0");
  const base = `${ordinal}-${titleSlug}`;
  let path = `bookmarks/${base}.md`;
  if (!usedPaths.has(path)) {
    usedPaths.add(path);
    return path;
  }

  path = `bookmarks/${base}-${bookmark.tweetId}.md`;
  let suffix = 2;
  while (usedPaths.has(path)) {
    path = `bookmarks/${base}-${bookmark.tweetId}-${suffix}.md`;
    suffix++;
  }
  usedPaths.add(path);
  return path;
}

function buildBookmarkMarkdown(
  bookmark: Bookmark,
  detail: TweetDetailCache | null,
  exportedAtLabel: string,
): { body: string; title: string; sourceUrl: string; exportBookmark: Bookmark } {
  const exportBookmark = detail?.focalTweet
    ? {
        ...detail.focalTweet,
        sortIndex: bookmark.sortIndex,
        bookmarked: bookmark.bookmarked,
      }
    : bookmark;
  const article = resolveReaderExportArticle(
    exportBookmark,
    detail?.thread ?? [],
    { includeThreadInExport: true },
  );
  const sourceUrl = tweetUrl(exportBookmark);
  const body = getArticleMarkdownString(article, {
    authorProfileImageUrl: exportBookmark.author.profileImageUrl,
    metadata: {
      postUrl: sourceUrl,
      exportedAtLabel,
      authorName: exportBookmark.author.name,
      authorHandle: exportBookmark.author.screenName,
    },
  });
  const title = article.title?.trim() || bookmarkMarkdownTitle(exportBookmark);
  return { body, title, sourceUrl, exportBookmark };
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
| readme.md | Index of every exported bookmark |
| bookmarks/*.md | One Markdown file per bookmark, rendered like the reader's Copy Markdown export |
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
    const bookmark = await getBookmarkById(file.bookmarkId);
    if (!bookmark) {
      throw new Error(`Bookmark disappeared during export: ${file.bookmarkId}`);
    }
    yield bookmarkCsvLine(bookmark, fullThreadIds);
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

function concatChunks(chunks: Uint8Array[], total: number): Uint8Array {
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

function hashingTextEntry(
  name: string,
  lines: AsyncIterable<string>,
  checksums: Record<string, string>,
  lastModified: Date,
): { entry: StreamZipEntry; done: Promise<void> } {
  const chunks: Uint8Array[] = [];
  let total = 0;
  let resolveDone!: () => void;
  let rejectDone!: (error: unknown) => void;
  const done = new Promise<void>((resolve, reject) => {
    resolveDone = resolve;
    rejectDone = reject;
  });

  const input = textStream((async function* () {
    try {
      for await (const line of lines) {
        const chunk = new TextEncoder().encode(line);
        chunks.push(chunk);
        total += chunk.byteLength;
        yield line;
      }
      checksums[name] = `sha256:${await sha256hex(concatChunks(chunks, total))}`;
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
): AsyncIterable<Bookmark> {
  for (const file of bookmarkFiles) {
    if (file.year !== year) continue;
    const bookmark = await getBookmarkById(file.bookmarkId);
    if (!bookmark) {
      throw new Error(`Bookmark disappeared during export: ${file.bookmarkId}`);
    }
    yield bookmark;
  }
}

async function collectBookmarkMarkdownFiles(
  exportedAtLabel: string,
): Promise<{ files: BookmarkMarkdownFile[]; years: string[] }> {
  const files: BookmarkMarkdownFile[] = [];
  const years = new Set<string>();
  const usedPaths = new Set<string>();
  const bookmarkIds: string[] = [];

  for await (const bookmark of iterateBookmarks()) {
    bookmarkIds.push(bookmark.id);
  }

  const ordinalWidth = Math.max(2, String(bookmarkIds.length).length);
  let index = 0;

  for (const bookmarkId of bookmarkIds) {
    const bookmark = await getBookmarkById(bookmarkId);
    if (!bookmark) {
      throw new Error(`Bookmark disappeared during export: ${bookmarkId}`);
    }
    const detail = await getTweetDetailCache(bookmark.tweetId);
    const rendered = buildBookmarkMarkdown(bookmark, detail, exportedAtLabel);
    const year = yearFromMs(bookmarkSavedAtMs(bookmark));
    const path = makeBookmarkMarkdownPath(
      rendered.exportBookmark,
      rendered.title,
      index,
      ordinalWidth,
      usedPaths,
    );
    years.add(year);
    files.push({
      bookmarkId: bookmark.id,
      year,
      path,
      title: rendered.title,
      sourceUrl: rendered.sourceUrl,
    });
    index++;
  }

  return { files, years: Array.from(years).toSorted() };
}

async function renderBookmarkMarkdownFile(
  file: BookmarkMarkdownFile,
  exportedAtLabel: string,
): Promise<string> {
  const bookmark = await getBookmarkById(file.bookmarkId);
  if (!bookmark) {
    throw new Error(`Bookmark disappeared during export: ${file.bookmarkId}`);
  }
  const detail = await getTweetDetailCache(bookmark.tweetId);
  return buildBookmarkMarkdown(bookmark, detail, exportedAtLabel).body;
}

async function* detailsByIdJsonl(keys: string[]): AsyncIterable<TweetDetailCache> {
  for (const key of keys) {
    const detail = await getTweetDetailCache(key);
    if (!detail) {
      throw new Error(`Tweet detail disappeared during export: ${key}`);
    }
    yield detail;
  }
}

async function* highlightsByIdJsonl(keys: string[]): AsyncIterable<Highlight> {
  for (const key of keys) {
    const highlight = await getHighlightById(key);
    if (!highlight) {
      throw new Error(`Highlight disappeared during export: ${key}`);
    }
    yield highlight;
  }
}

async function* readingProgressByIdJsonl(keys: string[]): AsyncIterable<ReadingProgress> {
  for (const key of keys) {
    const progress = await getReadingProgress(key);
    if (!progress) {
      throw new Error(`Reading progress disappeared during export: ${key}`);
    }
    yield progress;
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
    const [bookmarkFilesResult, detailSummary, highlightIds, readingProgressIds] = await Promise.all([
      collectBookmarkMarkdownFiles(exportedAtLabel),
      collectDetailSummary(),
      collectHighlightIds(),
      collectReadingProgressIds(),
    ]);
    const bookmarkMarkdownFiles = bookmarkFilesResult.files;
    const bookmarkYears = bookmarkFilesResult.years;
    const bookmarkCount = bookmarkMarkdownFiles.length;
    const highlightCount = highlightIds.length;
    const readingProgressCount = readingProgressIds.length;
    const encoder = new TextEncoder();
    const checksums: Record<string, string> = {};
    const shardNames = bookmarkYears.map((year) => `data/bookmarks-${year}.jsonl`);
    const accountIdHash = `sha256:${await sha256hex(encoder.encode(account.userId))}`;
    const now = exportDate;

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

      for (const year of bookmarkYears) {
        const name = `data/bookmarks-${year}.jsonl`;
        const entry = hashingTextEntry(
          name,
          jsonlLines(bookmarksForYear(year, bookmarkMarkdownFiles)),
          checksums,
          now,
        );
        yield entry.entry;
        await entry.done;
      }

      const details = hashingTextEntry(
        "data/details.jsonl",
        jsonlLines(detailsByIdJsonl(detailSummary.keys)),
        checksums,
        now,
      );
      yield details.entry;
      await details.done;

      const highlights = hashingTextEntry(
        "data/highlights.jsonl",
        jsonlLines(highlightsByIdJsonl(highlightIds)),
        checksums,
        now,
      );
      yield highlights.entry;
      await highlights.done;

      const progress = hashingTextEntry(
        "data/reading-progress.jsonl",
        jsonlLines(readingProgressByIdJsonl(readingProgressIds)),
        checksums,
        now,
      );
      yield progress.entry;
      await progress.done;

      for (const file of bookmarkMarkdownFiles) {
        const markdown = hashingTextEntry(
          file.path,
          singleTextLine(() => renderBookmarkMarkdownFile(file, exportedAtLabel)),
          checksums,
          now,
        );
        yield markdown.entry;
        await markdown.done;
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
          bookmarks: bookmarkCount,
          details: detailSummary.count,
          highlights: highlightCount,
          reading_progress: readingProgressCount,
        },
        shards: {
          bookmarks: shardNames,
          details: ["data/details.jsonl"],
          highlights: ["data/highlights.jsonl"],
          reading_progress: ["data/reading-progress.jsonl"],
        },
        derived: {
          csv: "bookmarks.csv",
          markdown_index: "readme.md",
          markdown_files: bookmarkMarkdownFiles.map((file) => file.path),
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
      bookmarkCount,
      detailCount: detailSummary.count,
      highlightCount,
      readingProgressCount,
    };
  } catch (error) {
    if (target.kind === "fsa") {
      await target.dest.abort().catch(() => {});
    }
    throw error;
  }
}
