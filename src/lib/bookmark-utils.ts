import { compactPreview } from "./text";
import type { Bookmark } from "../types";

export function toSingleLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function pickTitle(bookmark: Bookmark): string {
  const articleTitle = bookmark.article?.title?.trim();
  if (articleTitle) return articleTitle;
  return compactPreview(toSingleLine(bookmark.text), 92);
}

export function pickExcerpt(bookmark: Bookmark): string {
  const articleText = bookmark.article?.plainText?.trim();
  if (articleText) return compactPreview(articleText, 210);
  return compactPreview(toSingleLine(bookmark.text), 210);
}

export function estimateReadingMinutes(bookmark: Bookmark): number {
  const tweetText = toSingleLine(bookmark.text);
  const articleText = toSingleLine(bookmark.article?.plainText ?? "");
  const quoteText = toSingleLine(bookmark.quotedTweet?.text ?? "");
  const fullText = toSingleLine(`${tweetText} ${articleText} ${quoteText}`);
  const words = fullText.length === 0 ? 0 : fullText.split(" ").length;

  let estimate = Math.ceil(words / 180);

  if (bookmark.isThread || bookmark.tweetKind === "thread") {
    estimate = Math.max(estimate, 2);
  }
  if (bookmark.article?.plainText) {
    const articleWords = articleText.length === 0 ? 0 : articleText.split(" ").length;
    estimate = Math.max(estimate, Math.ceil(articleWords / 200), 2);
  }
  if (bookmark.hasLink) {
    estimate = Math.max(estimate, 2);
  }

  return Math.max(1, estimate);
}


