import { describe, expect, it } from "vitest";
import type {
  Bookmark,
  BookmarkQueueMetadata,
  ReadingProgress,
  TodayQueueExposure,
  TodayQueueSnapshot,
} from "../../types";
import {
  addTweetIdToTodayQueueSnapshot,
  buildTodayQueue,
  deriveActiveTodayQueueItems,
  deriveHandledTodayQueueItems,
  formatLocalDate,
  isTodayQueueSnapshotDone,
  makeQueueExposure,
  makeTodayQueueKey,
  shouldPersistTodayQueueSnapshot,
  toTodayQueueSnapshot,
} from "../today-queue";

const SNOWFLAKE_EPOCH = 1288834974657n;
const NOW = new Date("2026-06-08T12:00:00").getTime();
const LOCAL_DATE = "2026-06-08";

function makeSortIndex(timestamp: number): string {
  return String((BigInt(timestamp) - SNOWFLAKE_EPOCH) << 22n);
}

function daysAgo(days: number): number {
  return NOW - days * 24 * 60 * 60 * 1000;
}

function words(count: number): string {
  return Array.from({ length: count }, (_, index) => `word${index}`).join(" ");
}

function bookmark(
  tweetId: string,
  savedAt: number,
  overrides: Partial<Bookmark> = {},
): Bookmark {
  return {
    id: `bookmark-${tweetId}`,
    tweetId,
    text: `Post ${tweetId}`,
    createdAt: savedAt,
    sortIndex: makeSortIndex(savedAt),
    bookmarked: true,
    author: {
      name: `Author ${tweetId}`,
      screenName: `author_${tweetId}`,
      profileImageUrl: "https://example.com/avatar.png",
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
    ...overrides,
  };
}

function progress(tweetId: string, completed = false): ReadingProgress {
  return {
    tweetId,
    openedAt: daysAgo(2),
    lastReadAt: daysAgo(1),
    scrollY: 100,
    scrollHeight: 1000,
    completed,
  };
}

function metadata(
  tweetId: string,
  patch: Partial<BookmarkQueueMetadata>,
): BookmarkQueueMetadata {
  return {
    tweetId,
    intent: "unset",
    snoozedUntil: null,
    updatedAt: NOW,
    ...patch,
  };
}

function queuedExposure(tweetId: string, days: number): TodayQueueExposure {
  return makeQueueExposure({
    tweetId,
    action: "queued",
    localDate: LOCAL_DATE,
    createdAt: daysAgo(days),
  });
}

function baseInput(overrides = {}) {
  return {
    accountId: "account-1",
    localDate: LOCAL_DATE,
    budgetMinutes: 15 as const,
    now: NOW,
    bookmarks: [],
    readingProgress: [],
    metadata: [],
    exposures: [],
    pinnedTweetIds: [],
    ...overrides,
  };
}

describe("today queue generation", () => {
  it("uses a stable key for the same date, budget, and version", () => {
    expect(
      makeTodayQueueKey({
        localDate: LOCAL_DATE,
        budgetMinutes: 15,
        version: 1,
      }),
    ).toBe("2026-06-08:15:v1");
    expect(formatLocalDate(new Date("2026-06-08T23:59:00"))).toBe(LOCAL_DATE);
  });

  it("picks deterministic daily composition slots", () => {
    const result = buildTodayQueue(
      baseInput({
        bookmarks: [
          bookmark("wildcard", daysAgo(7)),
          bookmark("neglected", daysAgo(40)),
          bookmark("pinned", daysAgo(10)),
          bookmark("recent", NOW - 60 * 60 * 1000),
          bookmark("progress", daysAgo(8)),
        ],
        readingProgress: [progress("progress")],
        pinnedTweetIds: ["pinned"],
      }),
    );

    expect(result.tweetIds).toEqual([
      "progress",
      "recent",
      "pinned",
      "neglected",
      "wildcard",
    ]);
    expect(buildTodayQueue(baseInput({ ...result, bookmarks: [] })).key).toBe(
      result.key,
    );
  });

  it("suppresses completed, snoozed, reference, act, uncached, and overexposed candidates", () => {
    const result = buildTodayQueue(
      baseInput({
        bookmarks: [
          bookmark("available", daysAgo(2)),
          bookmark("completed", daysAgo(1)),
          bookmark("snoozed", daysAgo(3)),
          bookmark("reference", daysAgo(4)),
          bookmark("act", daysAgo(5)),
          bookmark("uncached", daysAgo(6)),
          bookmark("overexposed", daysAgo(7)),
        ],
        readingProgress: [progress("completed", true)],
        metadata: [
          metadata("snoozed", { snoozedUntil: "2026-06-09" }),
          metadata("reference", { intent: "reference" }),
          metadata("act", { intent: "act" }),
        ],
        exposures: [
          queuedExposure("overexposed", 1),
          queuedExposure("overexposed", 2),
          queuedExposure("overexposed", 3),
        ],
        detailedTweetIds: new Set(["available", "completed", "snoozed", "reference", "act", "overexposed"]),
        restrictToCachedDetails: true,
      }),
    );

    expect(result.tweetIds).toEqual(["available"]);
  });

  it("keeps recently engaged candidates eligible even after repeated queue exposure", () => {
    const result = buildTodayQueue(
      baseInput({
        bookmarks: [bookmark("engaged", daysAgo(7))],
        exposures: [
          queuedExposure("engaged", 1),
          queuedExposure("engaged", 2),
          queuedExposure("engaged", 3),
          makeQueueExposure({
            tweetId: "engaged",
            action: "opened",
            localDate: LOCAL_DATE,
            createdAt: daysAgo(1),
          }),
        ],
      }),
    );

    expect(result.tweetIds).toEqual(["engaged"]);
  });

  it("prefers candidates that fit the configured reading budget", () => {
    const short = bookmark("short", daysAgo(1), { text: words(200) });
    const long = bookmark("long", daysAgo(1), {
      article: {
        title: "Long article",
        plainText: words(4000),
      },
      tweetKind: "article",
    });

    const result = buildTodayQueue(
      baseInput({
        budgetMinutes: 5,
        bookmarks: [long, short],
      }),
    );

    expect(result.tweetIds[0]).toBe("short");
  });
});

describe("today queue snapshots", () => {
  it("does not persist empty generated snapshots", () => {
    const result = buildTodayQueue(
      baseInput({
        bookmarks: [bookmark("uncached", daysAgo(1))],
        detailedTweetIds: new Set(),
        restrictToCachedDetails: true,
      }),
    );
    const snapshot = toTodayQueueSnapshot(result);

    expect(snapshot.tweetIds).toEqual([]);
    expect(shouldPersistTodayQueueSnapshot(snapshot)).toBe(false);
  });

  it("converts generation output to a persisted snapshot", () => {
    const result = buildTodayQueue(
      baseInput({ bookmarks: [bookmark("1", daysAgo(1))] }),
    );

    expect(toTodayQueueSnapshot(result)).toEqual<TodayQueueSnapshot>({
      key: "2026-06-08:15:v1",
      localDate: LOCAL_DATE,
      budgetMinutes: 15,
      version: 1,
      tweetIds: ["1"],
      generatedAt: NOW,
    });
  });

  it("adds a manually selected post to the front of a snapshot", () => {
    const snapshot: TodayQueueSnapshot = {
      key: "2026-06-08:15:v1",
      localDate: LOCAL_DATE,
      budgetMinutes: 15,
      version: 1,
      tweetIds: ["first", "second", "third"],
      generatedAt: NOW,
    };

    expect(
      addTweetIdToTodayQueueSnapshot({
        snapshot,
        tweetId: "second",
        key: snapshot.key,
        localDate: LOCAL_DATE,
        budgetMinutes: 15,
        generatedAt: NOW + 1,
      }),
    ).toEqual<TodayQueueSnapshot>({
      ...snapshot,
      tweetIds: ["second", "first", "third"],
    });
  });

  it("creates a snapshot when a manually selected post is the first today item", () => {
    expect(
      addTweetIdToTodayQueueSnapshot({
        snapshot: null,
        tweetId: "manual",
        key: "2026-06-08:15:v1",
        localDate: LOCAL_DATE,
        budgetMinutes: 15,
        generatedAt: NOW,
      }),
    ).toEqual<TodayQueueSnapshot>({
      key: "2026-06-08:15:v1",
      localDate: LOCAL_DATE,
      budgetMinutes: 15,
      version: 1,
      tweetIds: ["manual"],
      generatedAt: NOW,
    });
  });

  it("derives currently actionable items from a stable snapshot", () => {
    const snapshot: TodayQueueSnapshot = {
      key: "2026-06-08:15:v1",
      localDate: LOCAL_DATE,
      budgetMinutes: 15,
      version: 1,
      tweetIds: ["available", "completed", "reference", "snoozed", "missing"],
      generatedAt: NOW,
    };

    const items = deriveActiveTodayQueueItems({
      snapshot,
      bookmarks: [
        bookmark("available", daysAgo(1)),
        bookmark("completed", daysAgo(2)),
        bookmark("reference", daysAgo(3)),
        bookmark("snoozed", daysAgo(4)),
      ],
      readingProgress: [progress("completed", true)],
      metadata: [
        metadata("reference", { intent: "reference" }),
        metadata("snoozed", { snoozedUntil: "2026-06-09" }),
      ],
      localDate: LOCAL_DATE,
    });

    expect(items.map((item) => item.bookmark.tweetId)).toEqual(["available"]);
  });

  it("derives handled activity from a stable snapshot", () => {
    const snapshot: TodayQueueSnapshot = {
      key: "2026-06-08:15:v1",
      localDate: LOCAL_DATE,
      budgetMinutes: 15,
      version: 1,
      tweetIds: ["read", "snoozed", "archived", "action", "active"],
      generatedAt: NOW,
    };

    const items = deriveHandledTodayQueueItems({
      snapshot,
      bookmarks: [
        bookmark("read", daysAgo(1)),
        bookmark("snoozed", daysAgo(2)),
        bookmark("archived", daysAgo(3)),
        bookmark("action", daysAgo(4)),
        bookmark("active", daysAgo(5)),
      ],
      readingProgress: [progress("read", true)],
      metadata: [
        metadata("snoozed", { snoozedUntil: "2026-06-09" }),
        metadata("archived", { intent: "reference" }),
        metadata("action", { intent: "act" }),
      ],
      localDate: LOCAL_DATE,
    });

    expect(
      items.map((item) => [item.bookmark.tweetId, item.reason]),
    ).toEqual([
      ["read", "read"],
      ["snoozed", "snoozed"],
      ["archived", "archived"],
      ["action", "action"],
    ]);
  });

  it("does not treat hidden uncached snapshot items as complete", () => {
    const snapshot: TodayQueueSnapshot = {
      key: "2026-06-08:15:v1",
      localDate: LOCAL_DATE,
      budgetMinutes: 15,
      version: 1,
      tweetIds: ["hidden"],
      generatedAt: NOW,
    };
    const bookmarks = [bookmark("hidden", daysAgo(1))];
    const visibleItems = deriveActiveTodayQueueItems({
      snapshot,
      bookmarks,
      readingProgress: [],
      metadata: [],
      detailedTweetIds: new Set(),
      restrictToCachedDetails: true,
      localDate: LOCAL_DATE,
    });
    const handledItems = deriveHandledTodayQueueItems({
      snapshot,
      bookmarks,
      readingProgress: [],
      metadata: [],
      detailedTweetIds: new Set(),
      restrictToCachedDetails: false,
      localDate: LOCAL_DATE,
    });

    expect(visibleItems).toEqual([]);
    expect(isTodayQueueSnapshotDone({ snapshot, handledItems })).toBe(false);
  });

  it("marks a snapshot complete only when every queued item is handled", () => {
    const snapshot: TodayQueueSnapshot = {
      key: "2026-06-08:15:v1",
      localDate: LOCAL_DATE,
      budgetMinutes: 15,
      version: 1,
      tweetIds: ["read", "action"],
      generatedAt: NOW,
    };
    const handledItems = deriveHandledTodayQueueItems({
      snapshot,
      bookmarks: [
        bookmark("read", daysAgo(1)),
        bookmark("action", daysAgo(2)),
      ],
      readingProgress: [progress("read", true)],
      metadata: [metadata("action", { intent: "act" })],
      detailedTweetIds: new Set(),
      restrictToCachedDetails: false,
      localDate: LOCAL_DATE,
    });

    expect(isTodayQueueSnapshotDone({ snapshot, handledItems })).toBe(true);
  });
});
