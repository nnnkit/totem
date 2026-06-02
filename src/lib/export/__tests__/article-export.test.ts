import { describe, expect, it } from "vitest";
import type { ArticleContent, ArticleContentEntity } from "../../../types";
import {
  articleToAgentMarkdown,
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
import { resolveArticleCoverImageUrl } from "../article-cover";
import { splitPlainTextByHeadings } from "../article-heading-chunks";
import {
  escapeMarkdownPlain,
  wrapInlineCode,
  wrapItalic,
} from "../article-plain-markdown";
import { renderBlockInlineMarkdown } from "../block-inline-markdown";
import { detectArticleHeadings } from "../../../components/reader/utils";

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

describe("articleToAgentMarkdown", () => {
  it("keeps source metadata but skips exported timestamp and cover image", () => {
    const md = articleToAgentMarkdown(
      {
        title: "Agent context",
        plainText: "Body",
        coverImageUrl: "https://example.com/cover.jpg",
      },
      {
        metadata: {
          postUrl: "https://x.com/u/status/1",
          exportedAtLabel: "Jan 1",
          authorName: "A",
          authorHandle: "b",
        },
      },
    );

    expect(md).toContain("# Agent context");
    expect(md).toContain("Source: https://x.com/u/status/1");
    expect(md).toContain("Author: A (@b)");
    expect(md).not.toContain("exported:");
    expect(md).not.toContain("---");
    expect(md).not.toContain("cover.jpg");
  });

  it("reduces media and repeated source links to agent-useful text", () => {
    const md = articleToAgentMarkdown(
      {
        plainText:
          "Diagram\n\n![A system diagram](https://example.com/diagram.jpg)\n\n![Image attached to @a's post](https://example.com/photo.jpg)\n\n[Watch on X](https://x.com/a/status/1)",
      },
      {
        metadata: {
          postUrl: "https://x.com/a/status/1",
          authorName: "A",
          authorHandle: "a",
        },
      },
    );

    expect(md).toContain("Media: A system diagram");
    expect(md).not.toContain("diagram.jpg");
    expect(md).not.toContain("photo.jpg");
    expect(md).not.toContain("[Watch on X]");
  });

  it("simplifies markdown links whose label is the same URL", () => {
    const md = articleToAgentMarkdown({
      plainText: "Read [https://example.com](https://example.com) today.",
    });

    expect(md).toContain("Read https://example.com today.");
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
    expect(ac.coverImageUrl).toBeUndefined();
  });

  it("uses media alt text in synthetic Markdown image output", () => {
    const bm = minimalBookmark({
      text: "Diagram",
      urls: [],
      media: [
        {
          type: "photo",
          url: "https://example.com/diagram.jpg",
          width: 1200,
          height: 800,
          altText: "A system diagram",
        },
      ],
    });

    const text = buildSyntheticExportPlainText(bm, []);

    expect(text).toContain("![A system diagram](https://example.com/diagram.jpg)");
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
    const plain = buildSyntheticExportPlainText(bm, thread, true);
    expect(plain).toContain("First");
    expect(plain).toContain("@b");
    expect(plain).toContain("Second");
  });

  it("omits thread from synthetic export unless includeThread is true", () => {
    const bm = minimalBookmark({
      tweetId: "1",
      text: "Focal only",
      urls: [],
    });
    const thread: ThreadTweet[] = [
      {
        tweetId: "1",
        text: "Focal only",
        createdAt: 1,
        author: bm.author,
        media: [],
        urls: [],
      },
      {
        tweetId: "2",
        text: "Thread reply",
        createdAt: 2,
        author: bm.author,
        media: [],
        urls: [],
      },
    ];
    expect(buildSyntheticExportPlainText(bm, thread)).toBe("Focal only");
    expect(buildSyntheticExportPlainText(bm, thread, true)).toContain("Thread reply");
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

  it("does not leave a trailing dash after truncating long titles", () => {
    const article: ArticleContent = {
      title: "a ".repeat(90),
      plainText: "x",
    };
    expect(slugifyArticleBasename(article).endsWith("-")).toBe(false);
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

  it("drops javascript: URLs from cover and metadata", () => {
    const article: ArticleContent = {
      title: "T",
      plainText: "Body",
      coverImageUrl: "javascript:alert(1)",
    };
    const html = articleToPrintDocumentHtml(article, {
      metadata: {
        postUrl: "javascript:alert(2)",
        authorHandle: "safe",
      },
    });
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain('class="print-cover"');
    expect(html).toContain("@safe");
  });

  it("sanitizes MEDIA entity image and postUrl in content blocks", () => {
    const entityMap: Record<string, ArticleContentEntity> = {
      "0": {
        type: "MEDIA",
        data: { imageUrl: "javascript:nope", videoUrl: "https://cdn/x.mp4" },
      },
    };
    const article: ArticleContent = {
      plainText: "",
      contentBlocks: [
        {
          type: "atomic",
          text: "",
          inlineStyleRanges: [],
          entityRanges: [{ offset: 0, length: 1, key: 0 }],
          depth: 0,
        },
      ],
      entityMap,
    };
    const html = articleToPrintDocumentHtml(article, {
      metadata: { postUrl: "javascript:alert(1)" },
    });
    expect(html).not.toContain("javascript:");
    expect(html).toContain("use the source link above");
  });
});

describe("resolveArticleCoverImageUrl", () => {
  it("returns empty when cover is missing", () => {
    expect(resolveArticleCoverImageUrl(undefined, undefined)).toBe("");
    expect(resolveArticleCoverImageUrl("", "x")).toBe("");
  });

  it("drops cover when it is a profile avatar URL", () => {
    expect(
      resolveArticleCoverImageUrl(
        "https://pbs.twimg.com/profile_images/abc/x_normal.jpg",
        undefined,
      ),
    ).toBe("");
  });

  it("drops cover when it matches the author avatar ignoring size suffix", () => {
    expect(
      resolveArticleCoverImageUrl(
        "https://pbs.twimg.com/profile_images/abc/x_bigger.jpg",
        "https://pbs.twimg.com/profile_images/abc/x_normal.jpg",
      ),
    ).toBe("");
  });

  it("keeps cover when it is a distinct image", () => {
    expect(
      resolveArticleCoverImageUrl(
        "https://example.com/cover.jpg",
        "https://pbs.twimg.com/profile_images/abc/x.jpg",
      ),
    ).toBe("https://example.com/cover.jpg");
  });
});

describe("splitPlainTextByHeadings", () => {
  it("returns a single chunk with no heading when headings is empty", () => {
    const chunks = splitPlainTextByHeadings("Line a\nLine b", []);
    expect(chunks).toEqual([{ heading: undefined, text: "Line a\nLine b" }]);
  });

  it("splits body text into chunks keyed by heading index", () => {
    const plain = "Intro one\nIntro two\nSection A\nBody of A\nSection B\nBody of B";
    const chunks = splitPlainTextByHeadings(plain, [
      { index: 2, text: "Section A" },
      { index: 4, text: "Section B" },
    ]);
    expect(chunks).toEqual([
      { heading: undefined, text: "Intro one\nIntro two" },
      { heading: "Section A", text: "Body of A" },
      { heading: "Section B", text: "Body of B" },
    ]);
  });
});

describe("escapeMarkdownPlain", () => {
  it("escapes backslashes, backticks, emphasis, and brackets", () => {
    expect(escapeMarkdownPlain("a\\b`c*d_e[f]g")).toBe(
      "a\\\\b\\`c\\*d\\_e\\[f\\]g",
    );
  });

  it("does not touch ordinary characters", () => {
    expect(escapeMarkdownPlain("hello world")).toBe("hello world");
  });
});

describe("wrapInlineCode", () => {
  it("wraps in single backticks when safe", () => {
    expect(wrapInlineCode("x = 1")).toBe("`x = 1`");
  });

  it("escalates fence length when content contains backticks", () => {
    expect(wrapInlineCode("a `b` c")).toBe("`` a `b` c ``");
  });

  it("keeps escalating until the fence does not appear inside", () => {
    expect(wrapInlineCode("x `` y")).toBe("``` x `` y ```");
  });
});

describe("wrapItalic", () => {
  it("uses asterisks by default", () => {
    expect(wrapItalic("hi")).toBe("*hi*");
  });

  it("switches to underscores when content already contains *", () => {
    expect(wrapItalic("a*b")).toBe("_a*b_");
  });

  it("switches to asterisks when content already contains _", () => {
    expect(wrapItalic("a_b")).toBe("*a_b*");
  });

  it("falls back to <em> when both delimiters are present", () => {
    expect(wrapItalic("a*b_c")).toBe("<em>a*b_c</em>");
  });
});

describe("renderBlockInlineMarkdown", () => {
  it("applies bold, italic, and inline code", () => {
    const md = renderBlockInlineMarkdown(
      {
        type: "unstyled",
        text: "bold italic code",
        inlineStyleRanges: [
          { offset: 0, length: 4, style: "BOLD" },
          { offset: 5, length: 6, style: "ITALIC" },
          { offset: 12, length: 4, style: "CODE" },
        ],
        entityRanges: [],
        depth: 0,
      },
      {},
    );
    expect(md).toBe("**bold** *italic* `code`");
  });

  it("wraps a LINK entity around the styled segment", () => {
    const entityMap: Record<string, ArticleContentEntity> = {
      "0": { type: "LINK", data: { url: "https://example.com" } },
    };
    const md = renderBlockInlineMarkdown(
      {
        type: "unstyled",
        text: "Click here",
        inlineStyleRanges: [{ offset: 0, length: 5, style: "BOLD" }],
        entityRanges: [{ offset: 0, length: 5, key: 0 }],
        depth: 0,
      },
      entityMap,
    );
    expect(md).toBe("[**Click**](https://example.com) here");
  });
});

describe("buildSyntheticExportPlainText (same-author thread)", () => {
  const minimal: Bookmark = {
    id: "1",
    tweetId: "1",
    text: "Focal post",
    createdAt: 0,
    sortIndex: "0",
    bookmarked: true,
    author: { name: "A", screenName: "ankit", profileImageUrl: "", verified: false },
    metrics: { likes: 0, retweets: 0, replies: 0, views: 0, bookmarks: 0 },
    media: [],
    urls: [],
    isThread: true,
    hasImage: false,
    hasVideo: false,
    hasLink: false,
    quotedTweet: null,
  };

  it("uses --- separators and no per-entry attribution for same-author threads", () => {
    const thread: ThreadTweet[] = [
      {
        tweetId: "1",
        text: "Focal post",
        createdAt: 1,
        author: minimal.author,
        media: [],
        urls: [],
      },
      {
        tweetId: "2",
        text: "Second tweet",
        createdAt: 2,
        author: minimal.author,
        media: [],
        urls: [],
      },
    ];
    const plain = buildSyntheticExportPlainText(minimal, thread, true);
    expect(plain).toContain("Focal post\n\n---\n\nSecond tweet");
    expect(plain).not.toContain("@ankit");
    expect(plain).not.toContain("────────");
  });

  it("treats author handles as case-insensitive when dropping attribution", () => {
    const thread: ThreadTweet[] = [
      {
        tweetId: "2",
        text: "Reply",
        createdAt: 2,
        author: { ...minimal.author, screenName: "ANKIT" },
        media: [],
        urls: [],
      },
    ];
    const plain = buildSyntheticExportPlainText(minimal, thread, true);
    expect(plain).not.toContain("@ANKIT");
    expect(plain).toContain("Reply");
  });

  it("keeps attribution when a different author appears in the thread", () => {
    const thread: ThreadTweet[] = [
      {
        tweetId: "2",
        text: "Other reply",
        createdAt: 2,
        author: { ...minimal.author, screenName: "someoneelse", name: "Other" },
        media: [],
        urls: [],
      },
    ];
    const plain = buildSyntheticExportPlainText(minimal, thread, true);
    expect(plain).toContain("@someoneelse");
    expect(plain).toContain("Other reply");
  });
});

describe("articleToMarkdown edge cases", () => {
  it("returns an empty string when there is nothing to render", () => {
    expect(articleToMarkdown({ plainText: "" })).toBe("");
  });

  it("quotes YAML scalar values with unsafe characters", () => {
    const md = articleToMarkdown(
      { plainText: "Body" },
      {
        metadata: {
          postUrl: "https://x.com/u/status/1",
          authorName: "Name [bracketed]",
          authorHandle: "handle",
          exportedAtLabel: "2026-04-16, 11:30",
        },
      },
    );
    expect(md).toContain('author: "Name [bracketed] (@handle)"');
    expect(md).toContain('exported: "2026-04-16, 11:30"');
  });

  it("collapses newlines in YAML scalar values", () => {
    const md = articleToMarkdown(
      { plainText: "Body", title: "Line1\nLine2" },
      {
        metadata: {
          postUrl: "https://x.com/u/status/1",
          authorName: "Crash\r\nCarriage",
          authorHandle: "handle",
          exportedAtLabel: "first\nsecond",
        },
      },
    );
    expect(md).toContain('title: "Line1 Line2"');
    expect(md).toContain('author: "Crash Carriage (@handle)"');
    expect(md).toContain('exported: "first second"');
    expect(md).not.toMatch(/title: "[^"]*\n/);
    expect(md).not.toMatch(/exported: "[^"]*\n/);
  });
});

describe("detectArticleHeadings quotation filter", () => {
  const nextLineLong = "This is a much longer body line that follows the heading candidate.";

  it("keeps heading candidates containing an inline quoted word", () => {
    const plain = `Intro line\nThe "Problem" Space\n${nextLineLong}`;
    const headings = detectArticleHeadings(plain);
    expect(headings.some((h) => h.text === 'The "Problem" Space')).toBe(true);
  });

  it("drops a line that is fully wrapped in straight quotes", () => {
    const plain = `Intro\n"This is a pull quote"\n${nextLineLong}`;
    const headings = detectArticleHeadings(plain);
    expect(headings.some((h) => h.text.startsWith('"'))).toBe(false);
  });

  it("drops a line that is fully wrapped in curly quotes", () => {
    const plain = `Intro\n“Another pull quote”\n${nextLineLong}`;
    const headings = detectArticleHeadings(plain);
    expect(headings.some((h) => h.text.startsWith("“"))).toBe(false);
  });

  it("still drops lines containing backticks", () => {
    const plain = `Intro\nThe \`token\` line\n${nextLineLong}`;
    const headings = detectArticleHeadings(plain);
    expect(headings.some((h) => h.text.includes("`"))).toBe(false);
  });
});
