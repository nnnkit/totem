import { describe, expect, it } from "vitest";
import type { Bookmark, QuotedTweet, ThreadTweet } from "../../../types";
import { optimizeMarkdownForAgent } from "../agent-markdown-optimizer";
import {
  pollToMarkdown,
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

// Values below are trimmed from real Search/TweetDetail payloads.
describe("polls, video links and reply context", () => {
  it("renders a closed poll with counts and percentages", () => {
    expect(
      pollToMarkdown({
        choices: [
          { label: "BOYNEXTDOOR", count: 1034 },
          { label: "SOYEON", count: 10 },
          { label: "ALLDAY PROJECT", count: 20 },
        ],
        ended: true,
        endsAt: "2026-10-04T11:28:08Z",
      }),
    ).toBe(
      [
        "**Poll** · 1,064 votes · Final results",
        "",
        "- BOYNEXTDOOR — 1,034 votes (97.2%)",
        "- SOYEON — 10 votes (0.9%)",
        "- ALLDAY PROJECT — 20 votes (1.9%)",
      ].join("\n"),
    );
  });

  it("renders an open poll with no votes yet and its end time in UTC", () => {
    const poll = {
      choices: [
        { label: "deepseek v4.1 flash", count: 0 },
        { label: "none, chatgpt for life", count: 0 },
      ],
      ended: false,
      endsAt: "2026-10-19T07:10:47Z",
    };
    expect(pollToMarkdown(poll, Date.parse("2026-10-18T07:31:07Z"))).toBe(
      [
        "**Poll** · 0 votes · Ends Oct 19, 2026, 07:10 UTC",
        "",
        "- deepseek v4.1 flash — 0 votes (0.0%)",
        "- none, chatgpt for life — 0 votes (0.0%)",
      ].join("\n"),
    );
    expect(pollToMarkdown(poll, Date.parse("2026-10-20T00:00:00Z"))).toContain(
      "Ended Oct 19, 2026, 07:10 UTC",
    );
  });

  it("escapes poll labels that would start a list or heading", () => {
    const md = pollToMarkdown({
      choices: [
        { label: "1. yes", count: 1 },
        { label: "# no", count: 1 },
      ],
      ended: true,
    });
    expect(md).toContain("- 1\\. yes — 1 vote (50.0%)");
    expect(md).toContain("- \\# no — 1 vote (50.0%)");
  });

  it("puts the poll after the post text, inside quotes too", () => {
    const poll = { choices: [{ label: "A", count: 1 }, { label: "B", count: 3 }], ended: true };
    const quoted: QuotedTweet = {
      tweetId: "2", text: "Pick one", createdAt: 0, author: bob, media: [], poll,
    };
    const md = tweetNodeToMarkdown(bookmark({ text: "Look", quotedTweet: quoted }));
    expect(md).toContain("> Pick one\n>\n> **Poll** · 4 votes · Final results\n>\n> - A — 1 vote (25.0%)");
  });

  it("adds a direct MP4 link next to Watch on X", () => {
    const md = tweetNodeToMarkdown(
      bookmark({
        tweetId: "2104937926593487309",
        author: { ...author, screenName: "calebporzio" },
        media: [
          {
            type: "video",
            url: "https://pbs.twimg.com/amplify_video_thumb/2104936481328345088/img/vGaphvdi3ztmfSPe.jpg",
            videoUrl: "https://video.twimg.com/amplify_video/2104936481328345088/vid/avc1/1920x1080/TJa1R6h-zdqKlEv8.mp4?tag=29",
            width: 1920,
            height: 1080,
          },
        ],
      }),
    );
    expect(md).toContain(
      "[Watch on X](https://x.com/calebporzio/status/2104937926593487309) · [MP4](https://video.twimg.com/amplify_video/2104936481328345088/vid/avc1/1920x1080/TJa1R6h-zdqKlEv8.mp4?tag=29)",
    );
    expect(
      optimizeMarkdownForAgent(
        `---\nsource: https://x.com/calebporzio/status/2104937926593487309\n---\n${md}`,
      ),
    ).toContain("\n[MP4](https://video.twimg.com/");
  });

  it("says who a reply answers unless the parent is exported too", () => {
    const reply = bookmark({
      tweetId: "2087615755701653952",
      text: "fixed!",
      inReplyToTweetId: "2087579979181887989",
      inReplyToScreenName: "0xblacklight",
    });
    expect(tweetNodeToMarkdown(reply)).toBe(
      "Replying to [@0xblacklight](https://x.com/0xblacklight)\n\nfixed!",
    );
    const parent: ThreadTweet = {
      tweetId: "2087579979181887989",
      text: "broken link",
      createdAt: 500,
      author: { ...bob, screenName: "0xblacklight" },
      media: [],
      urls: [],
    };
    expect(tweetThreadToMarkdown(reply, [parent], reply.createdAt)).not.toContain("Replying to");
    expect(tweetNodeToMarkdown({ ...reply, inReplyToScreenName: "jane" })).toBe("fixed!");
  });

  it("does not repeat a card domain that doubles as its title", () => {
    const md = tweetNodeToMarkdown(
      bookmark({
        urls: [
          {
            url: "https://www.mahindra.com/mymahindrastory",
            displayUrl: "mahindra.com",
            expandedUrl: "https://www.mahindra.com/mymahindrastory",
            card: { title: "mahindra.com", domain: "mahindra.com", cardType: "unified_card" },
          },
        ],
      }),
    );
    expect(md).toBe("> [mahindra.com](https://www.mahindra.com/mymahindrastory)");
  });
});

describe("article embedded posts", () => {
  it("renders a TWEET entity as a quote link", () => {
    const md = articleToMarkdown({
      title: "/show-me",
      plainText: "The former CEO of reddit:",
      contentBlocks: [
        { type: "unstyled", text: "The former CEO of reddit:", inlineStyleRanges: [], entityRanges: [], depth: 0 },
        { type: "atomic", text: " ", inlineStyleRanges: [], entityRanges: [{ key: 2, length: 1, offset: 0 }], depth: 0 },
      ],
      entityMap: {
        "2": {
          type: "TWEET",
          data: { entityKey: "4db2e813-01fd-4240-a2c8-d2effc911a48", tweetId: "2086534431075098628" },
        },
      },
    });
    expect(md).toContain(
      "The former CEO of reddit:\n\n> [Embedded post on X](https://x.com/i/status/2086534431075098628)",
    );
  });
});

describe("article inline styles across line breaks", () => {
  it("closes and reopens bold at each newline inside a block", () => {
    // Trimmed from a real Article block whose Bold range spans "\n\n".
    const text =
      "Last thing, if you want me to continue doing these, I need your support.\n\nSo a like, a quote or a bookmark would help me continue 🙏";
    const md = articleToMarkdown({
      plainText: text,
      contentBlocks: [
        {
          type: "unstyled",
          text,
          inlineStyleRanges: [{ offset: 0, length: text.length, style: "Bold" }],
          entityRanges: [],
          depth: 0,
        },
      ],
    });
    expect(md).toContain(
      "**Last thing, if you want me to continue doing these, I need your support.**\n\n**So a like, a quote or a bookmark would help me continue 🙏**",
    );
  });
});
