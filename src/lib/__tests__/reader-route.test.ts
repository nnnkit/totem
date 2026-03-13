import { describe, expect, it } from "vitest";
import { resolveReaderRouteBookmarks } from "../reader-route";
import type { Bookmark } from "../../types";

function makeBookmark(tweetId: string): Bookmark {
  return {
    id: `bookmark-${tweetId}`,
    tweetId,
    text: `Post ${tweetId}`,
    createdAt: 1_700_000_000_000,
    sortIndex: tweetId,
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

describe("resolveReaderRouteBookmarks", () => {
  it("keeps prev and next inside the readable bookmark set", () => {
    const allBookmarks = ["1", "2", "3", "4"].map(makeBookmark);
    const readableBookmarks = ["1", "3", "4"].map(makeBookmark);

    expect(
      resolveReaderRouteBookmarks("3", readableBookmarks, allBookmarks),
    ).toMatchObject({
      localBookmark: { tweetId: "3" },
      hiddenBookmark: null,
      prevBookmark: { tweetId: "1" },
      nextBookmark: { tweetId: "4" },
    });
  });

  it("treats non-readable local bookmarks as hidden", () => {
    const allBookmarks = ["1", "2", "3"].map(makeBookmark);
    const readableBookmarks = ["1", "3"].map(makeBookmark);

    expect(
      resolveReaderRouteBookmarks("2", readableBookmarks, allBookmarks),
    ).toMatchObject({
      localBookmark: null,
      hiddenBookmark: { tweetId: "2" },
      prevBookmark: null,
      nextBookmark: null,
    });
  });
});
