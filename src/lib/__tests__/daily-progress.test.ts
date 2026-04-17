import { describe, it, expect } from "vitest";
import { computeDailyStats } from "../daily-progress";
import type { Bookmark, ReadLogEntry, ReadingProgress } from "../../types";

const TODAY = new Date("2026-04-17T14:00:00");
const TODAY_MS = TODAY.getTime();
const YESTERDAY_MS = TODAY_MS - 24 * 60 * 60 * 1000;

function makeReadEntry(
  bookmarkId: string,
  markedReadAt: number,
): ReadLogEntry {
  return { bookmarkId, markedReadAt };
}

function makeBookmark(
  overrides: Partial<Bookmark> = {},
): Bookmark {
  return {
    id: overrides.id ?? "bm-1",
    tweetId: overrides.tweetId ?? "t-1",
    text: "",
    createdAt: YESTERDAY_MS,
    author: {
      id: "a1",
      name: "Test",
      screenName: "test",
      profileImageUrl: "",
    },
    metrics: { retweets: 0, likes: 0, replies: 0, quotes: 0 },
    urls: [],
    ...overrides,
  } as Bookmark;
}

function makeProgress(
  tweetId: string,
  openedAt: number,
  lastReadAt: number,
): ReadingProgress {
  return { tweetId, openedAt, lastReadAt, scrollY: 0, scrollHeight: 1000, completed: false };
}

describe("computeDailyStats", () => {
  it("counts reads from today only", () => {
    const log = [
      makeReadEntry("a", TODAY_MS - 3600_000),
      makeReadEntry("b", TODAY_MS - 1800_000),
      makeReadEntry("c", YESTERDAY_MS),
    ];
    const stats = computeDailyStats(log, [], [], TODAY);
    expect(stats.readCount).toBe(2);
  });

  it("counts act_on filed today", () => {
    const bookmarks = [
      makeBookmark({ id: "1", intent: "act_on", intentAssignedAt: TODAY.toISOString() }),
      makeBookmark({ id: "2", intent: "act_on", intentAssignedAt: new Date(YESTERDAY_MS).toISOString() }),
      makeBookmark({ id: "3", intent: "reference", intentAssignedAt: TODAY.toISOString() }),
      makeBookmark({ id: "4", intent: "act_on" }),
    ];
    const stats = computeDailyStats([], bookmarks, [], TODAY);
    expect(stats.filedToActCount).toBe(1);
  });

  it("sums reading time from today sessions", () => {
    const progress = [
      makeProgress("t1", TODAY_MS - 600_000, TODAY_MS - 300_000),
      makeProgress("t2", TODAY_MS - 120_000, TODAY_MS - 60_000),
      makeProgress("t3", YESTERDAY_MS - 600_000, YESTERDAY_MS - 300_000),
    ];
    const stats = computeDailyStats([], [], progress, TODAY);
    expect(stats.timeMinutes).toBe(6);
  });

  it("returns zeros when empty", () => {
    const stats = computeDailyStats([], [], [], TODAY);
    expect(stats.readCount).toBe(0);
    expect(stats.filedToActCount).toBe(0);
    expect(stats.timeMinutes).toBe(0);
  });

  it("ignores progress entries with invalid timestamps", () => {
    const progress = [
      makeProgress("t1", 0, TODAY_MS),
      makeProgress("t2", TODAY_MS, TODAY_MS - 100),
    ];
    const stats = computeDailyStats([], [], progress, TODAY);
    expect(stats.timeMinutes).toBe(0);
  });
});
