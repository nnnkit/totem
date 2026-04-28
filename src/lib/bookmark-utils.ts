import { compactPreview } from "./text";
import type { Bookmark } from "../types";
import {
  PICK_TITLE_MAX,
  PICK_EXCERPT_MAX,
  READING_WPM,
  ARTICLE_READING_WPM,
  MIN_READING_MINUTES,
} from "./constants";

export function toSingleLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function pickTitle(bookmark: Bookmark): string {
  const articleTitle = bookmark.article?.title?.trim();
  if (articleTitle) return articleTitle;
  return compactPreview(toSingleLine(bookmark.text), PICK_TITLE_MAX);
}

export function pickExcerpt(bookmark: Bookmark): string {
  const articleText = bookmark.article?.plainText?.trim();
  if (articleText) return compactPreview(articleText, PICK_EXCERPT_MAX);
  return compactPreview(toSingleLine(bookmark.text), PICK_EXCERPT_MAX);
}

/**
 * Body text suitable for a search-snippet line that complements the title row.
 *
 * - Articles: full plainText (title shows article.title separately).
 * - Tweets: the remainder of the body past the visible-title region. If the
 *   tweet is short enough to fit entirely in the title, returns "".
 *
 * The highlighter picks the best window inside this string, so callers don't
 * need to truncate themselves.
 */
export function pickSearchSnippet(bookmark: Bookmark): string {
  const articleText = bookmark.article?.plainText?.trim();
  if (articleText) return articleText;
  const text = toSingleLine(bookmark.text ?? "");
  if (text.length <= PICK_TITLE_MAX) return "";
  return text;
}

export function inferKindBadge(bookmark: Bookmark): string {
  if (bookmark.tweetKind === "article") return "Article";
  if (bookmark.tweetKind === "thread" || bookmark.isThread) return "Thread";
  if (bookmark.hasLink) return "Link";
  return "Post";
}

export function estimateReadingMinutes(bookmark: Bookmark): number {
  const tweetText = toSingleLine(bookmark.text);
  const articleText = toSingleLine(bookmark.article?.plainText ?? "");
  const quoteText = toSingleLine(bookmark.quotedTweet?.text ?? "");
  const fullText = toSingleLine(`${tweetText} ${articleText} ${quoteText}`);
  const words = fullText.length === 0 ? 0 : fullText.split(" ").length;

  let estimate = Math.ceil(words / READING_WPM);

  if (bookmark.isThread || bookmark.tweetKind === "thread") {
    estimate = Math.max(estimate, MIN_READING_MINUTES);
  }
  if (bookmark.article?.plainText) {
    const articleWords = articleText.length === 0 ? 0 : articleText.split(" ").length;
    estimate = Math.max(estimate, Math.ceil(articleWords / ARTICLE_READING_WPM), MIN_READING_MINUTES);
  }
  if (bookmark.hasLink) {
    estimate = Math.max(estimate, MIN_READING_MINUTES);
  }

  return Math.max(1, estimate);
}

