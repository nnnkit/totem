import "fake-indexeddb/auto";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { zipSync, strToU8 } from "fflate";
import {
  ImportPartialFailure,
  parseZip,
  validateImport,
  runImport,
  type ImportManifest,
} from "../run-import";
import {
  getAllBookmarks,
  getAllTweetDetails,
  getAllHighlights,
  getAllReadingProgress,
  getAllQueueBookmarkMetadata,
  getAllTodayQueueExposures,
  getAllTodayQueueSnapshots,
  upsertBookmarks,
} from "../../../db";
import type {
  Bookmark,
  BookmarkQueueMetadata,
  TweetDetailCache,
  Highlight,
  ReadingProgress,
  TodayQueueExposure,
  TodayQueueSnapshot,
} from "../../../types";

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
  todayQueueSnapshots?: TodayQueueSnapshot[];
  queueMetadata?: BookmarkQueueMetadata[];
  todayQueueExposures?: TodayQueueExposure[];
  accountUserId?: string;
  schemaVersion?: number;
}) {
  const encoder = new TextEncoder();
  const dets = options?.details ?? [];
  const hlts = options?.highlights ?? [];
  const rp = options?.readingProgress ?? [];
  const queueSnapshots = options?.todayQueueSnapshots;
  const queueMetadata = options?.queueMetadata;
  const queueExposures = options?.todayQueueExposures;
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
  const queueSnapshotsJsonl = queueSnapshots
    ? encoder.encode(queueSnapshots.map((row) => JSON.stringify(row)).join("\n") + "\n")
    : null;
  const queueMetadataJsonl = queueMetadata
    ? encoder.encode(queueMetadata.map((row) => JSON.stringify(row)).join("\n") + "\n")
    : null;
  const queueExposuresJsonl = queueExposures
    ? encoder.encode(queueExposures.map((row) => JSON.stringify(row)).join("\n") + "\n")
    : null;

  const checksums: Record<string, string> = {
    "data/bookmarks-2023.jsonl": `sha256:${await sha256hex(bookmarksJsonl)}`,
    "data/details.jsonl": `sha256:${await sha256hex(detailsJsonl)}`,
    "data/highlights.jsonl": `sha256:${await sha256hex(highlightsJsonl)}`,
    "data/reading-progress.jsonl": `sha256:${await sha256hex(rpJsonl)}`,
  };

  if (queueSnapshotsJsonl) {
    checksums["data/today-queue-snapshots.jsonl"] =
      `sha256:${await sha256hex(queueSnapshotsJsonl)}`;
  }
  if (queueMetadataJsonl) {
    checksums["data/bookmark-queue-metadata.jsonl"] =
      `sha256:${await sha256hex(queueMetadataJsonl)}`;
  }
  if (queueExposuresJsonl) {
    checksums["data/today-queue-exposures.jsonl"] =
      `sha256:${await sha256hex(queueExposuresJsonl)}`;
  }

  const accountIdHash = `sha256:${await sha256hex(encoder.encode(accountUserId))}`;

  const manifest: ImportManifest = {
    totem: { export_version: 1, schema_version: schemaVersion },
    account: { id_hash: accountIdHash, handle_redacted: "@t***st" },
    counts: {
      bookmarks: bookmarks.length,
      details: dets.length,
      highlights: hlts.length,
      reading_progress: rp.length,
      ...(queueSnapshots
        ? { today_queue_snapshots: queueSnapshots.length }
        : {}),
      ...(queueMetadata
        ? { bookmark_queue_metadata: queueMetadata.length }
        : {}),
      ...(queueExposures
        ? { today_queue_exposures: queueExposures.length }
        : {}),
    },
    shards: {
      bookmarks: ["data/bookmarks-2023.jsonl"],
      details: ["data/details.jsonl"],
      highlights: ["data/highlights.jsonl"],
      reading_progress: ["data/reading-progress.jsonl"],
      ...(queueSnapshots
        ? { today_queue_snapshots: ["data/today-queue-snapshots.jsonl"] }
        : {}),
      ...(queueMetadata
        ? { bookmark_queue_metadata: ["data/bookmark-queue-metadata.jsonl"] }
        : {}),
      ...(queueExposures
        ? { today_queue_exposures: ["data/today-queue-exposures.jsonl"] }
        : {}),
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
  if (queueSnapshotsJsonl) {
    files["data/today-queue-snapshots.jsonl"] = queueSnapshotsJsonl;
  }
  if (queueMetadataJsonl) {
    files["data/bookmark-queue-metadata.jsonl"] = queueMetadataJsonl;
  }
  if (queueExposuresJsonl) {
    files["data/today-queue-exposures.jsonl"] = queueExposuresJsonl;
  }

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
      account: { id_hash: "sha256:abc", handle_redacted: "@t***st" },
      counts: { bookmarks: 0, details: 0, highlights: 0, reading_progress: 0 },
      shards: { bookmarks: [], details: [], highlights: [], reading_progress: [] },
      checksums: {},
    };
    const zip = zipSync({
      "manifest.json": strToU8(JSON.stringify(manifest)),
    });
    const result = parseZip(zip);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("empty_zip");
  });

  it("refuses a manifest missing required import fields", () => {
    const manifest = {
      totem: { export_version: 1, schema_version: 8 },
      shards: { bookmarks: ["data/bookmarks-2023.jsonl"] },
    };
    const zip = zipSync({
      "manifest.json": strToU8(JSON.stringify(manifest)),
      "data/bookmarks-2023.jsonl": strToU8("{}\n"),
    });
    const result = parseZip(zip);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("not_totem_export");
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
  it("refuses future export_version values", async () => {
    const zip = await buildValidZip([makeBookmark("b1", "t1")]);
    const parsed = parseZip(zip);
    if (!parsed.ok) throw new Error("parse failed");
    parsed.manifest.totem.export_version = 2;
    const result = await validateImport(parsed, "user123");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("schema_too_new");
  });

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

  it("requires every referenced shard to have a checksum", async () => {
    const zip = await buildValidZip([makeBookmark("b1", "t1")]);
    const parsed = parseZip(zip);
    if (!parsed.ok) throw new Error("parse failed");
    delete parsed.manifest.checksums["data/bookmarks-2023.jsonl"];
    const result = await validateImport(parsed, "user123");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("checksum_mismatch");
  });

  it("requires every referenced shard file to be present", async () => {
    const zip = await buildValidZip([makeBookmark("b1", "t1")]);
    const parsed = parseZip(zip);
    if (!parsed.ok) throw new Error("parse failed");
    delete parsed.files["data/bookmarks-2023.jsonl"];
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

    const [storedBookmarks, storedDetails, storedHighlights, storedProgress] =
      await Promise.all([
        getAllBookmarks(),
        getAllTweetDetails(),
        getAllHighlights(),
        getAllReadingProgress(),
      ]);
    expect(storedBookmarks.length).toBe(1);
    expect(storedDetails.length).toBe(1);
    expect(storedHighlights.length).toBe(1);
    expect(storedProgress.length).toBe(1);
  });

  it("imports optional queue stores", async () => {
    const snapshot: TodayQueueSnapshot = {
      key: "2026-06-08:15:v1",
      localDate: "2026-06-08",
      budgetMinutes: 15,
      version: 1,
      tweetIds: ["t1"],
      generatedAt: 1_700_000_000_000,
    };
    const metadata: BookmarkQueueMetadata = {
      tweetId: "t1",
      intent: "reference",
      snoozedUntil: null,
      updatedAt: 1_700_000_000_001,
    };
    const exposure: TodayQueueExposure = {
      id: "exposure-1",
      tweetId: "t1",
      action: "reference",
      localDate: "2026-06-08",
      createdAt: 1_700_000_000_002,
    };

    const zip = await buildValidZip([], {
      todayQueueSnapshots: [snapshot],
      queueMetadata: [metadata],
      todayQueueExposures: [exposure],
    });
    const parsed = parseZip(zip);
    if (!parsed.ok) throw new Error("parse failed");
    const validated = await validateImport(parsed, "user123");
    if (!validated.ok) throw new Error("validation failed");

    const result = await runImport(validated);
    expect(result.todayQueueSnapshots.added).toBe(1);
    expect(result.queueMetadata.added).toBe(1);
    expect(result.todayQueueExposures.added).toBe(1);

    const [storedSnapshots, storedMetadata, storedExposures] =
      await Promise.all([
        getAllTodayQueueSnapshots(),
        getAllQueueBookmarkMetadata(),
        getAllTodayQueueExposures(),
      ]);
    expect(storedSnapshots).toEqual([snapshot]);
    expect(storedMetadata).toEqual([metadata]);
    expect(storedExposures).toEqual([exposure]);
  });

  it("skips rows missing a primary key and imports the rest of the store", async () => {
    const b = makeBookmark("b1", "t1");
    const invalidDetail = {
      fetchedAt: Date.now(),
      focalTweet: null,
      thread: [],
    } as unknown as TweetDetailCache;
    const validDetail = makeDetail("t1");
    const h = makeHighlight("h1", "t1");
    const p = makeProgress("t1");

    const zip = await buildValidZip([b], {
      // One key-less detail row alongside a valid one: the bad row must be
      // dropped while the valid row still imports — not the whole store lost.
      details: [invalidDetail, validDetail],
      highlights: [h],
      readingProgress: [p],
    });
    const parsed = parseZip(zip);
    if (!parsed.ok) throw new Error("parse failed");
    const validated = await validateImport(parsed, "user123");
    if (!validated.ok) throw new Error("validation failed");

    const result = await runImport(validated);

    expect(result.status).toBe("complete");
    expect(result.details).toMatchObject({
      status: "succeeded",
      added: 1,
      alreadyHad: 0,
      total: 1,
    });
    expect(result.bookmarks.added).toBe(1);
    expect(result.highlights.added).toBe(1);
    expect(result.readingProgress.added).toBe(1);

    const storedDetails = await getAllTweetDetails();
    expect(storedDetails).toHaveLength(1);
    expect(storedDetails[0].tweetId).toBe("t1");
  });

  it("throws a partial failure with committed counts when a store write fails", async () => {
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

    // Simulate a genuine write failure (e.g. QuotaExceededError) on one store.
    const db = await import("../../../db");
    vi.spyOn(db, "upsertTweetDetailCaches").mockRejectedValueOnce(
      new Error("QuotaExceededError"),
    );

    let partial: ImportPartialFailure | null = null;
    try {
      await runImport(validated);
    } catch (error) {
      if (error instanceof ImportPartialFailure) partial = error;
    }

    expect(partial).toBeInstanceOf(ImportPartialFailure);
    expect(partial?.result.status).toBe("partial");
    expect(partial?.result.bookmarks).toMatchObject({ status: "succeeded", added: 1 });
    expect(partial?.result.details.status).toBe("failed");
    expect(partial?.result.highlights).toMatchObject({ status: "succeeded", added: 1 });
    expect(partial?.result.readingProgress).toMatchObject({ status: "succeeded", added: 1 });
    vi.restoreAllMocks();
  });

  it("refuses a ZIP whose inflated size exceeds the cap (zip-bomb guard)", async () => {
    const b = makeBookmark("b1", "t1");
    const zip = await buildValidZip([b], {});

    // Real archive, but a tiny cap stands in for the production 1 GiB limit so
    // we exercise the guard without allocating gigabytes. The oversized entry
    // must be refused before fflate inflates it.
    const parsed = parseZip(zip, { maxUncompressedBytes: 8 });
    expect(parsed.ok).toBe(false);
    expect(parsed.ok ? null : parsed.reason).toBe("too_large");

    // Same archive parses fine under the real (generous) defaults.
    expect(parseZip(zip).ok).toBe(true);
  });

  it("refuses a ZIP whose compressed size exceeds the input cap", async () => {
    const b = makeBookmark("b1", "t1");
    const zip = await buildValidZip([b], {});
    const parsed = parseZip(zip, { maxInputBytes: 4 });
    expect(parsed.ok).toBe(false);
    expect(parsed.ok ? null : parsed.reason).toBe("too_large");
  });

  it("reports malformed JSONL with shard path and line number", async () => {
    const encoder = new TextEncoder();
    const bookmarksJsonl = encoder.encode(`${JSON.stringify(makeBookmark("b1", "t1"))}\n{"bad"\n`);
    const emptyJsonl = encoder.encode("");
    const accountIdHash = `sha256:${await sha256hex(encoder.encode("user123"))}`;
    const manifest: ImportManifest = {
      totem: { export_version: 1, schema_version: 8 },
      account: { id_hash: accountIdHash, handle_redacted: "@t***st" },
      counts: { bookmarks: 2, details: 0, highlights: 0, reading_progress: 0 },
      shards: {
        bookmarks: ["data/bookmarks-2023.jsonl"],
        details: ["data/details.jsonl"],
        highlights: ["data/highlights.jsonl"],
        reading_progress: ["data/reading-progress.jsonl"],
      },
      checksums: {
        "data/bookmarks-2023.jsonl": `sha256:${await sha256hex(bookmarksJsonl)}`,
        "data/details.jsonl": `sha256:${await sha256hex(emptyJsonl)}`,
        "data/highlights.jsonl": `sha256:${await sha256hex(emptyJsonl)}`,
        "data/reading-progress.jsonl": `sha256:${await sha256hex(emptyJsonl)}`,
      },
    };
    const zip = zipSync({
      "manifest.json": encoder.encode(JSON.stringify(manifest, null, 2)),
      "data/bookmarks-2023.jsonl": bookmarksJsonl,
      "data/details.jsonl": emptyJsonl,
      "data/highlights.jsonl": emptyJsonl,
      "data/reading-progress.jsonl": emptyJsonl,
    });
    const parsed = parseZip(zip);
    if (!parsed.ok) throw new Error("parse failed");
    const validated = await validateImport(parsed, "user123");
    if (!validated.ok) throw new Error("validation failed");

    let partial: ImportPartialFailure | null = null;
    try {
      await runImport(validated);
    } catch (error) {
      if (error instanceof ImportPartialFailure) partial = error;
    }

    expect(partial).toBeInstanceOf(ImportPartialFailure);
    expect(partial?.result.bookmarks.status).toBe("failed");
    expect(partial?.result.bookmarks.status === "failed" ? partial.result.bookmarks.message : "")
      .toContain("data/bookmarks-2023.jsonl:2");
  });

  it("deduplicates incoming rows by store primary key", async () => {
    const earlierBookmark = makeBookmark("b1", "t1");
    const laterBookmark = {
      ...makeBookmark("b1", "t1"),
      text: "later bookmark",
    };
    const earlierDetail = makeDetail("t1");
    const laterDetail = {
      ...makeDetail("t1"),
      fetchedAt: earlierDetail.fetchedAt + 1,
    };
    const earlierHighlight = makeHighlight("h1", "t1");
    const laterHighlight = {
      ...makeHighlight("h1", "t1"),
      selectedText: "later highlight",
    };
    const earlierProgress = makeProgress("t1");
    const laterProgress = {
      ...makeProgress("t1"),
      scrollY: 250,
    };

    const zip = await buildValidZip([earlierBookmark, laterBookmark], {
      details: [earlierDetail, laterDetail],
      highlights: [earlierHighlight, laterHighlight],
      readingProgress: [earlierProgress, laterProgress],
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

    const [storedBookmarks, storedDetails, storedHighlights, storedProgress] =
      await Promise.all([
        getAllBookmarks(),
        getAllTweetDetails(),
        getAllHighlights(),
        getAllReadingProgress(),
      ]);

    expect(storedBookmarks).toHaveLength(1);
    expect(storedBookmarks[0].text).toBe("later bookmark");
    expect(storedDetails).toHaveLength(1);
    expect(storedDetails[0].fetchedAt).toBe(laterDetail.fetchedAt);
    expect(storedHighlights).toHaveLength(1);
    expect(storedHighlights[0].selectedText).toBe("later highlight");
    expect(storedProgress).toHaveLength(1);
    expect(storedProgress[0].scrollY).toBe(250);
  });

  it("skips malformed rows beyond the primary key", async () => {
    const validBookmark = makeBookmark("b1", "t1");
    const malformedBookmark = {
      ...makeBookmark("b2", "t2"),
      author: null,
    } as unknown as Bookmark;
    const validDetail = makeDetail("t1");
    const malformedDetail = {
      tweetId: "t2",
      fetchedAt: Date.now(),
      focalTweet: null,
    } as unknown as TweetDetailCache;
    const validHighlight = makeHighlight("h1", "t1");
    const malformedHighlight = {
      ...makeHighlight("h2", "t2"),
      startOffset: "0",
    } as unknown as Highlight;
    const validProgress = makeProgress("t1");
    const malformedProgress = {
      ...makeProgress("t2"),
      completed: "false",
    } as unknown as ReadingProgress;

    const zip = await buildValidZip([validBookmark, malformedBookmark], {
      details: [validDetail, malformedDetail],
      highlights: [validHighlight, malformedHighlight],
      readingProgress: [validProgress, malformedProgress],
    });
    const parsed = parseZip(zip);
    if (!parsed.ok) throw new Error("parse failed");
    const validated = await validateImport(parsed, "user123");
    if (!validated.ok) throw new Error("validation failed");

    const result = await runImport(validated);

    expect(result.bookmarks).toMatchObject({ status: "succeeded", added: 1, total: 1 });
    expect(result.details).toMatchObject({ status: "succeeded", added: 1, total: 1 });
    expect(result.highlights).toMatchObject({ status: "succeeded", added: 1, total: 1 });
    expect(result.readingProgress).toMatchObject({ status: "succeeded", added: 1, total: 1 });

    const [storedBookmarks, storedDetails, storedHighlights, storedProgress] =
      await Promise.all([
        getAllBookmarks(),
        getAllTweetDetails(),
        getAllHighlights(),
        getAllReadingProgress(),
      ]);

    expect(storedBookmarks).toHaveLength(1);
    expect(storedDetails).toHaveLength(1);
    expect(storedHighlights).toHaveLength(1);
    expect(storedProgress).toHaveLength(1);
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
