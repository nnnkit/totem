import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import * as db from "../../../db";
import {
  clearAllLocalData,
  closeDb,
  recordTodayQueueExposures,
  upsertBookmarks,
  upsertHighlights,
  upsertQueueBookmarkMetadata,
  upsertTodayQueueSnapshot,
  upsertTweetDetailCache,
} from "../../../db";
import type { Bookmark, Highlight, ThreadTweet } from "../../../types";
import { sha256hex } from "../../crypto";
import { makeQueueExposure } from "../../today-queue";
import { runHighlightsExport, runQuickExport } from "../quick-export";

const SNOWFLAKE_EPOCH = 1288834974657n;

function sortIndexFromMs(ms: number): string {
  return ((BigInt(ms) - SNOWFLAKE_EPOCH) << 22n).toString();
}

function makeBookmark(
  tweetId: string,
  options: { createdAt: number; sortIndex: string; text?: string },
): Bookmark {
  return {
    id: tweetId,
    tweetId,
    text: options.text ?? `Bookmark ${tweetId}`,
    createdAt: options.createdAt,
    sortIndex: options.sortIndex,
    bookmarked: true,
    author: {
      name: "Test",
      screenName: "test",
      profileImageUrl: "",
      verified: false,
    },
    metrics: { likes: 0, retweets: 0, replies: 0, views: 0, bookmarks: 0 },
    media: [],
    urls: [],
    isThread: false,
    hasImage: false,
    hasVideo: false,
    hasLink: false,
    quotedTweet: null,
  };
}

function makeHighlightRow(
  id: string,
  overrides: Partial<Highlight> = {},
): Highlight {
  return {
    id,
    tweetId: "tweet-1",
    sectionId: "1",
    startOffset: 0,
    endOffset: 10,
    selectedText: "highlighted text",
    note: null,
    color: "yellow",
    createdAt: Date.UTC(2024, 0, 4),
    ...overrides,
  };
}

function collectingWritable(): {
  stream: WritableStream<Uint8Array>;
  bytes: () => Uint8Array;
} {
  const chunks: Uint8Array[] = [];
  return {
    stream: new WritableStream<Uint8Array>({
      write(chunk) {
        chunks.push(chunk);
      },
    }),
    bytes() {
      const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
      const output = new Uint8Array(total);
      let offset = 0;
      for (const chunk of chunks) {
        output.set(chunk, offset);
        offset += chunk.byteLength;
      }
      return output;
    },
  };
}

async function runExportThroughFilePicker(): Promise<Uint8Array> {
  const sink = collectingWritable();
  vi.stubGlobal("window", {
    showSaveFilePicker: vi.fn(async () => ({
      createWritable: vi.fn(async () => sink.stream),
    })),
  });

  await runQuickExport({ userId: "user-123", handle: "yourhandle" });
  return sink.bytes();
}

beforeEach(async () => {
  closeDb();
  await clearAllLocalData();
});

afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  closeDb();
  await clearAllLocalData();
});

