import { describe, it, expect } from "vitest";
import type { Bookmark, ThreadTweet } from "../../../types";
import { decodeShareFragment, encodeShareFragment } from "../codec";
import { isSharePayload, readSharePayload } from "../payload";
import {
  buildShareUrl,
  parseShareFragment,
  parseShareTweetId,
} from "../link";

function makeBookmark(overrides: Partial<Bookmark> = {}): Bookmark {
  return {
    id: "1",
    tweetId: "1",
    text: "first post",
    createdAt: 1700000000000,
    sortIndex: "999",
    bookmarked: true,
    author: {
      name: "Ada",
      screenName: "ada",
      profileImageUrl: "https://pbs.twimg.com/ada.jpg",
      verified: true,
    },
    metrics: { likes: 10, retweets: 2, replies: 1, views: 500, bookmarks: 3 },
    media: [
      {
        type: "photo",
        url: "https://pbs.twimg.com/media/a.jpg",
        width: 1200,
        height: 800,
        altText: "a chart",
      },
    ],
    urls: [
      {
        url: "https://t.co/abc",
        displayUrl: "example.com",
        expandedUrl: "https://example.com/post",
      },
    ],
    isThread: true,
    hasImage: true,
    hasVideo: false,
    hasLink: true,
    quotedTweet: null,
    tweetKind: "thread",
    ...overrides,
  };
}

function makeThreadTweet(tweetId: string, text: string): ThreadTweet {
  return {
    tweetId,
    text,
    createdAt: 1700000001000,
    author: {
      name: "Ada",
      screenName: "ada",
      profileImageUrl: "https://pbs.twimg.com/ada.jpg",
      verified: true,
    },
    media: [],
    urls: [],
    article: null,
    quotedTweet: null,
    tweetKind: "thread",
    isThread: true,
  };
}

describe("share codec", () => {
  it("round-trips a payload through the fragment encoding", async () => {
    const value = { v: 1, hello: "wörld", nested: [1, 2, 3] };
    const fragment = await encodeShareFragment(value);
    expect(fragment).not.toMatch(/[+/=]/);
    expect(await decodeShareFragment(fragment)).toEqual(value);
  });
});

describe("buildShareUrl", () => {
  it("carries the thread in the fragment and rehydrates it", async () => {
    const focal = makeBookmark();
    const thread = [makeThreadTweet("2", "second post"), makeThreadTweet("3", "third post")];

    const link = await buildShareUrl(focal, thread);
    expect(link.includesThread).toBe(true);
    expect(link.url.startsWith("https://usetotem.xyz/t/1#s=")).toBe(true);

    const url = new URL(link.url);
    expect(parseShareTweetId(url.pathname)).toBe("1");

    const fragment = parseShareFragment(url.hash);
    expect(fragment).not.toBeNull();

    const payload = await decodeShareFragment(fragment!);
    expect(isSharePayload(payload)).toBe(true);

    const decoded = readSharePayload(payload as never);
    expect(decoded.focalTweet.text).toBe("first post");
    expect(decoded.focalTweet.author.screenName).toBe("ada");
    expect(decoded.focalTweet.media[0].altText).toBe("a chart");
    expect(decoded.focalTweet.hasImage).toBe(true);
    expect(decoded.focalTweet.bookmarked).toBe(false);
    expect(decoded.thread.map((post) => post.text)).toEqual([
      "second post",
      "third post",
    ]);
  });

  it("falls back to a bare link when the payload cannot fit", async () => {
    const focal = makeBookmark({
      article: { plainText: "x".repeat(200_000) },
    });

    const link = await buildShareUrl(focal, [], { maxLength: 200 });
    expect(link.includesThread).toBe(false);
    expect(link.url).toBe("https://usetotem.xyz/t/1");
  });

  it("trims alt text before giving up on the payload", async () => {
    const focal = makeBookmark({
      media: [
        {
          type: "photo",
          url: "https://pbs.twimg.com/media/a.jpg",
          width: 1200,
          height: 800,
          altText: Array.from({ length: 2000 }, (_, index) => `alt-${index}`).join(" "),
        },
      ],
    });

    const link = await buildShareUrl(focal, [], { maxLength: 900 });
    expect(link.includesThread).toBe(true);

    const payload = await decodeShareFragment(parseShareFragment(new URL(link.url).hash)!);
    const decoded = readSharePayload(payload as never);
    expect(decoded.focalTweet.media[0].altText).toBeUndefined();
    expect(decoded.focalTweet.media[0].url).toBe("https://pbs.twimg.com/media/a.jpg");
  });
});

describe("parseShareTweetId", () => {
  it("accepts a share path and rejects anything else", () => {
    expect(parseShareTweetId("/t/1234567890")).toBe("1234567890");
    expect(parseShareTweetId("/t/1234567890/")).toBe("1234567890");
    expect(parseShareTweetId("/t/not-a-tweet")).toBeNull();
    expect(parseShareTweetId("/blog/t/123")).toBeNull();
  });
});
