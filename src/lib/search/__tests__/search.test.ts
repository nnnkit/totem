import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Bookmark } from "../../../types";
import { searchBookmarks, __resetSearchEngineForTests } from "../../search";

function bm(overrides: Partial<Bookmark> & { tweetId: string }): Bookmark {
  return {
    id: overrides.tweetId,
    text: "",
    createdAt: Date.now(),
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

describe("searchBookmarks", () => {
  it("returns the input untouched when query is empty", () => {
    const bs = [bm({ tweetId: "1" }), bm({ tweetId: "2" })];
    expect(searchBookmarks(bs, "")).toBe(bs);
    expect(searchBookmarks(bs, "   ")).toBe(bs);
  });

  it("returns [] when nothing matches", () => {
    const bs = [bm({ tweetId: "1", text: "hello world" })];
    expect(searchBookmarks(bs, "zzzzzzzz")).toEqual([]);
  });

  it("ranks an exact-handle match above a body match", () => {
    const handleHit = bm({
      tweetId: "h",
      author: {
        name: "Elon",
        screenName: "elonmusk",
        profileImageUrl: "",
        verified: true,
      },
      text: "hello",
    });
    const bodyHit = bm({
      tweetId: "b",
      text: "elonmusk is mentioned in the body but author is someone else",
    });
    const ranked = searchBookmarks([bodyHit, handleHit], "elonmusk");
    expect(ranked[0].tweetId).toBe("h");
  });

  it("ranks a title match above a body-only match", () => {
    const titleHit = bm({
      tweetId: "t",
      article: { title: "Deep work tips", plainText: "" },
      text: "linked article",
    });
    // For the body-hit: pin "deep" in the excerpt (after a sentence boundary)
    // so it can't leak into the derived title field.
    const bodyHit = bm({
      tweetId: "b",
      text: "Scattered notes. Other words include deep among them.",
    });
    const ranked = searchBookmarks([bodyHit, titleHit], "deep");
    expect(ranked[0].tweetId).toBe("t");
  });

  it('finds a bookmark whose "@elonmusk" handle matches a bare-word query', () => {
    const handleHit = bm({
      tweetId: "h",
      author: {
        name: "Elon",
        screenName: "elonmusk",
        profileImageUrl: "",
        verified: true,
      },
    });
    const ranked = searchBookmarks([handleHit], "elon");
    expect(ranked).toHaveLength(1);
    expect(ranked[0].tweetId).toBe("h");
  });

  it("ranks via excerpt when only the excerpt matches", () => {
    const excerptHit = bm({
      tweetId: "x",
      text: "Title sentence. Second sentence about deep focus practices.",
    });
    const ranked = searchBookmarks([excerptHit], "focus");
    expect(ranked).toHaveLength(1);
    expect(ranked[0].tweetId).toBe("x");
  });

  it("supports prefix matching with 2+ char queries", () => {
    const hit = bm({
      tweetId: "p",
      text: "frontend frameworks compared",
    });
    const ranked = searchBookmarks([hit], "front");
    expect(ranked).toHaveLength(1);
    expect(ranked[0].tweetId).toBe("p");
  });

  it('matches a sub-word inside a compound handle (e.g. "abram" → @dan_abramov)', () => {
    const hit = bm({
      tweetId: "u",
      author: {
        name: "Dan Abramov",
        screenName: "dan_abramov",
        profileImageUrl: "",
        verified: false,
      },
    });
    const ranked = searchBookmarks([hit], "abram");
    expect(ranked).toHaveLength(1);
    expect(ranked[0].tweetId).toBe("u");
  });

  it('matches a sub-word in a camelCase handle (e.g. "musk" → @elonMusk)', () => {
    const hit = bm({
      tweetId: "u",
      author: {
        name: "Elon",
        screenName: "elonMusk",
        profileImageUrl: "",
        verified: false,
      },
    });
    const ranked = searchBookmarks([hit], "musk");
    expect(ranked).toHaveLength(1);
    expect(ranked[0].tweetId).toBe("u");
  });

  it("finds a bookmark via image alt-text", () => {
    const hit = bm({
      tweetId: "alt",
      text: "look at this",
      hasImage: true,
      media: [
        {
          type: "photo",
          url: "https://example.com/a.jpg",
          width: 100,
          height: 100,
          altText: "A flexbox layout diagram with three columns",
        },
      ],
    });
    const ranked = searchBookmarks([hit], "flexbox");
    expect(ranked.map((r) => r.tweetId)).toContain("alt");
  });

  it("finds a bookmark via quoted-tweet text", () => {
    const hit = bm({
      tweetId: "qt",
      text: "wrote a thread on it",
      quotedTweet: {
        tweetId: "src",
        text: "the source claim about reactivity primitives",
        createdAt: 0,
        author: {
          name: "Other",
          screenName: "other",
          profileImageUrl: "",
          verified: false,
        },
        media: [],
      },
    });
    const ranked = searchBookmarks([hit], "reactivity");
    expect(ranked.map((r) => r.tweetId)).toContain("qt");
  });

  it("expands synonyms at query time (js → javascript)", () => {
    const hit = bm({
      tweetId: "syn",
      text: "advanced JavaScript memory profiling techniques",
    });
    const ranked = searchBookmarks([hit], "js");
    expect(ranked.map((r) => r.tweetId)).toContain("syn");
  });
});