describe("runQuickExport", () => {
  it("writes a complete ZIP through the File System Access API", async () => {
    const createdAt = Date.UTC(2020, 4, 3, 12);
    const savedAt = Date.UTC(2024, 0, 2, 9, 30);
    const bookmark = makeBookmark("tweet-1", {
      createdAt,
      sortIndex: sortIndexFromMs(savedAt),
    });
    const unavailable = makeBookmark("tweet-2", {
      createdAt: Date.UTC(2021, 1, 4, 10),
      sortIndex: "legacy-sort-index",
    });
    const thread: ThreadTweet[] = [
      {
        tweetId: "tweet-1",
        text: "Bookmark tweet-1",
        createdAt,
        author: bookmark.author,
        media: [],
        urls: [],
      },
      {
        tweetId: "tweet-1-reply",
        text: "Full context continuation",
        createdAt: createdAt + 1,
        author: bookmark.author,
        media: [],
        urls: [],
      },
    ];

    await upsertBookmarks([bookmark, unavailable]);
    await upsertTweetDetailCache({
      tweetId: "tweet-1",
      fetchedAt: Date.now(),
      focalTweet: bookmark,
      thread,
      detailsStatus: "ok",
    });
    await upsertTweetDetailCache({
      tweetId: "tweet-2",
      fetchedAt: Date.now(),
      focalTweet: null,
      thread: [],
      detailsStatus: "unavailable",
      unavailableReason: "deleted",
    });
    await upsertTodayQueueSnapshot({
      key: "2026-06-08:15:v1",
      localDate: "2026-06-08",
      budgetMinutes: 15,
      version: 1,
      tweetIds: ["tweet-1"],
      generatedAt: Date.UTC(2026, 5, 8, 8),
    });
    await upsertQueueBookmarkMetadata({
      tweetId: "tweet-1",
      intent: "read_soon",
      snoozedUntil: null,
      updatedAt: Date.UTC(2026, 5, 8, 9),
    });
    await recordTodayQueueExposures([
      makeQueueExposure({
        tweetId: "tweet-1",
        action: "queued",
        localDate: "2026-06-08",
        createdAt: Date.UTC(2026, 5, 8, 8),
      }),
    ]);

    const zipBytes = await runExportThroughFilePicker();
    const entries = unzipSync(zipBytes);
    const manifest = JSON.parse(strFromU8(entries["manifest.json"]));
    const csv = strFromU8(entries["bookmarks.csv"]);
    const readme = strFromU8(entries["readme.md"]);
    const tweetMarkdown = strFromU8(
      entries["bookmarks/bookmark-tweet-1-tweet-1.md"],
    );
    const queueSnapshots = strFromU8(entries["data/today-queue-snapshots.jsonl"]);
    const queueMetadata = strFromU8(entries["data/bookmark-queue-metadata.jsonl"]);
    const queueExposures = strFromU8(entries["data/today-queue-exposures.jsonl"]);

    expect(Object.keys(entries).sort()).toEqual([
      "bookmarks.csv",
      "bookmarks/bookmark-tweet-1-tweet-1.md",
      "bookmarks/bookmark-tweet-2-tweet-2.md",
      "data/bookmark-queue-metadata.jsonl",
      "data/bookmarks-2021.jsonl",
      "data/bookmarks-2024.jsonl",
      "data/details.jsonl",
      "data/highlights.jsonl",
      "data/reading-progress.jsonl",
      "data/today-queue-exposures.jsonl",
      "data/today-queue-snapshots.jsonl",
      "highlights.csv",
      "manifest.json",
      "readme.md",
    ]);
    expect(manifest.counts).toMatchObject({
      bookmarks: 2,
      details: 2,
      highlights: 0,
      reading_progress: 0,
      today_queue_snapshots: 1,
      bookmark_queue_metadata: 1,
      today_queue_exposures: 1,
    });
    expect(manifest.shards.bookmarks).toEqual([
      "data/bookmarks-2021.jsonl",
      "data/bookmarks-2024.jsonl",
    ]);
    expect(manifest.checksums["bookmarks.csv"]).toBe(
      `sha256:${await sha256hex(entries["bookmarks.csv"])}`,
    );
    expect(manifest.checksums["data/details.jsonl"]).toBe(
      `sha256:${await sha256hex(entries["data/details.jsonl"])}`,
    );
    expect(entries["bookmarks.csv"][0]).toBe(0xef);
    expect(entries["bookmarks.csv"][1]).toBe(0xbb);
    expect(entries["bookmarks.csv"][2]).toBe(0xbf);

    const tweet1Line = csv.split("\r\n").find((line) => line.startsWith("tweet-1,"));
    const tweet2Line = csv.split("\r\n").find((line) => line.startsWith("tweet-2,"));
    expect(tweet1Line).toContain(new Date(createdAt).toISOString());
    expect(tweet1Line).toContain(new Date(savedAt).toISOString());
    expect(tweet1Line?.endsWith(",false,true")).toBe(true);
    expect(tweet2Line).toContain(new Date(unavailable.createdAt).toISOString());
    expect(tweet2Line?.endsWith(",false,false")).toBe(true);
    expect(readme).toContain(
      "[Bookmark tweet-1](bookmarks/bookmark-tweet-1-tweet-1.md)",
    );
    expect(readme).toContain("Use the Import link shown when your library is empty");
    expect(readme).toContain("https://x.com/test/status/tweet-1");
    expect(manifest.derived.markdown_index).toBe("readme.md");
    expect(manifest.derived.highlights_csv).toBe("highlights.csv");
    expect(manifest.derived.highlights_digest).toBeNull();
    expect(manifest.derived.markdown_files).toContain(
      "bookmarks/bookmark-tweet-1-tweet-1.md",
    );
    expect(tweetMarkdown).toContain("source: https://x.com/test/status/tweet-1");
    expect(tweetMarkdown).toContain("# Bookmark tweet-1");
    expect(tweetMarkdown).toContain("Full context continuation");
    expect(queueSnapshots).toContain('"key":"2026-06-08:15:v1"');
    expect(queueMetadata).toContain('"intent":"read_soon"');
    expect(queueExposures).toContain('"action":"queued"');
  });

  it("falls back to an anchor download when showSaveFilePicker is unavailable", async () => {
    const bookmark = makeBookmark("tweet-1", {
      createdAt: Date.UTC(2024, 0, 2),
      sortIndex: sortIndexFromMs(Date.UTC(2024, 0, 3)),
    });
    await upsertBookmarks([bookmark]);

    const anchor = {
      href: "",
      download: "",
      click: vi.fn(),
      remove: vi.fn(),
    };
    const appendChild = vi.fn();
    const createObjectURL = vi.fn(() => "blob:totem-export");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("window", {});
    vi.stubGlobal("document", {
      createElement: vi.fn(() => anchor),
      body: { appendChild },
    });
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    vi.spyOn(globalThis, "setTimeout").mockImplementation((handler) => {
      if (typeof handler === "function") handler();
      return 0 as never;
    });

    const result = await runQuickExport({ userId: "user-123", handle: "yourhandle" });

    expect(result.bookmarkCount).toBe(1);
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(anchor.download).toMatch(/^totem-export-\d{4}-\d{2}-\d{2}\.zip$/);
    expect(anchor.href).toBe("blob:totem-export");
    expect(appendChild).toHaveBeenCalledWith(anchor);
    expect(anchor.click).toHaveBeenCalled();
    expect(anchor.remove).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:totem-export");
  });

  it("skips rows deleted mid-export instead of aborting, and reports honest counts", async () => {
    const rows: Bookmark[] = [];
    const baseSavedAt = Date.UTC(2024, 0, 1);
    for (let i = 0; i < 3; i++) {
      rows.push(makeBookmark(`tweet-${i}`, {
        createdAt: Date.UTC(2023, 0, 1) + i,
        sortIndex: sortIndexFromMs(baseSavedAt + i),
      }));
    }
    await upsertBookmarks(rows);

    // Simulate a concurrent delete (e.g. the hydration job pruning a row in the
    // same tab): the id was snapshotted, but a later re-fetch returns null.
    const realGetBookmarkById = db.getBookmarkById;
    vi.spyOn(db, "getBookmarkById").mockImplementation(async (id: string) =>
      id === "tweet-1" ? null : realGetBookmarkById(id),
    );

    const zipBytes = await runExportThroughFilePicker();
    const entries = unzipSync(zipBytes);
    const manifest = JSON.parse(strFromU8(entries["manifest.json"]));
    const bookmarkLines = manifest.shards.bookmarks.flatMap((name: string) =>
      strFromU8(entries[name]).trim().split("\n").filter(Boolean),
    );

    // Export completed (no abort) and the manifest reflects the 2 surviving rows.
    expect(manifest.counts.bookmarks).toBe(2);
    expect(bookmarkLines).toHaveLength(2);
    expect(manifest.derived.markdown_files).toHaveLength(2);
    expect(bookmarkLines.join("\n")).not.toContain("tweet-1");
  });

  it("exports thousands of bookmarks through streamed quick export entries", async () => {
    const ROW_COUNT = 2_000;
    const rows: Bookmark[] = [];
    const baseSavedAt = Date.UTC(2024, 0, 1);
    for (let i = 0; i < ROW_COUNT; i++) {
      rows.push(makeBookmark(`tweet-${i}`, {
        createdAt: Date.UTC(2023, 0, 1) + i,
        sortIndex: sortIndexFromMs(baseSavedAt + i),
        text: `Bookmark ${i}`,
      }));
    }

    for (let i = 0; i < rows.length; i += 250) {
      await upsertBookmarks(rows.slice(i, i + 250));
    }

    const zipBytes = await runExportThroughFilePicker();
    const entries = unzipSync(zipBytes);
    const manifest = JSON.parse(strFromU8(entries["manifest.json"]));
    const bookmarkLines = manifest.shards.bookmarks.flatMap((name: string) =>
      strFromU8(entries[name]).trim().split("\n").filter(Boolean)
    );

    expect(manifest.counts.bookmarks).toBe(ROW_COUNT);
    expect(bookmarkLines).toHaveLength(ROW_COUNT);
    expect(manifest.derived.markdown_files).toHaveLength(ROW_COUNT);
  });

  it("embeds highlights in the library ZIP and adds a digest when present", async () => {
    const bookmark = makeBookmark("tweet-1", {
      createdAt: Date.UTC(2024, 0, 2, 12),
      sortIndex: sortIndexFromMs(Date.UTC(2024, 0, 3, 9)),
      text: "A thoughtful post worth highlighting",
    });
    await upsertBookmarks([bookmark]);
    await upsertHighlights([
      makeHighlightRow("h1", {
        selectedText: "worth highlighting",
        note: "remember this",
      }),
      makeHighlightRow("h2", { selectedText: "", note: "a standalone note", type: "note" }),
    ]);

    const zipBytes = await runExportThroughFilePicker();
    const entries = unzipSync(zipBytes);
    const manifest = JSON.parse(strFromU8(entries["manifest.json"]));
    const markdown = strFromU8(
      entries["bookmarks/a-thoughtful-post-worth-highlighting-tweet-1.md"],
    );
    const digest = strFromU8(entries["highlights.md"]);
    const highlightsCsv = strFromU8(entries["highlights.csv"]);

    expect(manifest.counts.highlights).toBe(2);
    expect(manifest.derived.highlights_digest).toBe("highlights.md");
    expect(markdown).toContain("tags: [totem/bookmark, twitter/test]");
    expect(markdown).toContain("highlights: 1");
    expect(markdown).toContain("notes: 2");
    expect(markdown).toContain("## Highlights");
    expect(markdown).toContain("> worth highlighting");
    expect(markdown).toContain("**Note:** remember this");
    expect(markdown).toContain("## Notes");
    expect(markdown).toContain("- a standalone note ^h-h2");
    expect(digest).toContain("# Highlights & notes");
    expect(digest).toContain("worth highlighting");
    expect(highlightsCsv).toContain("tweet_id,source_url,author_handle");
    expect(highlightsCsv).toContain("worth highlighting");
    expect(highlightsCsv).toContain("a standalone note");
  });
});

