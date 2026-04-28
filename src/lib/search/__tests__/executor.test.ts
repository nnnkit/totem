import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Bookmark } from "../../../types";
import {
  searchBookmarks,
  __resetSearchEngineForTests,
} from "../../search";

const NOW = Date.UTC(2026, 3, 27); // 2026-04-27

function bm(overrides: Partial<Bookmark> & { tweetId: string }): Bookmark {
  return {
    id: overrides.tweetId,
    text: "",
    createdAt: NOW,
    sortIndex: overrides.tweetId,
    bookmarked: true,
    author: {
      name: "Anon",
      screenName: "anon",
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

beforeEach(() => __resetSearchEngineForTests());
afterEach(() => __resetSearchEngineForTests());

describe("operator: from:", () => {
  it("filters to bookmarks by the given handle", () => {
    const a = bm({
      tweetId: "a",
      author: {
        name: "Elon",
        screenName: "elonmusk",
        profileImageUrl: "",
        verified: false,
      },
    });
    const b = bm({
      tweetId: "b",
      author: {
        name: "Other",
        screenName: "other",
        profileImageUrl: "",
        verified: false,
      },
    });
    const ranked = searchBookmarks([a, b], "from:elonmusk");
    expect(ranked.map((r) => r.tweetId)).toEqual(["a"]);
  });

  it("@handle is sugar for from:", () => {
    const a = bm({
      tweetId: "a",
      author: {
        name: "Elon",
        screenName: "elonmusk",
        profileImageUrl: "",
        verified: false,
      },
    });
    const b = bm({ tweetId: "b" });
    const ranked = searchBookmarks([a, b], "@elonmusk");
    expect(ranked.map((r) => r.tweetId)).toEqual(["a"]);
  });
});

describe("operator: has:", () => {
  it("filters to bookmarks with images", () => {
    const withImage = bm({
      tweetId: "a",
      hasImage: true,
      media: [
        {
          type: "photo",
          url: "https://example.com/a.jpg",
          width: 100,
          height: 100,
        },
      ],
    });
    const without = bm({ tweetId: "b" });
    const ranked = searchBookmarks([withImage, without], "has:image");
    expect(ranked.map((r) => r.tweetId)).toEqual(["a"]);
  });

  it("filter:videos works as alias", () => {
    const withVideo = bm({
      tweetId: "v",
      hasVideo: true,
      media: [
        {
          type: "video",
          url: "https://example.com/v.mp4",
          width: 100,
          height: 100,
        },
      ],
    });
    const ranked = searchBookmarks([withVideo, bm({ tweetId: "x" })], "filter:videos");
    expect(ranked.map((r) => r.tweetId)).toEqual(["v"]);
  });

  it("has:link filters to bookmarks with URLs", () => {
    const withLink = bm({
      tweetId: "l",
      hasLink: true,
      urls: [
        {
          url: "https://t.co/x",
          displayUrl: "github.com/foo",
          expandedUrl: "https://github.com/foo",
        },
      ],
    });
    const ranked = searchBookmarks([withLink, bm({ tweetId: "x" })], "has:link");
    expect(ranked.map((r) => r.tweetId)).toEqual(["l"]);
  });
});

describe("operator: min_faves:", () => {
  it("filters by metrics.likes threshold", () => {
    const high = bm({
      tweetId: "h",
      metrics: { likes: 5000, retweets: 0, replies: 0, views: 0, bookmarks: 0 },
    });
    const low = bm({
      tweetId: "l",
      metrics: { likes: 5, retweets: 0, replies: 0, views: 0, bookmarks: 0 },
    });
    const ranked = searchBookmarks([high, low], "min_faves:1000");
    expect(ranked.map((r) => r.tweetId)).toEqual(["h"]);
  });
});

describe("operator: since: / until:", () => {
  it("since: keeps newer or equal bookmarks", () => {
    const recent = bm({
      tweetId: "r",
      createdAt: Date.UTC(2026, 3, 1), // 2026-04-01
    });
    const old = bm({ tweetId: "o", createdAt: Date.UTC(2024, 0, 1) });
    const ranked = searchBookmarks([recent, old], "since:2026-01-01");
    expect(ranked.map((r) => r.tweetId)).toEqual(["r"]);
  });

  it("until: keeps older bookmarks", () => {
    const recent = bm({ tweetId: "r", createdAt: Date.UTC(2026, 3, 1) });
    const old = bm({ tweetId: "o", createdAt: Date.UTC(2024, 0, 1) });
    const ranked = searchBookmarks([recent, old], "until:2026-01-01");
    expect(ranked.map((r) => r.tweetId)).toEqual(["o"]);
  });
});

describe("operator: site:", () => {
  it("matches host suffixes", () => {
    const githubLink = bm({
      tweetId: "g",
      urls: [
        {
          url: "https://t.co/x",
          displayUrl: "github.com/foo",
          expandedUrl: "https://github.com/foo/bar",
        },
      ],
    });
    const otherLink = bm({
      tweetId: "o",
      urls: [
        {
          url: "https://t.co/y",
          displayUrl: "example.com",
          expandedUrl: "https://example.com/y",
        },
      ],
    });
    const ranked = searchBookmarks([githubLink, otherLink], "site:github.com");
    expect(ranked.map((r) => r.tweetId)).toEqual(["g"]);
  });
});

describe("negation", () => {
  it("- excludes operator matches", () => {
    const a = bm({
      tweetId: "a",
      author: {
        name: "X",
        screenName: "elonmusk",
        profileImageUrl: "",
        verified: false,
      },
    });
    const b = bm({ tweetId: "b" });
    const ranked = searchBookmarks([a, b], "-from:elonmusk");
    // After NOT-from filter: only `b` qualifies. There's no free-text term so
    // results come out newest-first, but since both have the same NOW we just
    // assert membership.
    expect(ranked.map((r) => r.tweetId)).toEqual(["b"]);
  });
});

describe("combined operator + free text", () => {
  it("filters by operator first, then ranks by BM25", () => {
    const a = bm({
      tweetId: "a",
      text: "react hooks deep dive",
      author: {
        name: "Elon",
        screenName: "elonmusk",
        profileImageUrl: "",
        verified: false,
      },
    });
    const b = bm({
      tweetId: "b",
      text: "react hooks deep dive",
      author: {
        name: "Other",
        screenName: "other",
        profileImageUrl: "",
        verified: false,
      },
    });
    const ranked = searchBookmarks([a, b], "from:elonmusk react");
    expect(ranked.map((r) => r.tweetId)).toEqual(["a"]);
  });
});
