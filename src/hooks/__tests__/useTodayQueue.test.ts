import { describe, expect, it } from "vitest";
import type { Bookmark, ReadingProgress, TodayQueueSnapshot } from "../../types";
import { deriveHandledTodayQueueItems } from "../../lib/today-queue";
import { computeTodayQueueStats } from "../useTodayQueue";

const LOCAL_DATE = "2026-06-08";
const NOW = new Date("2026-06-08T12:00:00").getTime();

function bookmark(tweetId: string): Bookmark {
  return {
    id: `bookmark-${tweetId}`,
    tweetId,
    text: `Post ${tweetId}`,
    createdAt: NOW,
    sortIndex: tweetId,
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
  };
}

function progress(tweetId: string, completed = false): ReadingProgress {
  return {
    tweetId,
    openedAt: NOW,
    lastReadAt: NOW,
    scrollY: 100,
    scrollHeight: 1000,
    completed,
  };
}

function snapshot(tweetIds: string[]): TodayQueueSnapshot {
  return {
    key: `${LOCAL_DATE}:15:v2`,
    localDate: LOCAL_DATE,
    budgetMinutes: 15,
    version: 2,
    tweetIds,
    generatedAt: NOW,
  };
}

describe("computeTodayQueueStats", () => {
  it("counts deleted snapshot entries as handled", () => {
    const bookmarks = [bookmark("read")];
    const handledItems = deriveHandledTodayQueueItems({
      snapshot: snapshot(["read", "deleted"]),
      bookmarks,
      readingProgress: [progress("read", true)],
      metadata: [],
      localDate: LOCAL_DATE,
    });

    expect(
      computeTodayQueueStats({
        snapshot: snapshot(["read", "deleted"]),
        handledItems,
        existingTweetIds: new Set(bookmarks.map((item) => item.tweetId)),
      }),
    ).toEqual({
      totalCount: 2,
      handledCount: 2,
      completedCount: 1,
    });
  });

  it("counts offline-hidden handled items against full snapshot progress", () => {
    const currentSnapshot = snapshot(["cached", "uncached"]);
    const bookmarks = [bookmark("cached"), bookmark("uncached")];
    const readingProgress = [progress("cached", true), progress("uncached", true)];
    const visibleHandledItems = deriveHandledTodayQueueItems({
      snapshot: currentSnapshot,
      bookmarks,
      readingProgress,
      metadata: [],
      detailedTweetIds: new Set(["cached"]),
      restrictToCachedDetails: true,
      localDate: LOCAL_DATE,
    });
    const completionHandledItems = deriveHandledTodayQueueItems({
      snapshot: currentSnapshot,
      bookmarks,
      readingProgress,
      metadata: [],
      restrictToCachedDetails: false,
      localDate: LOCAL_DATE,
    });

    expect(visibleHandledItems).toHaveLength(1);
    expect(
      computeTodayQueueStats({
        snapshot: currentSnapshot,
        handledItems: completionHandledItems,
        existingTweetIds: new Set(bookmarks.map((item) => item.tweetId)),
      }),
    ).toEqual({
      totalCount: 2,
      handledCount: 2,
      completedCount: 2,
    });
  });
});
