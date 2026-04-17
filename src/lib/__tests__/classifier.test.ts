import { describe, expect, it } from "vitest";
import { classify, classifyBatch } from "../classifier";
import type { Bookmark, TweetUrl } from "../../types";

function makeBookmark(overrides: Partial<Bookmark> = {}): Bookmark {
  return {
    id: "bk-1",
    tweetId: "tw-1",
    text: "test bookmark text",
    createdAt: Date.now(),
    sortIndex: "1234567890000000000",
    bookmarked: true,
    author: {
      name: "Test User",
      screenName: "testuser",
      profileImageUrl: "https://example.com/avatar.jpg",
      verified: false,
    },
    metrics: { likes: 10, retweets: 2, replies: 1, views: 500, bookmarks: 0 },
    media: [],
    urls: [],
    isThread: false,
    hasImage: false,
    hasVideo: false,
    hasLink: false,
    quotedTweet: null,
    intent: "unsorted",
    ...overrides,
  };
}

function makeUrl(expandedUrl: string, card?: TweetUrl["card"]): TweetUrl {
  return {
    url: expandedUrl,
    displayUrl: expandedUrl,
    expandedUrl,
    card,
  };
}

describe("classify — Layer 1 structural rules", () => {
  it("github.com URL → reference", () => {
    const bm = makeBookmark({
      urls: [makeUrl("https://github.com/facebook/react")],
      hasLink: true,
    });
    const result = classify(bm);
    expect(result).toEqual({ intent: "reference", confidence: 0.9, source: "structural" });
  });

  it("arxiv.org URL → reference", () => {
    const bm = makeBookmark({
      urls: [makeUrl("https://arxiv.org/abs/2301.00001")],
      hasLink: true,
    });
    const result = classify(bm);
    expect(result).toEqual({ intent: "reference", confidence: 0.9, source: "structural" });
  });

  it("readthedocs URL → reference", () => {
    const bm = makeBookmark({
      urls: [makeUrl("https://flask.readthedocs.io/en/latest/")],
      hasLink: true,
    });
    const result = classify(bm);
    expect(result).toEqual({ intent: "reference", confidence: 0.9, source: "structural" });
  });

  it("docs subdomain → reference", () => {
    const bm = makeBookmark({
      urls: [makeUrl("https://docs.stripe.com/api/charges")],
      hasLink: true,
    });
    const result = classify(bm);
    expect(result).toEqual({ intent: "reference", confidence: 0.9, source: "structural" });
  });

  it("developer subdomain → reference", () => {
    const bm = makeBookmark({
      urls: [makeUrl("https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API")],
      hasLink: true,
    });
    const result = classify(bm);
    expect(result).toEqual({ intent: "reference", confidence: 0.9, source: "structural" });
  });

  it("api subdomain → reference", () => {
    const bm = makeBookmark({
      urls: [makeUrl("https://api.openai.com/v1/chat/completions")],
      hasLink: true,
    });
    const result = classify(bm);
    expect(result).toEqual({ intent: "reference", confidence: 0.9, source: "structural" });
  });

  it("stackoverflow URL → reference", () => {
    const bm = makeBookmark({
      urls: [makeUrl("https://stackoverflow.com/questions/12345/how-to-do-x")],
      hasLink: true,
    });
    const result = classify(bm);
    expect(result).toEqual({ intent: "reference", confidence: 0.9, source: "structural" });
  });

  it("youtube URL → read_soon", () => {
    const bm = makeBookmark({
      urls: [makeUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")],
      hasLink: true,
    });
    const result = classify(bm);
    expect(result).toEqual({ intent: "read_soon", confidence: 0.85, source: "structural" });
  });

  it("medium blog URL → read_soon", () => {
    const bm = makeBookmark({
      urls: [makeUrl("https://medium.com/@author/great-article-abc123")],
      hasLink: true,
    });
    const result = classify(bm);
    expect(result).toEqual({ intent: "read_soon", confidence: 0.85, source: "structural" });
  });

  it("substack URL → read_soon", () => {
    const bm = makeBookmark({
      urls: [makeUrl("https://newsletter.substack.com/p/interesting-post")],
      hasLink: true,
    });
    const result = classify(bm);
    expect(result).toEqual({ intent: "read_soon", confidence: 0.85, source: "structural" });
  });

  it("tweetKind article → read_soon", () => {
    const bm = makeBookmark({ tweetKind: "article" });
    const result = classify(bm);
    expect(result).toEqual({ intent: "read_soon", confidence: 0.9, source: "structural" });
  });

  it("isThread true → read_soon", () => {
    const bm = makeBookmark({ isThread: true });
    const result = classify(bm);
    expect(result).toEqual({ intent: "read_soon", confidence: 0.85, source: "structural" });
  });

  it("thread opener 1/ → read_soon", () => {
    const bm = makeBookmark({
      text: "1/ Here's why this matters for the future of AI...",
    });
    const result = classify(bm);
    expect(result).toEqual({ intent: "read_soon", confidence: 0.85, source: "structural" });
  });

  it("thread opener 1. → read_soon", () => {
    const bm = makeBookmark({
      text: "1. A thread on distributed systems fundamentals",
    });
    const result = classify(bm);
    expect(result).toEqual({ intent: "read_soon", confidence: 0.85, source: "structural" });
  });

  it("thread opener 🧵 → read_soon", () => {
    const bm = makeBookmark({
      text: "🧵 Let me explain how React Server Components work",
    });
    const result = classify(bm);
    expect(result).toEqual({ intent: "read_soon", confidence: 0.85, source: "structural" });
  });

  it("short no-link post → read_soon", () => {
    const bm = makeBookmark({
      text: "Hot take: TypeScript is better than Go for web services.",
      hasLink: false,
    });
    const result = classify(bm);
    expect(result).toEqual({ intent: "read_soon", confidence: 0.8, source: "structural" });
  });

  it("ambiguous long post with unknown link → null", () => {
    const bm = makeBookmark({
      text: "This is a somewhat longer post that talks about various things. It has a link to an unknown site that doesn't match any patterns. The text is well over 180 characters so it doesn't match the short post rule either.",
      urls: [makeUrl("https://randomsite.example.com/page")],
      hasLink: true,
    });
    const result = classify(bm);
    expect(result).toBeNull();
  });

  it("reference URL takes priority over read_soon URL when both present", () => {
    const bm = makeBookmark({
      urls: [
        makeUrl("https://github.com/some/repo"),
        makeUrl("https://medium.com/@author/about-the-repo"),
      ],
      hasLink: true,
    });
    const result = classify(bm);
    expect(result?.intent).toBe("reference");
  });

  it("/docs path → reference", () => {
    const bm = makeBookmark({
      urls: [makeUrl("https://nextjs.org/docs/getting-started")],
      hasLink: true,
    });
    const result = classify(bm);
    expect(result).toEqual({ intent: "reference", confidence: 0.9, source: "structural" });
  });

  it("blog subdomain → read_soon", () => {
    const bm = makeBookmark({
      urls: [makeUrl("https://blog.vercel.com/new-features")],
      hasLink: true,
    });
    const result = classify(bm);
    expect(result).toEqual({ intent: "read_soon", confidence: 0.85, source: "structural" });
  });
});

describe("classifyBatch", () => {
  it("skips manual-intent bookmarks", () => {
    const bookmarks = [
      makeBookmark({
        id: "manual",
        intent: "act_on",
        intentSource: "manual",
        intentAssignedAt: "2026-01-01T00:00:00.000Z",
        urls: [makeUrl("https://github.com/facebook/react")],
        hasLink: true,
      }),
    ];
    const updated = classifyBatch(bookmarks);
    expect(updated).toHaveLength(0);
  });

  it("skips already-classified bookmarks", () => {
    const bookmarks = [
      makeBookmark({
        id: "structural",
        intent: "reference",
        intentSource: "structural",
        intentConfidence: 0.9,
      }),
    ];
    const updated = classifyBatch(bookmarks);
    expect(updated).toHaveLength(0);
  });

  it("classifies unsorted bookmarks in batch", () => {
    const bookmarks = [
      makeBookmark({
        id: "bk-gh",
        tweetId: "tw-gh",
        intent: "unsorted",
        urls: [makeUrl("https://github.com/repo/name")],
        hasLink: true,
      }),
      makeBookmark({
        id: "bk-yt",
        tweetId: "tw-yt",
        intent: "unsorted",
        urls: [makeUrl("https://youtube.com/watch?v=123")],
        hasLink: true,
      }),
      makeBookmark({
        id: "bk-ambig",
        tweetId: "tw-ambig",
        intent: "unsorted",
        text: "A long post about various things that doesn't match any specific patterns and is over 180 characters long so it won't trigger the short post rule at all here.",
        urls: [makeUrl("https://randomsite.example.com/page")],
        hasLink: true,
      }),
    ];
    const updated = classifyBatch(bookmarks);
    expect(updated).toHaveLength(2);
    expect(updated[0].id).toBe("bk-gh");
    expect(updated[0].intent).toBe("reference");
    expect(updated[0].intentSource).toBe("structural");
    expect(updated[1].id).toBe("bk-yt");
    expect(updated[1].intent).toBe("read_soon");
  });

  it("sets intentAssignedAt on classified bookmarks", () => {
    const bookmarks = [
      makeBookmark({
        intent: "unsorted",
        tweetKind: "article",
      }),
    ];
    const updated = classifyBatch(bookmarks);
    expect(updated).toHaveLength(1);
    expect(updated[0].intentAssignedAt).toBeDefined();
    expect(new Date(updated[0].intentAssignedAt!).getTime()).toBeGreaterThan(0);
  });

  it("treats missing intent as unsorted", () => {
    const bm = makeBookmark({ tweetKind: "article" });
    delete (bm as unknown as Record<string, unknown>).intent;
    const updated = classifyBatch([bm]);
    expect(updated).toHaveLength(1);
    expect(updated[0].intent).toBe("read_soon");
  });

  it("returns empty array when all bookmarks are ambiguous", () => {
    const bookmarks = [
      makeBookmark({
        text: "Here is a very long post about something. It has a link to an unknown domain and the text itself is well over 180 characters, so no structural rule triggers for this particular bookmark entry.",
        urls: [makeUrl("https://unknown.example.com/page")],
        hasLink: true,
      }),
    ];
    const updated = classifyBatch(bookmarks);
    expect(updated).toHaveLength(0);
  });
});
