import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_READING_SORT_PREFERENCES,
  readStoredReadingSortPreferences,
  sortContinueReadingItems,
  sortUnreadBookmarks,
  writeStoredReadingSortPreferences,
} from "../reading-list";
import { LS_READING_SORTS } from "../storage-keys";
import type { Bookmark } from "../../types";
import type { ContinueReadingItem } from "../../hooks/useContinueReading";

const SNOWFLAKE_EPOCH = 1288834974657n;

function createLocalStorageMock(seed: Record<string, string> = {}) {
  const storage = new Map(Object.entries(seed));
  return {
    getItem: vi.fn((key: string) => storage.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      storage.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      storage.delete(key);
    }),
    clear: vi.fn(() => {
      storage.clear();
    }),
  };
}

function makeSortIndex(timestamp: number): string {
  return String((BigInt(timestamp) - SNOWFLAKE_EPOCH) << 22n);
}

function makeBookmark(tweetId: string, timestamp: number): Bookmark {
  return {
    id: `bookmark-${tweetId}`,
    tweetId,
    text: `Post ${tweetId}`,
    createdAt: timestamp,
    sortIndex: makeSortIndex(timestamp),
    bookmarked: true,
    author: {
      name: "Author",
      screenName: "author",
      profileImageUrl: "https://example.com/avatar.png",
      verified: false,
    },
    metrics: {
      likes: 0,
      retweets: 0,
      replies: 0,
      views: 0,
      bookmarks: 0,
    },
    media: [],
    urls: [],
    isThread: false,
    hasImage: false,
    hasVideo: false,
    hasLink: false,
    quotedTweet: null,
  };
}

function makeContinueReadingItem(
  tweetId: string,
  openedAt: number,
  lastReadAt: number,
): ContinueReadingItem {
  return {
    bookmark: makeBookmark(tweetId, openedAt),
    progress: {
      tweetId,
      openedAt,
      lastReadAt,
      scrollY: 0,
      scrollHeight: 0,
      completed: false,
    },
  };
}

beforeEach(() => {
  vi.stubGlobal("localStorage", createLocalStorageMock());
});

describe("reading-list storage", () => {
  it("uses defaults when nothing is stored", () => {
    expect(readStoredReadingSortPreferences()).toEqual(
      DEFAULT_READING_SORT_PREFERENCES,
    );
  });

  it("normalizes invalid stored values", () => {
    vi.stubGlobal("localStorage", createLocalStorageMock({
      [LS_READING_SORTS]: JSON.stringify({
        unread: "oldest",
        continue: "broken",
      }),
    }));

    expect(readStoredReadingSortPreferences()).toEqual({
      unread: "oldest",
      continue: "recent",
      read: "recent",
    });
  });

  it("persists per-tab sort preferences", () => {
    writeStoredReadingSortPreferences({
      unread: "oldest",
      continue: "annotated",
      read: "recent",
    });

    expect(localStorage.getItem(LS_READING_SORTS)).toBe(
      JSON.stringify({
        unread: "oldest",
        continue: "annotated",
        read: "recent",
      }),
    );
  });
});

describe("reading-list sorting", () => {
  it("sorts unread bookmarks by recency direction", () => {
    const older = makeBookmark("1", 1_700_000_000_000);
    const newer = makeBookmark("2", 1_700_000_100_000);

    expect(sortUnreadBookmarks([older, newer], "recent").map((item) => item.tweetId)).toEqual([
      "2",
      "1",
    ]);
    expect(sortUnreadBookmarks([older, newer], "oldest").map((item) => item.tweetId)).toEqual([
      "1",
      "2",
    ]);
  });

  it("sorts reading items by annotation totals with recent tie-breaks", () => {
    const items = [
      makeContinueReadingItem("1", 1_700_000_000_000, 1_700_000_010_000),
      makeContinueReadingItem("2", 1_700_000_020_000, 1_700_000_030_000),
      makeContinueReadingItem("3", 1_700_000_040_000, 1_700_000_050_000),
    ];
    const counts = new Map([
      ["1", { highlights: 1, notes: 0 }],
      ["2", { highlights: 1, notes: 2 }],
      ["3", { highlights: 2, notes: 1 }],
    ]);

    expect(
      sortContinueReadingItems(items, "annotated", counts).map(
        (item) => item.bookmark.tweetId,
      ),
    ).toEqual(["3", "2", "1"]);
  });
});