describe("runHighlightsExport", () => {
  it("exports only annotated bookmarks with a digest and CSV", async () => {
    const annotated = makeBookmark("tweet-1", {
      createdAt: Date.UTC(2024, 0, 2, 12),
      sortIndex: sortIndexFromMs(Date.UTC(2024, 0, 3, 9)),
      text: "Highlighted post",
    });
    const plain = makeBookmark("tweet-2", {
      createdAt: Date.UTC(2024, 0, 4, 12),
      sortIndex: sortIndexFromMs(Date.UTC(2024, 0, 5, 9)),
      text: "Not highlighted",
    });
    await upsertBookmarks([annotated, plain]);
    await upsertHighlights([
      makeHighlightRow("h1", { tweetId: "tweet-1", selectedText: "Highlighted" }),
    ]);

    const sink = collectingWritable();
    vi.stubGlobal("window", {
      showSaveFilePicker: vi.fn(async () => ({
        createWritable: vi.fn(async () => sink.stream),
      })),
    });

    const result = await runHighlightsExport({
      userId: "user-123",
      handle: "yourhandle",
    });

    expect(result).toEqual({
      annotatedBookmarkCount: 1,
      highlightCount: 1,
      noteCount: 0,
    });

    const entries = unzipSync(sink.bytes());
    expect(Object.keys(entries).sort()).toEqual([
      "bookmarks/highlighted-post-tweet-1.md",
      "highlights.csv",
      "highlights.md",
      "readme.md",
    ]);
    const markdown = strFromU8(entries["bookmarks/highlighted-post-tweet-1.md"]);
    expect(markdown).toContain("> Highlighted");
  });
});
