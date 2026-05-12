import "fake-indexeddb/auto";
import { describe, expect, it, beforeEach } from "vitest";
import { zipSync, strToU8 } from "fflate";
import { parseZip, validateImport, runImport, type ImportManifest } from "../run-import";
import {
  getAllBookmarks,
  getAllTweetDetails,
  getAllHighlights,
  getAllReadingProgress,
  upsertBookmarks,
} from "../../../db";
import type { Bookmark, TweetDetailCache, Highlight, ReadingProgress } from "../../../types";

function makeBookmark(id: string, tweetId: string): Bookmark {
  return {
    id,
    tweetId,
    text: `Bookmark ${id}`,
    createdAt: 1_700_000_000_000,
    sortIndex: id,
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

function makeDetail(tweetId: string): TweetDetailCache {
  return { tweetId, fetchedAt: Date.now(), focalTweet: null, thread: [] };
}

function makeHighlight(id: string, tweetId: string): Highlight {
  return {
    id,
    tweetId,
    sectionId: "s1",
    startOffset: 0,
    endOffset: 5,
    selectedText: "hello",
    note: null,
    color: "yellow",
    createdAt: Date.now(),
  };
}

function makeProgress(tweetId: string): ReadingProgress {
  return {
    tweetId,
    openedAt: Date.now(),
    lastReadAt: Date.now(),
    scrollY: 0,
    scrollHeight: 1000,
    completed: false,
  };
}

async function sha256hex(data: Uint8Array): Promise<string> {
  const buf = new ArrayBuffer(data.byteLength);
  new Uint8Array(buf).set(data);
  const hash = await globalThis.crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function buildValidZip(bookmarks: Bookmark[], options?: {
  details?: TweetDetailCache[];
  highlights?: Highlight[];
  readingProgress?: ReadingProgress[];
  accountUserId?: string;
  schemaVersion?: number;
}) {
  const encoder = new TextEncoder();
  const dets = options?.details ?? [];
  const hlts = options?.highlights ?? [];
  const rp = options?.readingProgress ?? [];
  const accountUserId = options?.accountUserId ?? "user123";
  const schemaVersion = options?.schemaVersion ?? 8;

  const bookmarksJsonl = encoder.encode(
    bookmarks.map((b) => JSON.stringify(b)).join("\n") + "\n",
  );
  const detailsJsonl = encoder.encode(
    dets.length > 0 ? dets.map((d) => JSON.stringify(d)).join("\n") + "\n" : "",
  );
  const highlightsJsonl = encoder.encode(
    hlts.length > 0 ? hlts.map((h) => JSON.stringify(h)).join("\n") + "\n" : "",
  );
  const rpJsonl = encoder.encode(
    rp.length > 0 ? rp.map((r) => JSON.stringify(r)).join("\n") + "\n" : "",
  );

  const checksums: Record<string, string> = {
    "data/bookmarks-2023.jsonl": `sha256:${await sha256hex(bookmarksJsonl)}`,
    "data/details.jsonl": `sha256:${await sha256hex(detailsJsonl)}`,
    "data/highlights.jsonl": `sha256:${await sha256hex(highlightsJsonl)}`,
    "data/reading-progress.jsonl": `sha256:${await sha256hex(rpJsonl)}`,
  };

  const accountIdHash = `sha256:${await sha256hex(encoder.encode(accountUserId))}`;

  const manifest: ImportManifest = {
    totem: { export_version: 1, schema_version: schemaVersion },
    account: { id_hash: accountIdHash, handle_redacted: "@t***st" },
    counts: {
      bookmarks: bookmarks.length,
      details: dets.length,
      highlights: hlts.length,
      reading_progress: rp.length,
    },
    shards: {
      bookmarks: ["data/bookmarks-2023.jsonl"],
      details: ["data/details.jsonl"],
      highlights: ["data/highlights.jsonl"],
      reading_progress: ["data/reading-progress.jsonl"],
    },
    checksums,
  };

  const manifestBytes = encoder.encode(JSON.stringify(manifest, null, 2));

  const files: Record<string, Uint8Array> = {
    "manifest.json": manifestBytes,
    "data/bookmarks-2023.jsonl": bookmarksJsonl,
    "data/details.jsonl": detailsJsonl,
    "data/highlights.jsonl": highlightsJsonl,
    "data/reading-progress.jsonl": rpJsonl,
  };

  return zipSync(files);
}

describe("parseZip", () => {
  it("refuses a non-ZIP file", () => {
    const result = parseZip(new Uint8Array([1, 2, 3]));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("not_totem_export");
  });

  it("refuses a ZIP without manifest.json", () => {
    const zip = zipSync({ "hello.txt": strToU8("world") });
    const result = parseZip(zip);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("not_totem_export");
  });

  it("refuses a ZIP with invalid manifest JSON", () => {
    const zip = zipSync({ "manifest.json": strToU8("not json") });
    const result = parseZip(zip);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("not_totem_export");
  });

  it("refuses a ZIP with empty shards", () => {
    const manifest = {
      totem: { export_version: 1, schema_version: 8 },
      shards: { bookmarks: [], details: [], highlights: [], reading_progress: [] },
    };
    const zip = zipSync({
      "manifest.json": strToU8(JSON.stringify(manifest)),
    });
    const result = parseZip(zip);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("empty_zip");
  });

  it("parses a valid ZIP", async () => {
    const zip = await buildValidZip([makeBookmark("b1", "t1")]);
    const result = parseZip(zip);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.manifest.totem.export_version).toBe(1);
      expect(result.manifest.counts.bookmarks).toBe(1);
    }
  });
});

describe("validateImport", () => {
  it("refuses schema_version > DB_VERSION", async () => {
    const zip = await buildValidZip([makeBookmark("b1", "t1")], {
      schemaVersion: 999,
    });
    const parsed = parseZip(zip);
    if (!parsed.ok) throw new Error("parse failed");
    const result = await validateImport(parsed, "user123");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("schema_too_new");
  });

  it("refuses when not logged in", async () => {
    const zip = await buildValidZip([makeBookmark("b1", "t1")]);
    const parsed = parseZip(zip);
    if (!parsed.ok) throw new Error("parse failed");
    const result = await validateImport(parsed, null);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("not_logged_in");
  });

  it("detects checksum mismatch", async () => {
    const zip = await buildValidZip([makeBookmark("b1", "t1")]);
    const parsed = parseZip(zip);
    if (!parsed.ok) throw new Error("parse failed");
    parsed.manifest.checksums["data/bookmarks-2023.jsonl"] = "sha256:0000";
    const result = await validateImport(parsed, "user123");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("checksum_mismatch");
  });

  it("validates with matching account", async () => {
    const zip = await buildValidZip([makeBookmark("b1", "t1")]);
    const parsed = parseZip(zip);
    if (!parsed.ok) throw new Error("parse failed");
    const result = await validateImport(parsed, "user123");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.accountMatch).toBe(true);
  });

  it("validates with mismatched account", async () => {
    const zip = await buildValidZip([makeBookmark("b1", "t1")]);
    const parsed = parseZip(zip);
    if (!parsed.ok) throw new Error("parse failed");
    const result = await validateImport(parsed, "differentuser");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.accountMatch).toBe(false);
  });
});

