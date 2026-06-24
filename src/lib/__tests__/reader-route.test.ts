import { describe, expect, it } from "vitest";
import {
  resolveReaderRouteBookmarks,
  selectReaderDisplayBookmark,
  shouldFetchExternalDetail,
} from "../reader-route";
import type { Bookmark } from "../../types";

function makeBookmark(
  tweetId: string,
  overrides: Partial<Bookmark> = {},
): Bookmark {
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
    ...overrides,
  };
}

describe("resolveReaderRouteBookmarks", () => {
  it("keeps prev and next inside the readable bookmark set", () => {
    const allBookmarks = ["1", "2", "3", "4"].map((id) => makeBookmark(id));
    const readableBookmarks = ["1", "3", "4"].map((id) => makeBookmark(id));

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
    const allBookmarks = ["1", "2", "3"].map((id) => makeBookmark(id));
    const readableBookmarks = ["1", "3"].map((id) => makeBookmark(id));

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

describe("shouldFetchExternalDetail", () => {
  it("fetches when a tweetId has no local or hidden bookmark", () => {
    expect(
      shouldFetchExternalDetail({
        tweetId: "1",
        localBookmark: null,
        hiddenBookmark: null,
      }),
    ).toBe(true);
  });

  it("stays idle without a tweetId", () => {
    expect(
      shouldFetchExternalDetail({
        tweetId: null,
        localBookmark: null,
        hiddenBookmark: null,
      }),
    ).toBe(false);
  });

  it("does not fetch when a local or hidden bookmark already exists", () => {
    expect(
      shouldFetchExternalDetail({
        tweetId: "1",
        localBookmark: makeBookmark("1"),
        hiddenBookmark: null,
      }),
    ).toBe(false);
    expect(
      shouldFetchExternalDetail({
        tweetId: "1",
        localBookmark: null,
        hiddenBookmark: makeBookmark("1"),
      }),
    ).toBe(false);
  });

  it("ignores the bookmarked flag — un-bookmarking a local row never retriggers a fetch", () => {
    const base = { tweetId: "1", hiddenBookmark: null } as const;
    const bookmarked = shouldFetchExternalDetail({
      ...base,
      localBookmark: makeBookmark("1", { bookmarked: true }),
    });
    const unbookmarked = shouldFetchExternalDetail({
      ...base,
      localBookmark: makeBookmark("1", { bookmarked: false }),
    });
    expect(bookmarked).toBe(false);
    expect(unbookmarked).toBe(false);
    expect(unbookmarked).toBe(bookmarked);
  });
});

describe("selectReaderDisplayBookmark", () => {
  const external = (tweetId: string, overrides: Partial<Bookmark> = {}) => ({
    tweetId,
    focalTweet: makeBookmark(tweetId, overrides),
  });

  it("prefers the live local row over snapshot and external", () => {
    const result = selectReaderDisplayBookmark({
      localBookmark: makeBookmark("1", { text: "local" }),
      localBookmarkSnapshot: makeBookmark("1", { text: "snapshot" }),
      externalDetail: external("1", { text: "external" }),
      externalUnbookmarkedTweetId: null,
    });
    expect(result?.text).toBe("local");
  });

  it("falls back to the snapshot when there is no live local row", () => {
    const result = selectReaderDisplayBookmark({
      localBookmark: null,
      localBookmarkSnapshot: makeBookmark("1", { text: "snapshot" }),
      externalDetail: external("1", { text: "external" }),
      externalUnbookmarkedTweetId: null,
    });
    expect(result?.text).toBe("snapshot");
  });

  it("uses external detail when no local row or snapshot exists", () => {
    const detail = external("1");
    const result = selectReaderDisplayBookmark({
      localBookmark: null,
      localBookmarkSnapshot: null,
      externalDetail: detail,
      externalUnbookmarkedTweetId: null,
    });
    expect(result).toBe(detail.focalTweet);
  });

  it("returns null when nothing is available", () => {
    expect(
      selectReaderDisplayBookmark({
        localBookmark: null,
        localBookmarkSnapshot: null,
        externalDetail: null,
        externalUnbookmarkedTweetId: null,
      }),
    ).toBeNull();
  });

  it("overlays bookmarked:false on the external copy when its id was un-bookmarked", () => {
    const detail = external("1", { bookmarked: true });
    const result = selectReaderDisplayBookmark({
      localBookmark: null,
      localBookmarkSnapshot: null,
      externalDetail: detail,
      externalUnbookmarkedTweetId: "1",
    });
    expect(result).toMatchObject({ tweetId: "1", bookmarked: false });
    // overlay is applied in place, not by mutating the fetched copy
    expect(result).not.toBe(detail.focalTweet);
    expect(detail.focalTweet.bookmarked).toBe(true);
  });

  it("does not overlay when the un-bookmarked id is a different tweet", () => {
    const detail = external("1", { bookmarked: true });
    const result = selectReaderDisplayBookmark({
      localBookmark: null,
      localBookmarkSnapshot: null,
      externalDetail: detail,
      externalUnbookmarkedTweetId: "2",
    });
    expect(result).toBe(detail.focalTweet);
  });

  it("never overlays the local branch — the overlay is external-only", () => {
    const local = makeBookmark("1", { bookmarked: true });
    const result = selectReaderDisplayBookmark({
      localBookmark: local,
      localBookmarkSnapshot: null,
      externalDetail: null,
      externalUnbookmarkedTweetId: "1",
    });
    expect(result).toBe(local);
    expect(result?.bookmarked).toBe(true);
  });
});
