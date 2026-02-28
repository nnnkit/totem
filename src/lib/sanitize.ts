import type { Bookmark, ArticleContent, QuotedTweet, TweetUrl } from "../types";
import { decodeHtmlEntities } from "./text";

function sanitizeAuthor(author: Bookmark["author"]): void {
  author.name = decodeHtmlEntities(author.name);
  if (author.bio) author.bio = decodeHtmlEntities(author.bio);
}

function sanitizeArticle(article: ArticleContent): void {
  if (article.title) article.title = decodeHtmlEntities(article.title);
  article.plainText = decodeHtmlEntities(article.plainText);
  if (article.contentBlocks) {
    for (const block of article.contentBlocks) {
      block.text = decodeHtmlEntities(block.text);
    }
  }
}

function sanitizeUrls(urls: TweetUrl[]): void {
  for (const entry of urls) {
    if (entry.card) {
      if (entry.card.title) entry.card.title = decodeHtmlEntities(entry.card.title);
      if (entry.card.description) entry.card.description = decodeHtmlEntities(entry.card.description);
    }
  }
}

function sanitizeEmbeddedTweet(tweet: QuotedTweet): void {
  tweet.text = decodeHtmlEntities(tweet.text);
  sanitizeAuthor(tweet.author);
  if (tweet.urls) sanitizeUrls(tweet.urls);
  if (tweet.article) sanitizeArticle(tweet.article);
}

export function sanitizeBookmark(bookmark: Bookmark): void {
  bookmark.text = decodeHtmlEntities(bookmark.text);
  sanitizeAuthor(bookmark.author);
  sanitizeUrls(bookmark.urls);
  if (bookmark.article) sanitizeArticle(bookmark.article);
  if (bookmark.quotedTweet) sanitizeEmbeddedTweet(bookmark.quotedTweet);
  if (bookmark.retweetedTweet) sanitizeEmbeddedTweet(bookmark.retweetedTweet);
}
