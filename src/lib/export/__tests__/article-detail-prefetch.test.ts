import { describe, expect, it, vi } from "vitest";
import type { Bookmark } from "../../../types";
import type { TweetDetailContent } from "../../../api/parsers";
import {
  ARTICLE_PREFETCH_GAP_MS,
  MAX_ARTICLE_PREFETCH,
  prefetchMissingArticleDetails,
  type ArticlePrefetchDeps,
} from "../article-detail-prefetch";

vi.mock("../../../api/core/posts", () => ({ fetchTweetDetail: vi.fn() }));
vi.mock("../../../db", () => ({
  getTweetDetailCache: vi.fn(),
  iterateBookmarks: vi.fn(),
  upsertTweetDetailCache: vi.fn(),
}));
vi.mock("../../../stores/hydration-store", () => ({ getHydrationStore: vi.fn() }));

const author = { name: "Ben", screenName: "bensenescu", profileImageUrl: "", verified: false };

function articleBookmark(tweetId: string, withBlocks = false): Bookmark {
  return {
    id: tweetId,
    tweetId,
    text: "OpenSEO v DataForSEO: Which is better for AI Agents?",
    createdAt: 0,
    sortIndex: tweetId,
    bookmarked: true,
    author,
    metrics: { likes: 0, retweets: 0, replies: 0, views: 0, bookmarks: 0 },
    media: [],
    urls: [],
    isThread: false,
    hasImage: false,
    hasVideo: false,
    hasLink: false,
    quotedTweet: null,
    article: {
      title: "OpenSEO v DataForSEO: Which is better for AI Agents?",
      plainText: "We are probably DataForSEO's biggest fans.",
      ...(withBlocks
        ? { contentBlocks: [{ type: "unstyled", text: "x", inlineStyleRanges: [], entityRanges: [], depth: 0 }] }
        : {}),
    },
  };
}

function plainBookmark(tweetId: string): Bookmark {
  return { ...articleBookmark(tweetId), article: null };
}

function makeDeps(bookmarks: Bookmark[], overrides: Partial<ArticlePrefetchDeps> = {}) {
  const detail: TweetDetailContent = { focalTweet: articleBookmark("x", true), thread: [] };
  const deps: ArticlePrefetchDeps = {
    bookmarks: async function* () {
      yield* bookmarks;
    },
    hasDetail: vi.fn(async () => false),
    fetchDetail: vi.fn(async () => detail),
    saveDetail: vi.fn(async () => {}),
    rateLimitedUntil: () => 0,
    sleep: vi.fn(async () => {}),
    now: () => 1000,
    ...overrides,
  };
  return deps;
}

describe("prefetchMissingArticleDetails", () => {
  it("fetches and saves only Articles that lack blocks and a cached detail", async () => {
    const deps = makeDeps(
      [articleBookmark("1"), articleBookmark("2", true), plainBookmark("3"), articleBookmark("4"), articleBookmark("5")],
      { hasDetail: vi.fn(async (id: string) => id === "5") },
    );
    expect(await prefetchMissingArticleDetails(deps)).toEqual({ fetched: 2, stopped: false });
    expect(deps.fetchDetail).toHaveBeenCalledTimes(2);
    expect(vi.mocked(deps.fetchDetail).mock.calls.map(([id]) => id)).toEqual(["1", "4"]);
    expect(vi.mocked(deps.saveDetail).mock.calls.map(([id]) => id)).toEqual(["1", "4"]);
    expect(deps.sleep).toHaveBeenCalledExactlyOnceWith(ARTICLE_PREFETCH_GAP_MS);
  });

  it("stops at the first rate-limit response and keeps what it already saved", async () => {
    const fetchDetail = vi
      .fn()
      .mockResolvedValueOnce({ focalTweet: articleBookmark("1", true), thread: [] })
      .mockRejectedValueOnce(new Error("DETAIL_ERROR_429"));
    const deps = makeDeps([articleBookmark("1"), articleBookmark("2"), articleBookmark("3")], { fetchDetail });
    expect(await prefetchMissingArticleDetails(deps)).toEqual({ fetched: 1, stopped: true });
    expect(fetchDetail).toHaveBeenCalledTimes(2);
  });

  it("skips one failed post but keeps going on other errors", async () => {
    const fetchDetail = vi
      .fn()
      .mockRejectedValueOnce(new Error("DETAIL_NOT_FOUND"))
      .mockResolvedValueOnce({ focalTweet: articleBookmark("2", true), thread: [] });
    const deps = makeDeps([articleBookmark("1"), articleBookmark("2")], { fetchDetail });
    expect(await prefetchMissingArticleDetails(deps)).toEqual({ fetched: 1, stopped: false });
  });

  it("does nothing while detail hydration is paused for a rate limit", async () => {
    const deps = makeDeps([articleBookmark("1")], { rateLimitedUntil: () => 5000 });
    expect(await prefetchMissingArticleDetails(deps)).toEqual({ fetched: 0, stopped: true });
    expect(deps.fetchDetail).not.toHaveBeenCalled();
  });

  it("caps the number of requests per export", async () => {
    const many = Array.from({ length: MAX_ARTICLE_PREFETCH + 10 }, (_, i) => articleBookmark(String(i)));
    const deps = makeDeps(many);
    await prefetchMissingArticleDetails(deps);
    expect(deps.fetchDetail).toHaveBeenCalledTimes(MAX_ARTICLE_PREFETCH);
  });
});
