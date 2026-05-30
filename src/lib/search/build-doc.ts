import type { Bookmark } from "../../types";

/**
 * The shape passed to MiniSearch. Every field is a primitive string
 * or string array so the index serializes cleanly to JSON.
 */
export interface SearchableBookmark {
  id: string;
  screenName: string;
  displayName: string;
  title: string;
  /** First paragraph / continuation of body that wasn't consumed by `title`. */
  excerpt: string;
  /** Joined OG card descriptions. */
  description: string;
  /** Full tweet text (kept distinct from excerpt for BM25 length-normalization). */
  tweetText: string;
  /** Parsed article body (when bookmark.article is present). */
  articleText: string;
  /** Joined OG card titles. */
  cardDescription: string;
  /** First URL's host, lowercased, without `www.`. */
  domain: string;
  hashtags: string[];
  mentions: string[];
  /** Quoted tweet body, when bookmark.quotedTweet exists. */
  quotedText: string;
  /** Retweet source body, when bookmark.retweetedTweet exists. */
  retweetedText: string;
  /** Joined alt-text from media (image OCR-light). */
  mediaAlt: string;
  /** Timestamp the bookmark was created/saved (ms). */
  createdAt: number;
  /** Last reader-open timestamp (ms). Optional — populated only when signals are provided. */
  lastReadAt?: number;
  /** Number of times the user has reopened this bookmark (default 0). */
  reopenCount?: number;
}

/** Optional per-bookmark signals attached at index time. */
export interface BookmarkSignals {
  lastReadAt?: number;
  reopenCount?: number;
}

const SENTENCE_BOUNDARY = /[.!?]\s+/;
const TITLE_MAX = 100;
const EXCERPT_MAX = 280;

function deriveTitleAndRest(b: Bookmark): { title: string; rest: string } {
  if (b.article?.title) {
    return { title: b.article.title.trim(), rest: "" };
  }
  const text = b.text ?? "";
  const match = text.match(SENTENCE_BOUNDARY);
  if (match && match.index != null && match.index <= TITLE_MAX) {
    const cut = match.index + match[0].length;
    return {
      title: text.slice(0, match.index + 1).trim(),
      rest: text.slice(cut).trim(),
    };
  }
  if (text.length <= TITLE_MAX) {
    return { title: text.trim(), rest: "" };
  }
  return {
    title: text.slice(0, TITLE_MAX).trim(),
    rest: text.slice(TITLE_MAX).trim(),
  };
}

function deriveExcerpt(b: Bookmark, restOfText: string): string {
  const article = b.article?.plainText?.trim();
  if (article) {
    return article.slice(0, EXCERPT_MAX);
  }
  return restOfText;
}

function deriveDomain(b: Bookmark): string {
  const url = b.urls[0]?.expandedUrl ?? b.urls[0]?.url;
  if (!url) return "";
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function joinCardDescriptions(b: Bookmark): string {
  const parts: string[] = [];
  for (const u of b.urls) {
    if (u.card?.description) parts.push(u.card.description);
  }
  return parts.join(" ");
}

function joinCardTitles(b: Bookmark): string {
  const parts: string[] = [];
  for (const u of b.urls) {
    if (u.card?.title) parts.push(u.card.title);
  }
  return parts.join(" ");
}

const HASHTAG_RE = /#([\p{L}\p{N}_]+)/gu;
const MENTION_RE = /@([\p{L}\p{N}_]+)/gu;

function extractEntities(text: string): {
  hashtags: string[];
  mentions: string[];
} {
  const hashtags: string[] = [];
  const mentions: string[] = [];
  for (const m of text.matchAll(HASHTAG_RE)) hashtags.push(m[1].toLowerCase());
  for (const m of text.matchAll(MENTION_RE)) mentions.push(m[1].toLowerCase());
  return { hashtags, mentions };
}

export function toSearchableBookmark(
  b: Bookmark,
  signals?: BookmarkSignals,
): SearchableBookmark {
  const { title, rest } = deriveTitleAndRest(b);
  const { hashtags, mentions } = extractEntities(b.text ?? "");
  const mediaAltParts: string[] = [];
  for (const media of b.media) {
    const altText = media.altText?.trim();
    if (altText) mediaAltParts.push(altText);
  }
  const mediaAlt = mediaAltParts.join(" ");
  return {
    id: b.tweetId,
    screenName: b.author.screenName,
    displayName: b.author.name,
    title,
    excerpt: deriveExcerpt(b, rest),
    description: joinCardDescriptions(b),
    tweetText: b.text ?? "",
    articleText: b.article?.plainText ?? "",
    cardDescription: joinCardTitles(b),
    domain: deriveDomain(b),
    hashtags,
    mentions,
    quotedText: b.quotedTweet?.text ?? "",
    retweetedText: b.retweetedTweet?.text ?? "",
    mediaAlt,
    createdAt: b.createdAt,
    lastReadAt: signals?.lastReadAt,
    reopenCount: signals?.reopenCount,
  };
}
