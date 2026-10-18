import { describe, expect, it } from "vitest";
import type { Bookmark, QuotedTweet, ThreadTweet } from "../../../types";
import { optimizeMarkdownForAgent } from "../agent-markdown-optimizer";
import {
  tweetNodeToMarkdown,
  tweetTextToMarkdown,
  tweetThreadToMarkdown,
} from "../tweet-markdown";
import { resolveReaderExportArticle } from "../tweet-export";
import { articleToMarkdown } from "../article-to-markdown";

const author = { name: "Jane Doe", screenName: "jane", profileImageUrl: "", verified: false };
const bob = { name: "Bob", screenName: "bob", profileImageUrl: "", verified: false };

function bookmark(overrides: Partial<Bookmark>): Bookmark {
  return {
    id: "1",
    tweetId: "1",
    text: "",
    createdAt: 1000,
    sortIndex: "1",
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
    ...overrides,
  };
}

describe("tweetTextToMarkdown", () => {
  it("keeps single line breaks as hard breaks and never invents headings", () => {
    expect(tweetTextToMarkdown("Here's how:\n1/ Ship\n2/ Read\n\nDone.")).toBe(
      "Here's how:  \n1/ Ship  \n2/ Read\n\nDone.",
    );
  });

  it("escapes block-level syntax so the text renders as written", () => {
    expect(tweetTextToMarkdown("> nope\n# nope\n2024. year\n- dash\n<b>x</b>")).toBe(
      "\\> nope  \n\\# nope  \n2024\\. year  \n\\- dash  \n\\<b>x\\</b>",
    );
  });

  it("escapes separator lines so they don't become rules or setext headings", () => {
    expect(tweetTextToMarkdown("Title\n---\nmore\n===")).toBe("Title  \n\\---  \nmore  \n\\===");
  });

  it("links mentions with underscores, unicode hashtags and cashtags", () => {
    expect(tweetTextToMarkdown("hi @kevin_t_ngo #日本 #1 $TSLA a@b.com")).toBe(
      "hi [@kevin_t_ngo](https://x.com/kevin_t_ngo) [#日本](https://x.com/hashtag/%E6%97%A5%E6%9C%AC) #1 [\\$TSLA](https://x.com/search?q=%24TSLA) a@b.com",
    );
  });

  it("wraps URLs with markdown-sensitive characters in angle brackets", () => {
    expect(
      tweetTextToMarkdown("See https://en.wikipedia.org/wiki/Rust_(lang). Or https://example.com/a."),
    ).toBe("See <https://en.wikipedia.org/wiki/Rust_(lang)>. Or https://example.com/a.");
  });

  it("applies bold/italic ranges with whitespace outside the markers", () => {
    expect(
      tweetTextToMarkdown("Writing. 40% faster", [], [
        { start: 0, end: 8, style: "bold" },
        { start: 9, end: 13, style: "italic" },
      ]),
    ).toBe("**Writing.** *40%* faster");
  });

  it("drops a trailing card URL but keeps one in the middle of a sentence", () => {
    const urls = [
      { url: "https://t.co/a", displayUrl: "a.com", expandedUrl: "https://a.com", card: { title: "A" } },
    ];
    expect(tweetTextToMarkdown("read https://a.com", urls)).toBe("read");
    expect(tweetTextToMarkdown("by https://a.com 🙂", urls)).toBe("by https://a.com 🙂");
  });
});

describe("tweetNodeToMarkdown", () => {
  it("renders link cards as a quoted link block", () => {
    const md = tweetNodeToMarkdown(
      bookmark({
        text: "Great read https://example.com/post",
        urls: [
          {
            url: "https://t.co/abc",
            displayUrl: "example.com/post",
            expandedUrl: "https://example.com/post",
            card: { title: "The Post", description: "A description", domain: "example.com" },
          },
        ],
      }),
    );
    expect(md).toBe(
      "Great read\n\n> [The Post](https://example.com/post)  \n> A description  \n> example.com",
    );
  });

  it("renders quoted posts with author, link, text and media", () => {
    const quoted: QuotedTweet = {
      tweetId: "9",
      text: "Quoted body",
      createdAt: 0,
      author: bob,
      media: [{ type: "photo", url: "https://pbs.twimg.com/media/Q.jpg", width: 1, height: 1, altText: "a [chart]" }],
    };
    expect(tweetNodeToMarkdown(bookmark({ text: "This", quotedTweet: quoted }))).toBe(
      [
        "This",
        "",
        "> Quoting **Bob** ([@bob](https://x.com/bob/status/9))",
        ">",
        "> Quoted body",
        ">",
        "> ![a \\[chart\\]](https://pbs.twimg.com/media/Q.jpg?name=large)",
      ].join("\n"),
    );
  });

  it("keeps media-only quoted posts and video links", () => {
    const md = tweetNodeToMarkdown(
      bookmark({
        text: "lol",
        quotedTweet: {
          tweetId: "9",
          text: "",
          createdAt: 0,
          author: bob,
          media: [{ type: "video", url: "https://pbs.twimg.com/thumb.jpg", width: 1, height: 1 }],
        },
      }),
    );
    expect(md).toContain("> ![Video preview from @bob's post](https://pbs.twimg.com/thumb.jpg)");
    expect(md).toContain("> [Watch on X](https://x.com/bob/status/9)");
  });

  it("attributes reposts to the original author", () => {
    const md = tweetNodeToMarkdown(
      bookmark({
        text: "RT @bob: original",
        retweetedTweet: { tweetId: "9", text: "original", createdAt: 0, author: bob, media: [] },
      }),
    );
    expect(md).toBe("Reposted from **Bob** ([@bob](https://x.com/bob/status/9))\n\noriginal");
  });
});

describe("tweetThreadToMarkdown", () => {
  it("orders the conversation chronologically and labels authors when mixed", () => {
    const parent: ThreadTweet = {
      tweetId: "0",
      text: "parent",
      createdAt: 500,
      author: bob,
      media: [],
      urls: [],
    };
    const md = tweetThreadToMarkdown(bookmark({ text: "reply" }), [parent], 1000);
    expect(md).toBe(
      "**Bob** ([@bob](https://x.com/bob/status/0))\n\nparent\n\n---\n\n**Jane Doe** ([@jane](https://x.com/jane/status/1))\n\nreply",
    );
  });

  it("omits author labels for a single-author thread", () => {
    const next: ThreadTweet = { tweetId: "2", text: "two", createdAt: 2000, author, media: [], urls: [] };
    expect(tweetThreadToMarkdown(bookmark({ text: "one" }), [next], 1000)).toBe("one\n\n---\n\ntwo");
  });
});

describe("tweet export through articleToMarkdown", () => {
  it("does not repeat the first line as an H1", () => {
    const article = resolveReaderExportArticle(bookmark({ text: "Hook line\n\nBody." }), []);
    const md = articleToMarkdown(article, { metadata: { postUrl: "https://x.com/jane/status/1" } });
    expect(md).toContain('title: "Hook line"');
    expect(md).not.toContain("# Hook line");
    expect(md.endsWith("Hook line\n\nBody.\n")).toBe(true);
  });

  it("agent output drops generic media inside quotes but keeps described media", () => {
    const md = optimizeMarkdownForAgent(
      "> ![Image attached to @bob's post](https://x/a.jpg)\n> ![a \\[chart\\]](https://x/b.jpg)\n",
    );
    expect(md).toBe(">\n> Media: a [chart]\n");
  });
});
