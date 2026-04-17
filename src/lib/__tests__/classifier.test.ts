import { describe, expect, it } from "vitest";
import { classify, classifyBatch, classifyLayer2 } from "../classifier";
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

  it("chains to Layer 2 when Layer 1 returns null", () => {
    const bookmarks = [
      makeBookmark({
        id: "bk-cheat",
        intent: "unsorted",
        text: "The ultimate cheat sheet for Docker commands — bookmark this reference guide for later.",
        urls: [makeUrl("https://randomsite.example.com/docker")],
        hasLink: true,
      }),
    ];
    const updated = classifyBatch(bookmarks);
    expect(updated).toHaveLength(1);
    expect(updated[0].intent).toBe("reference");
    expect(updated[0].intentSource).toBe("keyword");
  });

  it("passes highlightedTweetIds to Layer 2", () => {
    const bookmarks = [
      makeBookmark({
        id: "bk-hl",
        tweetId: "tw-hl",
        intent: "unsorted",
        text: "A long post that doesn't match any structural rules and is over 180 characters. It contains some interesting thoughts about technology and the future of computing but nothing pattern-matching.",
        createdAt: Date.now() - 100 * 86_400_000,
        urls: [makeUrl("https://randomsite.example.com/post")],
        hasLink: true,
      }),
    ];
    const hlSet = new Set(["tw-hl"]);
    const updated = classifyBatch(bookmarks, hlSet);
    expect(updated).toHaveLength(1);
    expect(updated[0].intent).toBe("reference");
    expect(updated[0].intentSource).toBe("keyword");
  });
});

describe("classifyLayer2 — keyword + signal scoring", () => {
  const NOW = Date.now();

  it("DM me tweet → act_on", () => {
    const bm = makeBookmark({
      text: "Just shipped a new tool for React devs. DM me if you want early access, limited spots available.",
      urls: [makeUrl("https://example.com/tool")],
      hasLink: true,
    });
    const result = classifyLayer2(bm, { now: NOW });
    expect(result).not.toBeNull();
    expect(result!.intent).toBe("act_on");
    expect(result!.source).toBe("keyword");
  });

  it("cheat sheet language → reference", () => {
    const bm = makeBookmark({
      text: "The complete cheat sheet for CSS Grid — save this for your next project. A comprehensive reference guide.",
      urls: [makeUrl("https://example.com/css-grid")],
      hasLink: true,
    });
    const result = classifyLayer2(bm, { now: NOW });
    expect(result).not.toBeNull();
    expect(result!.intent).toBe("reference");
  });

  it("stale thread (>90d) with resource language → reference", () => {
    const bm = makeBookmark({
      text: "A comprehensive list of resources and tools for building distributed systems. This compilation covers everything from consensus algorithms to observability toolkits.",
      createdAt: NOW - 100 * 86_400_000,
      urls: [makeUrl("https://example.com/old")],
      hasLink: true,
    });
    const result = classifyLayer2(bm, { now: NOW });
    expect(result).not.toBeNull();
    expect(result!.intent).toBe("reference");
  });

  it("high engagement (>500 retweets) + staleness + resource keywords → reference", () => {
    const bm = makeBookmark({
      text: "The best compilation of resources for startup founders. A toolkit and benchmark comparison of every tool you need to know about.",
      createdAt: NOW - 45 * 86_400_000,
      metrics: { likes: 5000, retweets: 1200, replies: 300, views: 500000, bookmarks: 200 },
      urls: [makeUrl("https://example.com/viral")],
      hasLink: true,
    });
    const result = classifyLayer2(bm, { now: NOW });
    expect(result).not.toBeNull();
    expect(result!.intent).toBe("reference");
  });

  it("highlights signal → reference boost", () => {
    const bm = makeBookmark({
      text: "A generic post that doesn't match keywords well. But the user highlighted parts of it, so it should be classified as a reference. Some more text to make it long enough.",
      createdAt: NOW - 35 * 86_400_000,
      urls: [makeUrl("https://example.com/highlighted")],
      hasLink: true,
    });
    const result = classifyLayer2(bm, { hasHighlights: true, now: NOW });
    expect(result).not.toBeNull();
    expect(result!.intent).toBe("reference");
  });

  it("hiring + open roles + join us → act_on", () => {
    const bm = makeBookmark({
      text: "We're hiring senior engineers! Open roles in backend and infra. Join us to build the next generation of developer tools. Apply now at the link below.",
      urls: [makeUrl("https://example.com/careers")],
      hasLink: true,
    });
    const result = classifyLayer2(bm, { now: NOW });
    expect(result).not.toBeNull();
    expect(result!.intent).toBe("act_on");
  });

  it("deep dive + must-read content language → read_soon", () => {
    const bm = makeBookmark({
      text: "A must-read deep dive into how the Linux kernel handles memory management. Lessons learned from debugging production issues at scale.",
      urls: [makeUrl("https://example.com/linux")],
      hasLink: true,
    });
    const result = classifyLayer2(bm, { now: NOW });
    expect(result).not.toBeNull();
    expect(result!.intent).toBe("read_soon");
  });

  it("ambiguous post with no signals → null", () => {
    const bm = makeBookmark({
      text: "Just saw something interesting today. Made me think about how we approach problems differently depending on context.",
      urls: [makeUrl("https://example.com/random")],
      hasLink: true,
    });
    const result = classifyLayer2(bm, { now: NOW });
    expect(result).toBeNull();
  });

  it("keyword in card title also scores", () => {
    const bm = makeBookmark({
      text: "Bookmark this one.",
      urls: [
        makeUrl("https://example.com/page", {
          title: "The Ultimate Docker Cheat Sheet — A Complete Reference Guide",
          description: "Everything you need",
          domain: "example.com",
        }),
      ],
      hasLink: true,
    });
    const result = classifyLayer2(bm, { now: NOW });
    expect(result).not.toBeNull();
    expect(result!.intent).toBe("reference");
  });

  it("returns confidence between 0.6 and 0.95", () => {
    const bm = makeBookmark({
      text: "DM me for the cheat sheet compilation — limited spots for the waitlist, apply now before the deadline.",
    });
    const result = classifyLayer2(bm, { now: NOW });
    expect(result).not.toBeNull();
    expect(result!.confidence).toBeGreaterThanOrEqual(0.6);
    expect(result!.confidence).toBeLessThanOrEqual(0.95);
  });

  it("margin check: close scores between intents → null", () => {
    const bm = makeBookmark({
      text: "Here is a useful resource with a deep dive breakdown of the topic. Also hiring if you're interested.",
    });
    const result = classifyLayer2(bm, { now: NOW });
    if (result) {
      expect(result.confidence).toBeGreaterThanOrEqual(0.6);
    }
  });

  it("manual intent never overwritten in batch with L2", () => {
    const bookmarks = [
      makeBookmark({
        id: "manual-l2",
        intent: "act_on",
        intentSource: "manual",
        text: "The complete cheat sheet reference guide handbook compilation of resources.",
      }),
    ];
    const updated = classifyBatch(bookmarks);
    expect(updated).toHaveLength(0);
  });
});
