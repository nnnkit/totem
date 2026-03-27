import { describe, expect, it, vi } from "vitest";
import { createBookmarksSlice } from "../bookmarks-slice";
import type { Bookmark } from "../../../types";
import type { BookmarkChangeEvent } from "../../../types/messages";

function makeBookmark(tweetId: string, sortIndex?: string): Bookmark {
  return {
    id: tweetId,
    tweetId,
    text: `Tweet ${tweetId}`,
    createdAt: Number(tweetId),
    sortIndex: sortIndex || tweetId,
    bookmarked: false,
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
  };
}

describe("bookmarks slice", () => {
  it("starts with empty state", () => {
    const store = createBookmarksSlice();
    const state = store.getState();
    expect(state.bookmarks).toEqual([]);
    expect(state.bookmarksLoaded).toBe(false);
    expect(state.detailedIdsLoaded).toBe(false);
    expect(state.detailedTweetIds.size).toBe(0);
  });

  it("sets bookmarks sorted by sortIndex descending", () => {
    const store = createBookmarksSlice();
    store.getState().actions.setBookmarks([
      makeBookmark("1", "aaa"),
      makeBookmark("2", "ccc"),
      makeBookmark("3", "bbb"),
    ]);

    const state = store.getState();
    expect(state.bookmarks.map((b) => b.tweetId)).toEqual(["2", "3", "1"]);
    expect(state.bookmarksLoaded).toBe(true);
  });

  it("upserts bookmarks deduplicating by tweetId", () => {
    const store = createBookmarksSlice();
    store.getState().actions.setBookmarks([
      makeBookmark("1", "aaa"),
      makeBookmark("2", "ccc"),
    ]);

    store.getState().actions.upsertBookmarks([
      makeBookmark("2", "ccc"), // duplicate
      makeBookmark("3", "bbb"), // new
    ]);

    expect(store.getState().bookmarks.map((b) => b.tweetId)).toEqual([
      "2", "3", "1",
    ]);
  });

  it("upsert with empty array is no-op", () => {
    const store = createBookmarksSlice();
    store.getState().actions.setBookmarks([makeBookmark("1")]);
    const before = store.getState().bookmarks;
    store.getState().actions.upsertBookmarks([]);
    expect(store.getState().bookmarks).toBe(before);
  });

  it("calls persistBookmarks on upsert", () => {
    const persistBookmarks = vi.fn().mockResolvedValue(undefined);
    const store = createBookmarksSlice({ persistBookmarks });
    store.getState().actions.setBookmarks([]);
    store.getState().actions.upsertBookmarks([makeBookmark("1")]);
    expect(persistBookmarks).toHaveBeenCalledWith([makeBookmark("1")]);
  });

  it("deletes bookmarks by tweetId", () => {
    const store = createBookmarksSlice();
    store.getState().actions.setBookmarks([
      makeBookmark("1"),
      makeBookmark("2"),
      makeBookmark("3"),
    ]);

    store.getState().actions.deleteBookmarks(["2"]);
    expect(store.getState().bookmarks.map((b) => b.tweetId)).toEqual(["3", "1"]);
  });

  it("calls deleteFromDb on delete", () => {
    const deleteFromDb = vi.fn().mockResolvedValue(undefined);
    const store = createBookmarksSlice({ deleteFromDb });
    store.getState().actions.setBookmarks([makeBookmark("1")]);
    store.getState().actions.deleteBookmarks(["1"]);
    expect(deleteFromDb).toHaveBeenCalledWith(["1"], { purgeHighlights: false });
  });

  it("tracks detailed tweet IDs", () => {
    const store = createBookmarksSlice();
    expect(store.getState().detailedTweetIds.has("1")).toBe(false);

    store.getState().actions.detailCached("1");
    expect(store.getState().detailedTweetIds.has("1")).toBe(true);

    // Duplicate is no-op
    const before = store.getState().detailedTweetIds;
    store.getState().actions.detailCached("1");
    expect(store.getState().detailedTweetIds).toBe(before);
  });

  it("sets detailed tweet IDs in bulk", () => {
    const store = createBookmarksSlice();
    store.getState().actions.setDetailedTweetIds(new Set(["1", "2", "3"]));

    expect(store.getState().detailedTweetIds.size).toBe(3);
    expect(store.getState().detailedIdsLoaded).toBe(true);
  });

  it("resets to empty state", () => {
    const store = createBookmarksSlice();
    store.getState().actions.setBookmarks([makeBookmark("1")]);
    store.getState().actions.detailCached("1");
    store.getState().actions.setLoaded({ bookmarks: true, detailedIds: true });

    store.getState().actions.reset();

    const state = store.getState();
    expect(state.bookmarks).toEqual([]);
    expect(state.detailedTweetIds.size).toBe(0);
    expect(state.bookmarksLoaded).toBe(false);
    expect(state.detailedIdsLoaded).toBe(false);
  });

  it("processes delete events directly", () => {
    const deleteFromDb = vi.fn().mockResolvedValue(undefined);
    const store = createBookmarksSlice({ deleteFromDb });
    store.getState().actions.setBookmarks([
      makeBookmark("1"),
      makeBookmark("2"),
      makeBookmark("3"),
    ]);

    const events: BookmarkChangeEvent[] = [
      { id: "ev-1", type: "DeleteBookmark", tweetId: "2", at: Date.now(), source: "test" },
      { id: "ev-2", type: "CreateBookmark", tweetId: "4", at: Date.now(), source: "test" },
    ];

    const createEventIds = store.getState().actions.processDeleteEvents(events);

    // Delete was processed
    expect(store.getState().bookmarks.map((b) => b.tweetId)).toEqual(["3", "1"]);
    // Create event IDs returned for caller to handle
    expect(createEventIds).toEqual(["ev-2"]);
  });
});
