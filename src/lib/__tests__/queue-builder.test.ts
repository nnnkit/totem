import { describe, expect, it } from "vitest";
import {
  buildQueue,
  toLocalDateKey,
  addDaysToDateKey,
} from "../queue-builder";
import type { Bookmark, DailyQueue } from "../../types";

function makeBookmark(
  overrides: Partial<Bookmark> & { id: string },
): Bookmark {
  return {
    tweetId: overrides.id,
    text: "test",
    createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
    sortIndex: "0",
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
    intent: "unsorted",
    ...overrides,
  };
}

function makeQueue(overrides: Partial<DailyQueue>): DailyQueue {
  return {
    date: "2026-04-16",
    bookmarkIds: [],
    completedIds: [],
    skippedIds: [],
    createdAt: Date.now(),
    ...overrides,
  };
}

describe("buildQueue", () => {
  it("returns empty queue when no bookmarks", () => {
    const result = buildQueue({
      bookmarks: [],
      yesterdayQueue: null,
      today: "2026-04-17",
      size: 5,
    });
    expect(result.bookmarkIds).toEqual([]);
  });

  it("picks act_on items before read_soon", () => {
    const bookmarks = [
      makeBookmark({ id: "rs-1", intent: "read_soon", createdAt: 1000 }),
      makeBookmark({ id: "ao-1", intent: "act_on", createdAt: 2000 }),
      makeBookmark({ id: "rs-2", intent: "read_soon", createdAt: 500 }),
    ];
    const result = buildQueue({
      bookmarks,
      yesterdayQueue: null,
      today: "2026-04-17",
      size: 5,
    });
    expect(result.bookmarkIds[0]).toBe("ao-1");
  });

  it("carries over yesterday skipped items first", () => {
    const bookmarks = [
      makeBookmark({ id: "sk-1", intent: "read_soon", createdAt: 1000 }),
      makeBookmark({ id: "ao-1", intent: "act_on", createdAt: 2000 }),
    ];
    const yesterday = makeQueue({
      date: "2026-04-16",
      skippedIds: ["sk-1"],
    });
    const result = buildQueue({
      bookmarks,
      yesterdayQueue: yesterday,
      today: "2026-04-17",
      size: 5,
    });
    expect(result.bookmarkIds[0]).toBe("sk-1");
    expect(result.bookmarkIds[1]).toBe("ao-1");
  });

  it("excludes items in cooldown", () => {
    const tomorrow = new Date("2026-04-18T00:00:00").toISOString();
    const bookmarks = [
      makeBookmark({
        id: "cd-1",
        intent: "read_soon",
        cooldownUntil: tomorrow,
        createdAt: 1000,
      }),
      makeBookmark({ id: "ok-1", intent: "read_soon", createdAt: 2000 }),
    ];
    const result = buildQueue({
      bookmarks,
      yesterdayQueue: null,
      today: "2026-04-17",
      size: 5,
    });
    expect(result.bookmarkIds).toEqual(["ok-1"]);
  });

  it("excludes skipped items with skipCount >= 3 (non-manual)", () => {
    const bookmarks = [
      makeBookmark({
        id: "sk3-1",
        intent: "read_soon",
        skipCount: 3,
        intentSource: "structural",
        createdAt: 1000,
      }),
    ];
    const yesterday = makeQueue({ skippedIds: ["sk3-1"] });
    const result = buildQueue({
      bookmarks,
      yesterdayQueue: yesterday,
      today: "2026-04-17",
      size: 5,
    });
    expect(result.bookmarkIds).not.toContain("sk3-1");
  });

  it("keeps manual-intent items even with skipCount >= 3", () => {
    const bookmarks = [
      makeBookmark({
        id: "m-1",
        intent: "read_soon",
        skipCount: 3,
        intentSource: "manual",
        createdAt: 1000,
      }),
    ];
    const yesterday = makeQueue({ skippedIds: ["m-1"] });
    const result = buildQueue({
      bookmarks,
      yesterdayQueue: yesterday,
      today: "2026-04-17",
      size: 5,
    });
    expect(result.bookmarkIds).toContain("m-1");
  });

  it("truncates to size", () => {
    const bookmarks = Array.from({ length: 10 }, (_, i) =>
      makeBookmark({
        id: `b-${i}`,
        intent: "read_soon",
        createdAt: i * 1000,
      }),
    );
    const result = buildQueue({
      bookmarks,
      yesterdayQueue: null,
      today: "2026-04-17",
      size: 3,
    });
    expect(result.bookmarkIds).toHaveLength(3);
  });

  it("picks oldest read_soon first, then recent for variety", () => {
    const now = new Date("2026-04-17T12:00:00").getTime();
    const bookmarks = [
      makeBookmark({ id: "old-1", intent: "read_soon", createdAt: 1000 }),
      makeBookmark({ id: "old-2", intent: "read_soon", createdAt: 2000 }),
      makeBookmark({ id: "old-3", intent: "read_soon", createdAt: 3000 }),
      makeBookmark({
        id: "new-1",
        intent: "read_soon",
        createdAt: now - 2 * 24 * 60 * 60 * 1000,
      }),
      makeBookmark({
        id: "new-2",
        intent: "read_soon",
        createdAt: now - 1 * 24 * 60 * 60 * 1000,
      }),
    ];
    const result = buildQueue({
      bookmarks,
      yesterdayQueue: null,
      today: "2026-04-17",
      size: 5,
    });
    expect(result.bookmarkIds.slice(0, 3)).toEqual([
      "old-1",
      "old-2",
      "old-3",
    ]);
  });

  it("ignores reference and unsorted bookmarks", () => {
    const bookmarks = [
      makeBookmark({ id: "ref-1", intent: "reference", createdAt: 1000 }),
      makeBookmark({ id: "uns-1", intent: "unsorted", createdAt: 2000 }),
      makeBookmark({ id: "rs-1", intent: "read_soon", createdAt: 3000 }),
    ];
    const result = buildQueue({
      bookmarks,
      yesterdayQueue: null,
      today: "2026-04-17",
      size: 5,
    });
    expect(result.bookmarkIds).toEqual(["rs-1"]);
  });

  it("does not duplicate carry-over items", () => {
    const bookmarks = [
      makeBookmark({ id: "sk-1", intent: "act_on", createdAt: 1000 }),
    ];
    const yesterday = makeQueue({ skippedIds: ["sk-1"] });
    const result = buildQueue({
      bookmarks,
      yesterdayQueue: yesterday,
      today: "2026-04-17",
      size: 5,
    });
    const occurrences = result.bookmarkIds.filter(
      (id) => id === "sk-1",
    ).length;
    expect(occurrences).toBe(1);
  });

  it("initializes with empty completedIds and skippedIds", () => {
    const bookmarks = [
      makeBookmark({ id: "b-1", intent: "read_soon", createdAt: 1000 }),
    ];
    const result = buildQueue({
      bookmarks,
      yesterdayQueue: null,
      today: "2026-04-17",
      size: 5,
    });
    expect(result.completedIds).toEqual([]);
    expect(result.skippedIds).toEqual([]);
  });
});

describe("toLocalDateKey", () => {
  it("formats date as YYYY-MM-DD", () => {
    expect(toLocalDateKey(new Date(2026, 3, 17))).toBe("2026-04-17");
  });

  it("zero-pads month and day", () => {
    expect(toLocalDateKey(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("addDaysToDateKey", () => {
  it("adds days correctly", () => {
    expect(addDaysToDateKey("2026-04-17", 1)).toBe("2026-04-18");
  });

  it("subtracts days correctly", () => {
    expect(addDaysToDateKey("2026-04-17", -1)).toBe("2026-04-16");
  });

  it("handles month boundaries", () => {
    expect(addDaysToDateKey("2026-04-30", 1)).toBe("2026-05-01");
  });
});
