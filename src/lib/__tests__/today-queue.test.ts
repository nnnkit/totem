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
  selectStaleTodayQueueSnapshotKeys,
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
  const createdAt = daysAgo(days);
  return makeQueueExposure({
    tweetId,
    action: "queued",
    localDate: formatLocalDate(new Date(createdAt)),
    createdAt,
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

  it("counts repeated same-day queue exposures as a single exposure", () => {
    // Toggling the budget setting rebuilds the queue under a new key and
    // re-records "queued" the same day; that must not suppress the candidate.
    const result = buildTodayQueue(
      baseInput({
        bookmarks: [bookmark("requeued", daysAgo(7))],
        exposures: [
          queuedExposure("requeued", 0),
          queuedExposure("requeued", 0),
          queuedExposure("requeued", 0),
          queuedExposure("requeued", 0),
        ],
      }),
    );

    expect(result.tweetIds).toEqual(["requeued"]);
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

describe("balanced daily mix (v2)", () => {
  function article(tweetId: string, savedAt: number): Bookmark {
    return bookmark(tweetId, savedAt, {
      tweetKind: "article",
      article: { title: `Article ${tweetId}`, plainText: words(50) },
    });
  }

  it("orders mid-age (3–14d) saves by age rather than tie-break noise", () => {
    // Before v2 every save older than the ~3d fresh window got zero recency
    // score, so 4–13d posts were ordered purely by tie-break hash. The
    // continuous curve now ranks them strictly by age.
    const result = buildTodayQueue(
      baseInput({
        bookmarks: [
          bookmark("mid_13", daysAgo(13)),
          bookmark("mid_7", daysAgo(7)),
          bookmark("mid_4", daysAgo(4)),
          bookmark("mid_10", daysAgo(10)),
        ],
      }),
    );

    expect(result.tweetIds).toEqual(["mid_4", "mid_7", "mid_10", "mid_13"]);
  });

  it("surfaces a spread across fresh / mid-age / older bands when size permits", () => {
    const result = buildTodayQueue(
      baseInput({
        bookmarks: [
          bookmark("mid_b", daysAgo(8)),
          bookmark("fresh", daysAgo(1)),
          bookmark("older", daysAgo(30)),
          bookmark("mid_c", daysAgo(11)),
          bookmark("mid_a", daysAgo(5)),
        ],
      }),
    );

    // Fresh slot first, older slot second (structurally guaranteed), then the
    // mid-age fill ordered by age — one pick from each band.
    expect(result.tweetIds).toEqual([
      "fresh",
      "older",
      "mid_a",
      "mid_b",
      "mid_c",
    ]);
  });

  it("keeps the older-item (2–8 week) boost increasing with age", () => {
    const result = buildTodayQueue(
      baseInput({
        bookmarks: [
          bookmark("older_21", daysAgo(21)),
          bookmark("older_49", daysAgo(49)),
        ],
      }),
    );

    // The neglected branch is unchanged: revival weight climbs with age toward
    // the 8-week mark, so the 49d save outranks the 21d save.
    expect(result.tweetIds).toEqual(["older_49", "older_21"]);
  });

  it("self-heals a repeated author in the fill tail without touching priority slots or deliberate reads", () => {
    // Author "dup" appears twice: once as the in-progress pick (a deliberate
    // read in a priority slot) and once seated by the fill loop, which tolerates
    // the pair. Kinds are varied so no kind repeat confounds the author repair.
    const result = buildTodayQueue(
      baseInput({
        bookmarks: [
          bookmark("dup_inprogress", daysAgo(8), {
            author: {
              name: "Dup",
              screenName: "dup",
              profileImageUrl: "https://example.com/avatar.png",
              verified: false,
            },
          }),
          bookmark("dup_fill", daysAgo(4), {
            author: {
              name: "Dup",
              screenName: "dup",
              profileImageUrl: "https://example.com/avatar.png",
              verified: false,
            },
          }),
          article("article_b", daysAgo(5)),
          article("article_c", daysAgo(6)),
          bookmark("thread_d", daysAgo(7), { isThread: true }),
          bookmark("link_alt", daysAgo(9), { hasLink: true }),
        ],
        readingProgress: [progress("dup_inprogress")],
      }),
    );

    // The fill-tail "dup_fill" is swapped for the clean unpicked "link_alt"; the
    // in-progress "dup_inprogress" (same author) survives untouched at the front.
    expect(result.tweetIds).toEqual([
      "dup_inprogress",
      "link_alt",
      "article_b",
      "article_c",
      "thread_d",
    ]);
    expect(result.tweetIds).not.toContain("dup_fill");
  });

  it("leaves the set as-is when variety cannot be improved", () => {
    // Every candidate is the same kind, so evicting a fill-tail repeat finds no
    // non-repeating replacement — variety the library can't supply is not faked.
    const result = buildTodayQueue(
      baseInput({
        bookmarks: [
          bookmark("a", daysAgo(4)),
          bookmark("b", daysAgo(5)),
          bookmark("c", daysAgo(6)),
          bookmark("d", daysAgo(7)),
        ],
      }),
    );

    expect(result.tweetIds).toEqual(["a", "b", "c", "d"]);
  });

  it("fills to size on an all-fresh corpus", () => {
    const result = buildTodayQueue(
      baseInput({
        bookmarks: [
          bookmark("f1", NOW - 1 * 60 * 60 * 1000),
          bookmark("f2", NOW - 2 * 60 * 60 * 1000),
          bookmark("f3", NOW - 3 * 60 * 60 * 1000),
          bookmark("f4", NOW - 4 * 60 * 60 * 1000),
          bookmark("f5", NOW - 5 * 60 * 60 * 1000),
          bookmark("f6", NOW - 6 * 60 * 60 * 1000),
        ],
      }),
    );

    expect(result.tweetIds).toHaveLength(5);
  });

  it("degrades gracefully on a thin corpus", () => {
    const result = buildTodayQueue(
      baseInput({
        bookmarks: [bookmark("only_a", daysAgo(2)), bookmark("only_b", daysAgo(6))],
      }),
    );

    expect(result.tweetIds).toHaveLength(2);
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
      key: "2026-06-08:15:v2",
      localDate: LOCAL_DATE,
      budgetMinutes: 15,
      version: 2,
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
        key: "2026-06-08:15:v2",
        localDate: LOCAL_DATE,
        budgetMinutes: 15,
        generatedAt: NOW,
      }),
    ).toEqual<TodayQueueSnapshot>({
      key: "2026-06-08:15:v2",
      localDate: LOCAL_DATE,
      budgetMinutes: 15,
      version: 2,
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

  it("treats deleted bookmarks as handled so done stays reachable", () => {
    const snapshot: TodayQueueSnapshot = {
      key: "2026-06-08:15:v1",
      localDate: LOCAL_DATE,
      budgetMinutes: 15,
      version: 1,
      tweetIds: ["read", "deleted"],
      generatedAt: NOW,
    };
    const bookmarks = [bookmark("read", daysAgo(1))];
    const handledItems = deriveHandledTodayQueueItems({
      snapshot,
      bookmarks,
      readingProgress: [progress("read", true)],
      metadata: [],
      localDate: LOCAL_DATE,
    });
    const existingTweetIds = new Set(bookmarks.map((item) => item.tweetId));

    expect(isTodayQueueSnapshotDone({ snapshot, handledItems })).toBe(false);
    expect(
      isTodayQueueSnapshotDone({ snapshot, handledItems, existingTweetIds }),
    ).toBe(true);
  });
});

describe("selectStaleTodayQueueSnapshotKeys", () => {
  function record(key: string, version: number): TodayQueueSnapshot {
    return {
      key,
      localDate: LOCAL_DATE,
      budgetMinutes: 15,
      version,
      tweetIds: ["a"],
      generatedAt: NOW,
    };
  }

  it("returns only the keys whose version differs from the current version", () => {
    const records = [
      record("2026-06-08:15:v1", 1),
      record("2026-06-07:15:v2", 2),
      record("2026-06-08:30:v1", 1),
      record("2026-06-08:15:v2", 2),
    ];

    expect(selectStaleTodayQueueSnapshotKeys(records, 2)).toEqual([
      "2026-06-08:15:v1",
      "2026-06-08:30:v1",
    ]);
  });

  it("returns no keys when every record is the current version", () => {
    const records = [record("2026-06-08:15:v2", 2), record("2026-06-07:15:v2", 2)];

    expect(selectStaleTodayQueueSnapshotKeys(records, 2)).toEqual([]);
  });

  it("returns no keys for empty input", () => {
    expect(selectStaleTodayQueueSnapshotKeys([], 2)).toEqual([]);
  });
});
