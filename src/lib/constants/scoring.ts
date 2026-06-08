/**
 * Per-field BM25 boosts for the bookmark search engine.
 *
 * Tier order honors the user's stated priority:
 *   author identity > deliberate dense fields > body content.
 *
 * `tags` is highest of tier 2 because user-applied — strongest intent signal.
 * `domain` is high because `github.com` / `arxiv.org` is what people type when
 * they want a class of links.
 */
export const SEARCH_BOOSTS = {
  // tier 1 — author identity (username/name)
  screenName: 10,
  displayName: 8,
  // tier 2 — deliberate, dense (title)
  tags: 7,
  title: 5,
  hashtags: 4,
  domain: 3,
  // tier 3 — body content (description, excerpt, text)
  description: 2.5,
  excerpt: 2.5,
  tweetText: 2,
  // tier 4 — auxiliary content (quote/retweet bodies, alt-text)
  quotedText: 1.5,
  retweetedText: 1.5,
  articleText: 1.5,
  mediaAlt: 1,
  cardDescription: 1,
} as const;

/**
 * Tweet vs article BM25 parameters. Tweets are short and roughly equal length;
 * articles are long and varied. Splitting the params lets short fields
 * compete fairly against article bodies in the same query.
 */
export const SEARCH_BM25 = {
  short: { k1: 0.5, b: 0 }, // screenName, displayName, tags, title, domain, hashtags
  tweet: { k1: 0.9, b: 0.5 }, // tweetText
  long: { k1: 1.2, b: 0.75 }, // excerpt, description, articleText, cardDescription
} as const;

/** Snippet windows (in tokens) per field for highlighting. */
export const SNIPPET_TOKENS = {
  short: 999, // full string for handle/name/tag/title-like fields
  title: 30,
  body: 30,
} as const;

export const RELATED_WEIGHTS = {
  sameAuthor: 4,
  sameKind: 2,
  bothArticle: 1,
  bothMedia: 1,
  tokenOverlapCap: 3,
  randomBoost: 2,
  minTokenLength: 4,
} as const;

export const TODAY_QUEUE = {
  version: 1,
  size: 5,
  freshWindowMs: 72 * 60 * 60 * 1000,
  neglectedAfterMs: 14 * 24 * 60 * 60 * 1000,
  exposureWindowMs: 7 * 24 * 60 * 60 * 1000,
  maxQueuedExposureWithoutEngagement: 3,
} as const;

export const TODAY_QUEUE_WEIGHTS = {
  readSoon: 80,
  inProgress: 70,
  pinned: 55,
  freshness: 35,
  neglected: 30,
  budgetFit: 24,
  budgetOverrunPenalty: 12,
  queuedExposurePenalty: 12,
  highlightOrNote: 8,
} as const;
