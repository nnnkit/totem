import { describe, expect, it } from "vitest";
import type { Bookmark } from "../../../types";
import { toSearchableBookmark } from "../build-doc";

function bm(overrides: Partial<Bookmark>): Bookmark {
  return {
    id: "id-1",
    tweetId: "1",
    text: "",
    createdAt: 0,
    sortIndex: "1",
    bookmarked: true,
    author: {
      name: "Test User",
      screenName: "testuser",
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
    ...overrides,
  };
}

describe("toSearchableBookmark", () => {
  it("splits tweet text into title and excerpt at sentence boundary", () => {
    const out = toSearchableBookmark(
      bm({
        text: "Deep work tips. Schedule blocks for focused effort and protect them.",
      }),
    );
    expect(out.title).toBe("Deep work tips.");
    expect(out.excerpt).toContain("Schedule blocks");
  });

  it("uses article.title when present and pulls excerpt from plainText", () => {
    const out = toSearchableBookmark(
      bm({
        text: "tweet body",
        article: {
          title: "How to do deep work",
          plainText:
            "Cal Newport argues that deep work is the ability to focus without distraction.",
        },
      }),
    );
    expect(out.title).toBe("How to do deep work");
    expect(out.excerpt).toMatch(/Cal Newport/);
  });

  it("derives domain from the first URL", () => {
    const out = toSearchableBookmark(
      bm({
        text: "check this",
        urls: [
          {
            url: "https://t.co/abc",
            displayUrl: "github.com/foo/bar",
            expandedUrl: "https://www.github.com/foo/bar",
          },
        ],
      }),
    );
    expect(out.domain).toBe("github.com");
  });

  it("joins card descriptions and titles into description / cardDescription", () => {
    const out = toSearchableBookmark(
      bm({
        text: "x",
        urls: [
          {
            url: "https://t.co/a",
            displayUrl: "example.com",
            expandedUrl: "https://example.com/post",
            card: { title: "OG Title", description: "OG Description text" },
          },
        ],
      }),
    );
    expect(out.description).toBe("OG Description text");
    expect(out.cardDescription).toBe("OG Title");
  });

  it("extracts hashtags and mentions from tweet text", () => {
    const out = toSearchableBookmark(
      bm({ text: "Loving #React via @dan_abramov!" }),
    );
    expect(out.hashtags).toEqual(["react"]);
    expect(out.mentions).toEqual(["dan_abramov"]);
  });

  it("uses screenName as the search id", () => {
    const out = toSearchableBookmark(bm({ tweetId: "42" }));
    expect(out.id).toBe("42");
  });

  it("indexes quoted tweet text when present", () => {
    const out = toSearchableBookmark(
      bm({
        text: "wrote a thread about it",
        quotedTweet: {
          tweetId: "q1",
          text: "Original deep insight on React performance",
          createdAt: 0,
          author: {
            name: "Other",
            screenName: "other",
            profileImageUrl: "",
            verified: false,
          },
          media: [],
        },
      }),
    );
    expect(out.quotedText).toContain("React performance");
  });

  it("indexes retweeted tweet text when present", () => {
    const out = toSearchableBookmark(
      bm({
        retweetedTweet: {
          tweetId: "r1",
          text: "Original retweet body",
          createdAt: 0,
          author: {
            name: "Source",
            screenName: "source",
            profileImageUrl: "",
            verified: false,
          },
          media: [],
        },
      }),
    );
    expect(out.retweetedText).toContain("retweet body");
  });

  it("joins media alt-text into mediaAlt", () => {
    const out = toSearchableBookmark(
      bm({
        media: [
          {
            type: "photo",
            url: "https://example.com/a.jpg",
            width: 100,
            height: 100,
            altText: "A diagram showing flexbox layout",
          },
          {
            type: "photo",
            url: "https://example.com/b.jpg",
            width: 100,
            height: 100,
            altText: "Sketch of grid system",
          },
        ],
      }),
    );
    expect(out.mediaAlt).toBe(
      "A diagram showing flexbox layout Sketch of grid system",
    );
  });

  it("plumbs signals (lastReadAt, reopenCount) when provided", () => {
    const out = toSearchableBookmark(bm({ tweetId: "s" }), {
      lastReadAt: 12345,
      reopenCount: 3,
    });
    expect(out.lastReadAt).toBe(12345);
    expect(out.reopenCount).toBe(3);
  });
});
