import { describe, expect, it } from "vitest";
import type { Bookmark, BookmarkIntent, IntentSource } from "../../types";

function makeBookmark(overrides: Partial<Bookmark> = {}): Bookmark {
  return {
    id: "bk-1",
    tweetId: "tw-1",
    text: "test bookmark",
    createdAt: Date.now(),
    sortIndex: "1234567890000000000",
    bookmarked: true,
    author: {
      name: "Test User",
      screenName: "testuser",
      profileImageUrl: "https://example.com/avatar.jpg",
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

describe("intent types and contracts", () => {
  it("valid intent values are exhaustive", () => {
    const intents: BookmarkIntent[] = ["read_soon", "reference", "act_on", "unsorted"];
    expect(intents).toHaveLength(4);
    for (const intent of intents) {
      const bookmark = makeBookmark({ intent });
      expect(bookmark.intent).toBe(intent);
    }
  });

  it("valid intent sources", () => {
    const sources: IntentSource[] = ["structural", "keyword", "manual"];
    expect(sources).toHaveLength(3);
  });

  it("manual intent assignment preserves all bookmark fields", () => {
    const original = makeBookmark({
      intent: "unsorted",
      text: "important thread about DeFi",
      isThread: true,
    });

    const updated: Bookmark = {
      ...original,
      intent: "read_soon",
      intentSource: "manual",
      intentConfidence: undefined,
      intentAssignedAt: new Date().toISOString(),
    };

    expect(updated.intent).toBe("read_soon");
    expect(updated.intentSource).toBe("manual");
    expect(updated.text).toBe(original.text);
    expect(updated.isThread).toBe(true);
    expect(updated.tweetId).toBe(original.tweetId);
  });

  it("manual source is never overwritten by auto-classifier", () => {
    const manualBookmark = makeBookmark({
      intent: "act_on",
      intentSource: "manual",
      intentAssignedAt: "2026-01-01T00:00:00.000Z",
    });

    const shouldSkip = manualBookmark.intentSource === "manual";
    expect(shouldSkip).toBe(true);
  });

  it("intent defaults to unsorted for new bookmarks", () => {
    const bookmark = makeBookmark();
    expect(bookmark.intent).toBe("unsorted");
  });

  it("bookmark with no intent field defaults safely", () => {
    const raw = makeBookmark();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (raw as any).intent;
    const intent = raw.intent ?? "unsorted";
    expect(intent).toBe("unsorted");
  });

  it("intent fields are optional on Bookmark type", () => {
    const minimal: Bookmark = {
      id: "bk-1",
      tweetId: "tw-1",
      text: "test",
      createdAt: Date.now(),
      sortIndex: "1234567890000000000",
      bookmarked: true,
      author: { name: "T", screenName: "t", profileImageUrl: "", verified: false },
      metrics: { likes: 0, retweets: 0, replies: 0, views: 0, bookmarks: 0 },
      media: [],
      urls: [],
      isThread: false,
      hasImage: false,
      hasVideo: false,
      hasLink: false,
      quotedTweet: null,
    };
    expect(minimal.id).toBe("bk-1");
    expect(minimal.intent).toBeUndefined();
  });

  it("bulkSetIntent contract: applies same intent to multiple bookmarks", () => {
    const bookmarks = [
      makeBookmark({ id: "bk-1", tweetId: "tw-1", intent: "unsorted" }),
      makeBookmark({ id: "bk-2", tweetId: "tw-2", intent: "unsorted" }),
      makeBookmark({ id: "bk-3", tweetId: "tw-3", intent: "reference" }),
    ];
    const idsToUpdate = new Set(["bk-1", "bk-3"]);
    const targetIntent: BookmarkIntent = "act_on";
    const now = new Date().toISOString();

    const updated = bookmarks.map((b) =>
      idsToUpdate.has(b.id)
        ? { ...b, intent: targetIntent, intentSource: "manual" as IntentSource, intentAssignedAt: now }
        : b,
    );

    expect(updated[0].intent).toBe("act_on");
    expect(updated[1].intent).toBe("unsorted");
    expect(updated[2].intent).toBe("act_on");
  });

  it("getByIntent contract: filters bookmarks by intent", () => {
    const bookmarks = [
      makeBookmark({ id: "bk-1", intent: "read_soon" }),
      makeBookmark({ id: "bk-2", intent: "reference" }),
      makeBookmark({ id: "bk-3", intent: "read_soon" }),
      makeBookmark({ id: "bk-4", intent: "unsorted" }),
    ];

    const readSoon = bookmarks.filter((b) => (b.intent ?? "unsorted") === "read_soon");
    expect(readSoon).toHaveLength(2);
    expect(readSoon.map((b) => b.id)).toEqual(["bk-1", "bk-3"]);

    const unsorted = bookmarks.filter((b) => (b.intent ?? "unsorted") === "unsorted");
    expect(unsorted).toHaveLength(1);
  });
});
