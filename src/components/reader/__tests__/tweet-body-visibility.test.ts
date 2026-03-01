import { describe, expect, it } from "vitest";
import type { ReaderTweet } from "../types";
import { resolveTweetBodyVisibility } from "../tweet-body-visibility";

function makeTweet(overrides: Partial<ReaderTweet> = {}): ReaderTweet {
  return {
    text: "tweet text",
    media: [],
    urls: [],
    ...overrides,
  };
}

describe("resolveTweetBodyVisibility", () => {
  it("suppresses main article when it duplicates quoted article content", () => {
    const article = {
      title: "Shipping CSS smarter",
      plainText: "Shipping CSS smarter with layered architecture",
      coverImageUrl: "https://example.com/cover.jpg",
      contentBlocks: [
        {
          type: "paragraph",
          text: "block",
          inlineStyleRanges: [],
          entityRanges: [],
          depth: 0,
        },
      ],
      entityMap: {},
    };

    const tweet = makeTweet({
      text: article.plainText,
      article,
      quotedTweet: {
        tweetId: "q1",
        text: "quoted text",
        createdAt: 1,
        author: {
          name: "Quoted",
          screenName: "quoted",
          profileImageUrl: "",
          verified: false,
        },
        media: [],
        urls: [],
        article: { ...article },
      },
    });

    const result = resolveTweetBodyVisibility(tweet, "article");
    expect(result).toEqual({ showArticle: false, showText: false });
  });

  it("hides duplicate text when article is rendered in article mode", () => {
    const article = {
      title: "A title",
      plainText: "same body text",
      coverImageUrl: "https://example.com/cover.jpg",
      contentBlocks: [],
      entityMap: {},
    };

    const tweet = makeTweet({
      text: article.plainText,
      article,
    });

    const result = resolveTweetBodyVisibility(tweet, "article");
    expect(result).toEqual({ showArticle: true, showText: false });
  });

  it("shows main text when duplicate quote suppression happens but text is unique", () => {
    const article = {
      title: "Shipping CSS smarter",
      plainText: "Shipping CSS smarter with layered architecture",
      coverImageUrl: "https://example.com/cover.jpg",
      contentBlocks: [],
      entityMap: {},
    };

    const tweet = makeTweet({
      text: "My short opinion on this",
      article,
      quotedTweet: {
        tweetId: "q2",
        text: "quoted text",
        createdAt: 1,
        author: {
          name: "Quoted",
          screenName: "quoted",
          profileImageUrl: "",
          verified: false,
        },
        media: [],
        urls: [],
        article: { ...article },
      },
    });

    const result = resolveTweetBodyVisibility(tweet, "article");
    expect(result).toEqual({ showArticle: false, showText: true });
  });

  it("shows both text and article when text adds context beyond article body", () => {
    const tweet = makeTweet({
      text: "My take on this article:",
      article: {
        title: "A title",
        plainText: "The article content",
        coverImageUrl: "",
        contentBlocks: [],
        entityMap: {},
      },
    });

    const result = resolveTweetBodyVisibility(tweet, "article");
    expect(result).toEqual({ showArticle: true, showText: true });
  });

  it("shows text only when no article body is available", () => {
    const tweet = makeTweet();
    const result = resolveTweetBodyVisibility(tweet, "tweet");
    expect(result).toEqual({ showArticle: false, showText: true });
  });
});