describe("runImport", () => {
  beforeEach(async () => {
    // Clear IDB state between tests using the fake-indexeddb auto-cleanup
    const { clearAllLocalData } = await import("../../../db");
    await clearAllLocalData();
  });

  it("imports bookmarks into an empty library", async () => {
    const b1 = makeBookmark("b1", "t1");
    const b2 = makeBookmark("b2", "t2");
    const zip = await buildValidZip([b1, b2]);
    const parsed = parseZip(zip);
    if (!parsed.ok) throw new Error("parse failed");
    const validated = await validateImport(parsed, "user123");
    if (!validated.ok) throw new Error("validation failed");

    const result = await runImport(validated);
    expect(result.bookmarks.added).toBe(2);
    expect(result.bookmarks.alreadyHad).toBe(0);

    const stored = await getAllBookmarks();
    expect(stored.length).toBe(2);
  });

  it("skips existing bookmarks (additive only)", async () => {
    const existing = makeBookmark("b1", "t1");
    await upsertBookmarks([existing]);

    const b1 = makeBookmark("b1", "t1");
    const b2 = makeBookmark("b2", "t2");
    const zip = await buildValidZip([b1, b2]);
    const parsed = parseZip(zip);
    if (!parsed.ok) throw new Error("parse failed");
    const validated = await validateImport(parsed, "user123");
    if (!validated.ok) throw new Error("validation failed");

    const result = await runImport(validated);
    expect(result.bookmarks.added).toBe(1);
    expect(result.bookmarks.alreadyHad).toBe(1);
  });

  it("second import is a no-op (round-trip)", async () => {
    const b1 = makeBookmark("b1", "t1");
    const zip = await buildValidZip([b1]);
    const parsed = parseZip(zip);
    if (!parsed.ok) throw new Error("parse failed");
    const validated = await validateImport(parsed, "user123");
    if (!validated.ok) throw new Error("validation failed");

    await runImport(validated);

    const parsed2 = parseZip(zip);
    if (!parsed2.ok) throw new Error("second parse failed");
    const validated2 = await validateImport(parsed2, "user123");
    if (!validated2.ok) throw new Error("second validation failed");

    const result2 = await runImport(validated2);
    expect(result2.bookmarks.added).toBe(0);
    expect(result2.bookmarks.alreadyHad).toBe(1);
  });

  it("imports all four stores", async () => {
    const b = makeBookmark("b1", "t1");
    const d = makeDetail("t1");
    const h = makeHighlight("h1", "t1");
    const p = makeProgress("t1");

    const zip = await buildValidZip([b], {
      details: [d],
      highlights: [h],
      readingProgress: [p],
    });
    const parsed = parseZip(zip);
    if (!parsed.ok) throw new Error("parse failed");
    const validated = await validateImport(parsed, "user123");
    if (!validated.ok) throw new Error("validation failed");

    const result = await runImport(validated);
    expect(result.bookmarks.added).toBe(1);
    expect(result.details.added).toBe(1);
    expect(result.highlights.added).toBe(1);
    expect(result.readingProgress.added).toBe(1);

    const storedBookmarks = await getAllBookmarks();
    const storedDetails = await getAllTweetDetails();
    const storedHighlights = await getAllHighlights();
    const storedProgress = await getAllReadingProgress();
    expect(storedBookmarks.length).toBe(1);
    expect(storedDetails.length).toBe(1);
    expect(storedHighlights.length).toBe(1);
    expect(storedProgress.length).toBe(1);
  });

  it("calls onProgress per store", async () => {
    const b = makeBookmark("b1", "t1");
    const zip = await buildValidZip([b]);
    const parsed = parseZip(zip);
    if (!parsed.ok) throw new Error("parse failed");
    const validated = await validateImport(parsed, "user123");
    if (!validated.ok) throw new Error("validation failed");

    const progressCalls: string[] = [];
    await runImport(validated, (p) => progressCalls.push(p.store));

    expect(progressCalls).toEqual([
      "bookmarks",
      "details",
      "highlights",
      "reading_progress",
    ]);
  });
});
