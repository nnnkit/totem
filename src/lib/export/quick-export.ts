import { makeZip } from "client-zip";
import type { Bookmark, TweetDetailCache } from "../../types";
import { getArticleMarkdownString } from "./article-download";
import { slugifyArticleBasename } from "./article-filename";
import { resolveReaderExportArticle } from "./tweet-export";
import {
  getAllBookmarks,
  getAllTweetDetails,
  getAllHighlights,
  getAllReadingProgress,
} from "../../db";
import { DB_VERSION } from "../constants/db";
import { stripCardUrlsFromTweetText } from "../tweet-text";
import { sortIndexToTimestamp } from "../time";

const APP_VERSION = "1.1.24";

async function sha256hex(data: Uint8Array): Promise<string> {
  const buf = new ArrayBuffer(data.byteLength);
  new Uint8Array(buf).set(data);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

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

function buildCsv(
  bookmarks: Bookmark[],
  fullThreadIds: Set<string>,
): string {
  const lines: string[] = [BOM + csvRow([...CSV_COLUMNS])];
  for (const b of bookmarks) {
    const text = stripCardUrlsFromTweetText(b.text, b.urls).trim();
    const savedAt = bookmarkSavedAtMs(b);
    lines.push(
      csvRow([
        b.tweetId,
        tweetUrl(b),
        b.author.screenName,
        b.author.name,
        text,
        isoFromMs(b.createdAt),
        isoFromMs(savedAt),
        mediaUrlsJoined(b),
        quotedTweetUrl(b),
        String(b.isThread),
        String(fullThreadIds.has(b.tweetId)),
      ]),
    );
  }
  return lines.join("");
}

function truncateTitle(text: string, max = 90): string {
  const first = text.split("\n")[0].trim();
  if (!first) return "(No text)";
  return first.length <= max ? first : `${first.slice(0, max - 1)}…`;
}

function readmeLinkText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/]/g, "\\]");
}

interface BookmarkMarkdownFile {
  path: string;
  title: string;
  sourceUrl: string;
  bytes: Uint8Array;
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

function buildBookmarkMarkdownFiles(
  bookmarks: Bookmark[],
  details: TweetDetailCache[],
  encoder: TextEncoder,
  exportedAtLabel: string,
): BookmarkMarkdownFile[] {
  const detailsByTweetId = new Map(
    details.map((detail) => [detail.tweetId, detail]),
  );
  const usedPaths = new Set<string>();
  const ordinalWidth = Math.max(2, String(bookmarks.length).length);

  return bookmarks.map((bookmark, index) => {
    const detail = detailsByTweetId.get(bookmark.tweetId);
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
    const path = makeBookmarkMarkdownPath(
      exportBookmark,
      title,
      index,
      ordinalWidth,
      usedPaths,
    );

    return {
      path,
      title,
      sourceUrl,
      bytes: encoder.encode(body),
    };
  });
}

function buildReadme(
  handle: string,
  bookmarkFiles: BookmarkMarkdownFile[],
): string {
  const count = bookmarkFiles.length.toLocaleString("en-US");
  const today = dateFromMs(Date.now());
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

function fullThreadIdsFromDetails(details: TweetDetailCache[]): Set<string> {
  return new Set(
    details
      .filter((detail) => detail.detailsStatus !== "unavailable")
      .map((detail) => detail.tweetId),
  );
}

export async function runQuickExport(
  account: ExportAccountInfo,
): Promise<QuickExportResult> {
  const today = dateFromMs(Date.now());
  const filename = `totem-export-${today}.zip`;
  const target = await openWritable(filename);

  try {
    const bookmarks = await getAllBookmarks();
    const details = await getAllTweetDetails();
    const highlights = await getAllHighlights();
    const readingProgress = await getAllReadingProgress();
    const fullThreadIds = fullThreadIdsFromDetails(details);

    const encoder = new TextEncoder();

    const bookmarksByYear = new Map<string, Bookmark[]>();
    for (const b of bookmarks) {
      const year = yearFromMs(bookmarkSavedAtMs(b));
      let arr = bookmarksByYear.get(year);
      if (!arr) {
        arr = [];
        bookmarksByYear.set(year, arr);
      }
      arr.push(b);
    }

    const dataFiles = new Map<string, Uint8Array>();
    for (const [year, rows] of bookmarksByYear) {
      const content = rows.map((r) => JSON.stringify(r)).join("\n") + "\n";
      dataFiles.set(`data/bookmarks-${year}.jsonl`, encoder.encode(content));
    }

    const encodeJsonl = (rows: unknown[]): Uint8Array => {
      if (rows.length === 0) return encoder.encode("");
      return encoder.encode(
        rows.map((r) => JSON.stringify(r)).join("\n") + "\n",
      );
    };

    dataFiles.set("data/details.jsonl", encodeJsonl(details));
    dataFiles.set("data/highlights.jsonl", encodeJsonl(highlights));
    dataFiles.set(
      "data/reading-progress.jsonl",
      encodeJsonl(readingProgress),
    );

    const csvContent = buildCsv(bookmarks, fullThreadIds);
    const csvBytes = encoder.encode(csvContent);

    const bookmarkMarkdownFiles = buildBookmarkMarkdownFiles(
      bookmarks,
      details,
      encoder,
      new Date().toLocaleString(),
    );

    const checksums: Record<string, string> = {};
    for (const [name, data] of dataFiles) {
      checksums[name] = `sha256:${await sha256hex(data)}`;
    }
    checksums["bookmarks.csv"] = `sha256:${await sha256hex(csvBytes)}`;
    for (const file of bookmarkMarkdownFiles) {
      checksums[file.path] = `sha256:${await sha256hex(file.bytes)}`;
    }
    const readmeBytes = encoder.encode(
      buildReadme(account.handle, bookmarkMarkdownFiles),
    );
    checksums["readme.md"] = `sha256:${await sha256hex(readmeBytes)}`;

    const accountIdHash = `sha256:${await sha256hex(encoder.encode(account.userId))}`;
    const shardNames = Array.from(bookmarksByYear.keys())
      .sort()
      .map((year) => `data/bookmarks-${year}.jsonl`);

    const manifest = {
      totem: {
        export_version: 1,
        schema_version: DB_VERSION,
      },
      generated_at: new Date().toISOString(),
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
        bookmarks: bookmarks.length,
        details: details.length,
        highlights: highlights.length,
        reading_progress: readingProgress.length,
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

    const manifestBytes = encoder.encode(JSON.stringify(manifest, null, 2));

    const entries: Array<{
      input: Uint8Array;
      name: string;
      lastModified: Date;
    }> = [];
    const now = new Date();

    entries.push({ input: manifestBytes, name: "manifest.json", lastModified: now });
    entries.push({ input: readmeBytes, name: "readme.md", lastModified: now });
    entries.push({ input: csvBytes, name: "bookmarks.csv", lastModified: now });

    for (const [name, data] of dataFiles) {
      entries.push({ input: data, name, lastModified: now });
    }
    for (const file of bookmarkMarkdownFiles) {
      entries.push({ input: file.bytes, name: file.path, lastModified: now });
    }

    const zipStream = makeZip(entries);
    if (target.kind === "fsa") {
      await zipStream.pipeTo(target.dest);
    } else {
      const blob = await new Response(zipStream).blob();
      downloadBlob(blob, filename);
    }

    return {
      bookmarkCount: bookmarks.length,
      detailCount: details.length,
      highlightCount: highlights.length,
      readingProgressCount: readingProgress.length,
    };
  } catch (error) {
    if (target.kind === "fsa") {
      await target.dest.abort().catch(() => {});
    }
    throw error;
  }
}
