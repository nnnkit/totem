import { describe, expect, it } from "vitest";
import { computeContinueReading } from "../useContinueReading";
import type { Bookmark, ReadingProgress } from "../../types";

function bookmark(tweetId: string): Bookmark {
  return {
    id: tweetId,
    tweetId,
    text: `Tweet ${tweetId}`,
    createdAt: 1,
    sortIndex: tweetId,
    bookmarked: true,
    author: {
      name: "Author",
      screenName: "author",
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
    openedAt: 1,
    lastReadAt: 2,
    scrollY: 0,
    scrollHeight: 0,
    completed,
  };
}

describe("computeContinueReading", () => {
  it("joins progress rows to the provided bookmark set", () => {
    const bookmarks = [bookmark("1"), bookmark("2"), bookmark("3")];
    const rows = [progress("1"), progress("2", true)];

    const { continueReading, allUnread } = computeContinueReading(
      rows,
      bookmarks,
    );

    expect(continueReading.map((i) => i.progress.tweetId)).toEqual(["1", "2"]);
    expect(allUnread.map((b) => b.tweetId)).toEqual(["3"]);
  });

  it("drops progress rows for tweets not in the bookmark set", () => {
    const bookmarks = [bookmark("1")];
    const rows = [progress("1"), progress("999")];

    const { continueReading } = computeContinueReading(rows, bookmarks);

    expect(continueReading.map((i) => i.progress.tweetId)).toEqual(["1"]);
  });

  // Regression: the original bug the user reported.
  // When the reading tab was fed the *filtered* displayBookmarks (which
  // excludes bookmarks whose detail isn't cached during connecting/reauthing),
  // a just-opened article could silently disappear from the Continue tab
  // even though its progress row was written correctly. The fix is to pass
  // the full bookmark set on the read side; this test asserts that callers
  // who do so get the expected behavior.
  it("includes progress rows even when the bookmark is technically valid but would be filtered elsewhere", () => {
    // Simulate: user has 2 bookmarks; only one has cached detail. Under the
    // buggy call site, displayBookmarks = [bookmark("1")] and the progress
    // row for "2" would be dropped. Passing the full set keeps it.
    const allBookmarks = [bookmark("1"), bookmark("2")];
    const rows = [progress("2")];

    const { continueReading } = computeContinueReading(rows, allBookmarks);

    expect(continueReading.map((i) => i.progress.tweetId)).toEqual(["2"]);
  });

  it("returns empty when there is no progress", () => {
    const bookmarks = [bookmark("1")];
    const { continueReading, allUnread } = computeContinueReading(
      [],
      bookmarks,
    );
    expect(continueReading).toEqual([]);
    expect(allUnread.map((b) => b.tweetId)).toEqual(["1"]);
  });
});
