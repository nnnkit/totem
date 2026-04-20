import { describe, expect, it } from "vitest";
import {
  reduceReaderDetail,
  type ReaderDetailState,
} from "../useReaderDetail";
import type { Bookmark, ThreadTweet } from "../../types";

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

const IDLE: ReaderDetailState = { status: "idle" };

describe("reduceReaderDetail", () => {
  it("starts idle and stays idle on reset", () => {
    expect(reduceReaderDetail(IDLE, { type: "reset" })).toBe(IDLE);
  });

  it("transitions idle → pending on fetch", () => {
    const next = reduceReaderDetail(IDLE, { type: "fetch", tweetId: "1" });
    expect(next).toEqual({ status: "pending", tweetId: "1" });
  });

  it("is idempotent when fetch is dispatched for the already-pending tweetId", () => {
    const pending: ReaderDetailState = { status: "pending", tweetId: "1" };
    const next = reduceReaderDetail(pending, { type: "fetch", tweetId: "1" });
    expect(next).toBe(pending);
  });

  it("replaces pending tweetId when a new fetch is dispatched", () => {
    const pending: ReaderDetailState = { status: "pending", tweetId: "1" };
    const next = reduceReaderDetail(pending, { type: "fetch", tweetId: "2" });
    expect(next).toEqual({ status: "pending", tweetId: "2" });
  });

  it("transitions pending → success when the resolved tweetId matches", () => {
    const pending: ReaderDetailState = { status: "pending", tweetId: "1" };
    const thread: ThreadTweet[] = [];
    const focalTweet = bookmark("1");
    const next = reduceReaderDetail(pending, {
      type: "resolved",
      tweetId: "1",
      data: { focalTweet, thread },
    });
    expect(next).toEqual({
      status: "success",
      tweetId: "1",
      data: { focalTweet, thread },
    });
  });

  it("drops resolved events whose tweetId does not match the pending tweetId (stale response)", () => {
    const pending: ReaderDetailState = { status: "pending", tweetId: "2" };
    const next = reduceReaderDetail(pending, {
      type: "resolved",
      tweetId: "1",
      data: { focalTweet: bookmark("1"), thread: [] },
    });
    expect(next).toBe(pending);
  });

  it("drops resolved events when state is idle (nothing was fetched)", () => {
    const next = reduceReaderDetail(IDLE, {
      type: "resolved",
      tweetId: "1",
      data: { focalTweet: bookmark("1"), thread: [] },
    });
    expect(next).toBe(IDLE);
  });

  it("transitions pending → error with DETAIL_NOT_FOUND on not_found", () => {
    const pending: ReaderDetailState = { status: "pending", tweetId: "1" };
    const next = reduceReaderDetail(pending, { type: "not_found", tweetId: "1" });
    expect(next).toEqual({
      status: "error",
      tweetId: "1",
      error: "DETAIL_NOT_FOUND",
    });
  });

  it("drops not_found events for a stale tweetId", () => {
    const pending: ReaderDetailState = { status: "pending", tweetId: "2" };
    const next = reduceReaderDetail(pending, { type: "not_found", tweetId: "1" });
    expect(next).toBe(pending);
  });

  it("transitions pending → error with the given message on error", () => {
    const pending: ReaderDetailState = { status: "pending", tweetId: "1" };
    const next = reduceReaderDetail(pending, {
      type: "error",
      tweetId: "1",
      error: "DETAIL_TIMEOUT",
    });
    expect(next).toEqual({
      status: "error",
      tweetId: "1",
      error: "DETAIL_TIMEOUT",
    });
  });

  it("drops error events for a stale tweetId", () => {
    const pending: ReaderDetailState = { status: "pending", tweetId: "2" };
    const next = reduceReaderDetail(pending, {
      type: "error",
      tweetId: "1",
      error: "NETWORK_ERROR",
    });
    expect(next).toBe(pending);
  });

  it("reset from a non-idle state returns idle", () => {
    const success: ReaderDetailState = {
      status: "success",
      tweetId: "1",
      data: { focalTweet: bookmark("1"), thread: [] },
    };
    const next = reduceReaderDetail(success, { type: "reset" });
    expect(next).toEqual({ status: "idle" });
  });
});
