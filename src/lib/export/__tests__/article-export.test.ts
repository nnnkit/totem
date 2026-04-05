import { describe, expect, it } from "vitest";
import type { ArticleContent } from "../../../types";
import {
  articleToMarkdown,
  hasExportableArticle,
} from "../article-to-markdown";
import type { Bookmark, ThreadTweet } from "../../../types";
import { slugifyArticleBasename } from "../article-filename";
import { suggestedArticleFilename } from "../article-download";
import { articleToPrintDocumentHtml } from "../article-to-print-html";
import {
  buildSyntheticExportPlainText,
  resolveReaderExportArticle,
} from "../tweet-export";

describe("hasExportableArticle", () => {
  it("returns false for empty article", () => {
    expect(hasExportableArticle(null)).toBe(false);
    expect(hasExportableArticle(undefined)).toBe(false);
    expect(hasExportableArticle({ plainText: "", contentBlocks: [] })).toBe(false);
  });

  it("returns true when plainText or blocks exist", () => {
    expect(hasExportableArticle({ plainText: "Hello" })).toBe(true);
    expect(
      hasExportableArticle({
        plainText: "",
        contentBlocks: [{ type: "unstyled", text: "x", inlineStyleRanges: [], entityRanges: [], depth: 0 }],
      }),
    ).toBe(true);
  });
});

describe("articleToMarkdown", () => {
  it("serializes plain article without blocks or headings", () => {
    const article: ArticleContent = {
      title: "Hello",
      plainText: "First paragraph.\n\nSecond paragraph with https://example.com path.",
      coverImageUrl: "",
    };
    const md = articleToMarkdown(article);
    expect(md).toContain("# Hello");
    expect(md).toContain("[https://example.com](https://example.com)");
  });

  it("omits cover when it matches author avatar", () => {
    const article: ArticleContent = {
      plainText: "Body",
      coverImageUrl: "https://pbs.twimg.com/profile_images/abc/x_normal.jpg",
    };
    const md = articleToMarkdown(article, {
      authorProfileImageUrl: "https://pbs.twimg.com/profile_images/abc/x_normal.jpg",
    });
    expect(md).not.toContain("![](");
    expect(md).toContain("Body");
  });

  it("serializes content blocks with list and heading", () => {
    const article: ArticleContent = {
      title: "T",
      plainText: "",
      contentBlocks: [
        {
          type: "header-one",
          text: "Section",
          inlineStyleRanges: [],
          entityRanges: [],
          depth: 0,
        },
        {
          type: "unordered-list-item",
          text: "One",
          inlineStyleRanges: [],
          entityRanges: [],
          depth: 0,
        },
        {
          type: "unordered-list-item",
          text: "Two",
          inlineStyleRanges: [],
          entityRanges: [],
          depth: 0,
        },
      ],
      entityMap: {},
    };
    const md = articleToMarkdown(article);
    expect(md).toContain("## Section");
    expect(md).toContain("- One");
    expect(md).toContain("- Two");
  });

  it("includes YAML front matter when metadata is provided", () => {
    const article: ArticleContent = { plainText: "Hi" };
    const md = articleToMarkdown(article, {
      metadata: {
        postUrl: "https://x.com/u/status/1",
        exportedAtLabel: "Jan 1",
        authorName: "A",
        authorHandle: "b",
      },
    });
    expect(md).toContain("---");
    expect(md).toContain("source: https://x.com/u/status/1");
    expect(md).toContain("exported:");
    expect(md).toContain("author:");
    expect(md).toContain("A (@b)");
  });
});

const minimalBookmark = (overrides: Partial<Bookmark>): Bookmark => ({
  id: "1",
  tweetId: "tid",
  text: "",
  createdAt: 0,
  sortIndex: "0",
  bookmarked: true,
  author: {
    name: "A",
    screenName: "a",
    profileImageUrl: "",
    verified: false,
  },
  metrics: {
    likes: 0,
    retweets: 0,
    replies: 0,
    views: 0,
    bookmarks: 0,
  },
  media: [],
  urls: [],
  isThread: false,
  hasImage: false,
  hasVideo: false,
  hasLink: false,
  quotedTweet: null,
  ...overrides,
});

describe("resolveReaderExportArticle", () => {
  it("uses long-form article when present and non-empty", () => {
    const article = { plainText: "Article body", title: "T" };
    const bm = minimalBookmark({ article });
    expect(resolveReaderExportArticle(bm, [])).toBe(article);
  });

  it("builds synthetic plain text from tweet when no article", () => {
    const bm = minimalBookmark({
      text: "Hello world",
      urls: [],
    });
    const ac = resolveReaderExportArticle(bm, []);
    expect(ac.plainText).toContain("Hello world");
    expect(ac.title).toBe("Hello world");
  });

  it("appends thread tweets after focal", () => {
    const bm = minimalBookmark({
      tweetId: "1",
      text: "First",
      urls: [],
    });
    const thread: ThreadTweet[] = [
      {
        tweetId: "1",
        text: "First",
        createdAt: 1,
        author: bm.author,
        media: [],
        urls: [],
      },
      {
        tweetId: "2",
        text: "Second",
        createdAt: 2,
        author: { ...bm.author, screenName: "b", name: "B" },
        media: [],
        urls: [],
      },
    ];
    const plain = buildSyntheticExportPlainText(bm, thread);
    expect(plain).toContain("First");
    expect(plain).toContain("@b");
    expect(plain).toContain("Second");
  });
});

describe("slugifyArticleBasename", () => {
  it("kebab-cases titles with spaces for save-as-pdf default name", () => {
    const article: ArticleContent = {
      title: "Guide to the Bloomberg Terminal",
      plainText: "x",
    };
    expect(slugifyArticleBasename(article)).toBe("guide-to-the-bloomberg-terminal");
    expect(suggestedArticleFilename(article, "pdf")).toBe(
      "guide-to-the-bloomberg-terminal.pdf",
    );
  });
});

describe("articleToPrintDocumentHtml", () => {
  it("produces valid html with slug document title and visible h1", () => {
    const article: ArticleContent = {
      title: "Doc",
      plainText: "Line one.",
    };
    const html = articleToPrintDocumentHtml(article);
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<title>doc</title>");
    expect(html).toContain("<h1>Doc</h1>");
    expect(html).toContain("<p>");
  });

  it("marks cover figure for print sizing", () => {
    const article: ArticleContent = {
      title: "T",
      plainText: "Body",
      coverImageUrl: "https://example.com/cover.jpg",
    };
    const html = articleToPrintDocumentHtml(article);
    expect(html).toContain('class="print-cover"');
  });
});
