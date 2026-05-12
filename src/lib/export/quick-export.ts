import { makeZip } from "client-zip";
import type { Bookmark } from "../../types";
import { buildSyntheticExportPlainText } from "./tweet-export";
import {
  getAllBookmarks,
  getAllTweetDetails,
  getAllHighlights,
  getAllReadingProgress,
  getDetailedTweetIds,
} from "../../db";
import { DB_VERSION } from "../constants/db";
import { stripCardUrlsFromTweetText } from "../tweet-text";

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

// ── CSV ──────────────────────────────────────────────────────────────

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
  detailedIds: Set<string>,
): string {
  const lines: string[] = [BOM + csvRow([...CSV_COLUMNS])];
  for (const b of bookmarks) {
    const text = stripCardUrlsFromTweetText(b.text, b.urls).trim();
    lines.push(
      csvRow([
        b.tweetId,
        tweetUrl(b),
        b.author.screenName,
        b.author.name,
        text,
        isoFromMs(b.createdAt),
        isoFromMs(b.createdAt),
        mediaUrlsJoined(b),
        quotedTweetUrl(b),
        String(b.isThread),
        String(detailedIds.has(b.tweetId)),
      ]),
    );
  }
  return lines.join("");
}

// ── Markdown ─────────────────────────────────────────────────────────

function truncateTitle(text: string, max = 60): string {
  const first = text.split("\n")[0].trim();
  if (!first) return "(No text)";
  return first.length <= max ? first : `${first.slice(0, max - 1)}…`;
}

function mediaSummary(bookmark: Bookmark): string {
  const photos = bookmark.media.filter((m) => m.type === "photo").length;
  const videos = bookmark.media.filter(
    (m) => m.type === "video" || m.type === "animated_gif",
  ).length;
  const parts: string[] = [];
  if (photos) parts.push(`${photos} photo${photos > 1 ? "s" : ""}`);
  if (videos) parts.push(`${videos} video${videos > 1 ? "s" : ""}`);
  return parts.join(" · ");
}

function buildMarkdown(
  bookmarks: Bookmark[],
  handle: string,
): string {
  const count = bookmarks.length.toLocaleString("en-US");
  const today = dateFromMs(Date.now());
  const lines: string[] = [
    `# Totem export — ${count} bookmarks\n`,
    `\nGenerated ${today} from @${handle}.\n`,
    `\n---\n`,
  ];

  for (const b of bookmarks) {
    const body = buildSyntheticExportPlainText(b, []);
    const title = truncateTitle(
      stripCardUrlsFromTweetText(b.text, b.urls),
    );
    const quoted = body
      .split("\n")
      .map((line) => `> ${line}`)
      .join("\n");
    const meta: string[] = [`Saved ${dateFromMs(b.createdAt)}`];
    const media = mediaSummary(b);
    if (media) meta.push(media);
    if (b.isThread) meta.push("Thread");

    lines.push(
      `\n## @${b.author.screenName} — "${title}"\n`,
      `\n${quoted}\n`,
      `\n${meta.join(" · ")} · [Open on X](${tweetUrl(b)})\n`,
      `\n---\n`,
    );
  }

  return lines.join("");
}

// ── README ───────────────────────────────────────────────────────────

function buildReadme(handle: string): string {
  return `# Totem export

This ZIP was exported from Totem by @${handle}.

## What's inside

| File | Purpose |
|------|---------|
| bookmarks.csv | Opens in Excel, Sheets, Notion — one row per bookmark |
| bookmarks.md | Human-readable — one heading per bookmark |
| data/*.jsonl | Canonical data — used for re-import into Totem |
| manifest.json | Export metadata, checksums, counts |

## How to re-import

1. Open Totem on any Chrome install
2. Go to Settings → Storage → Import
3. Drop this entire ZIP file — the importer reads \`data/*.jsonl\` only

CSV and Markdown are for your convenience. The importer ignores them.

## Schema docs

Full field-by-field documentation: https://usetotem.xyz/export-format/v1

## Privacy

This file contains your X bookmark data. Treat it like your X account data.
`;
}

// ── Main pipeline ────────────────────────────────────────────────────

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

export async function runQuickExport(
  account: ExportAccountInfo,
): Promise<QuickExportResult> {
  const today = dateFromMs(Date.now());
  const fileHandle = await window.showSaveFilePicker({
    suggestedName: `totem-export-${today}.zip`,
    types: [
      {
        description: "ZIP archive",
        accept: { "application/zip": [".zip"] },
      },
    ],
  });
  const dest = await fileHandle.createWritable();

  try {
    const bookmarks = await getAllBookmarks();
    const details = await getAllTweetDetails();
    const highlights = await getAllHighlights();
    const readingProgress = await getAllReadingProgress();
    const detailedIds = await getDetailedTweetIds();

    const encoder = new TextEncoder();

    // Year-sharded bookmark JSONL
    const bookmarksByYear = new Map<string, Bookmark[]>();
    for (const b of bookmarks) {
      const year = yearFromMs(b.createdAt);
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

    const csvContent = buildCsv(bookmarks, detailedIds);
    const csvBytes = encoder.encode(csvContent);

    const mdContent = buildMarkdown(bookmarks, account.handle);
    const mdBytes = encoder.encode(mdContent);

    // SHA256 checksums
    const checksums: Record<string, string> = {};
    for (const [name, data] of dataFiles) {
      checksums[name] = `sha256:${await sha256hex(data)}`;
    }
    checksums["bookmarks.csv"] = `sha256:${await sha256hex(csvBytes)}`;
    checksums["bookmarks.md"] = `sha256:${await sha256hex(mdBytes)}`;

    // Manifest
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
        markdown: "bookmarks.md",
      },
      checksums,
    };

    const manifestBytes = encoder.encode(JSON.stringify(manifest, null, 2));
    const readmeBytes = encoder.encode(buildReadme(account.handle));

    // Assemble ZIP entries
    const entries: Array<{
      input: Uint8Array;
      name: string;
      lastModified: Date;
    }> = [];
    const now = new Date();

    entries.push({ input: manifestBytes, name: "manifest.json", lastModified: now });
    entries.push({ input: readmeBytes, name: "README.md", lastModified: now });
    entries.push({ input: csvBytes, name: "bookmarks.csv", lastModified: now });
    entries.push({ input: mdBytes, name: "bookmarks.md", lastModified: now });

    for (const [name, data] of dataFiles) {
      entries.push({ input: data, name, lastModified: now });
    }

    const zipStream = makeZip(entries);
    await zipStream.pipeTo(dest);

    return {
      bookmarkCount: bookmarks.length,
      detailCount: details.length,
      highlightCount: highlights.length,
      readingProgressCount: readingProgress.length,
    };
  } catch (error) {
    await dest.abort().catch(() => {});
    throw error;
  }
}
