import { describe, expect, it } from "vitest";
import { selectDisplayBookmarks } from "../display-bookmarks";

interface TestBookmark {
  tweetId: string;
}

describe("selectDisplayBookmarks", () => {
  const bookmarks: TestBookmark[] = [
    { tweetId: "1" },
    { tweetId: "2" },
    { tweetId: "3" },
  ];

  it("returns only cached-detail bookmarks while logged out", () => {
    const detailedTweetIds = new Set<string>(["2"]);

    const result = selectDisplayBookmarks(
      bookmarks,
      detailedTweetIds,
      "need_login",
      "idle",
    );

    expect(result).toEqual([{ tweetId: "2" }]);
  });

  it("returns empty list when logged out and no cached details exist", () => {
    const result = selectDisplayBookmarks(
      bookmarks,
      new Set<string>(),
      "need_login",
      "idle",
    );

    expect(result).toEqual([]);
  });

  it("returns only cached-detail bookmarks while connecting", () => {
    const detailedTweetIds = new Set<string>(["1", "3"]);

    const result = selectDisplayBookmarks(
      bookmarks,
      detailedTweetIds,
      "connecting",
      "idle",
    );

    expect(result).toEqual([{ tweetId: "1" }, { tweetId: "3" }]);
  });

  it("returns full bookmarks list when session is ready", () => {
    const result = selectDisplayBookmarks(
      bookmarks,
      new Set<string>(["1"]),
      "ready",
      "idle",
    );

    expect(result).toEqual(bookmarks);
  });
});
