import type {
  ArticleContent,
  Author,
  Bookmark,
  Media,
  QuotedTweet,
  ThreadTweet,
  TweetKind,
  TweetUrl,
} from "../../types";

export const SHARE_PAYLOAD_VERSION = 1;

export interface SharedAuthor {
  name: string;
  screenName: string;
  profileImageUrl?: string;
  verified?: boolean;
}

/**
 * Article bodies ship as plain text only. `contentBlocks` is by far the
 * largest field on a bookmark and the reader already falls back to
 * `plainText` when it is absent (see TweetArticle), so dropping it keeps
 * share links inside the URL length budget with no visible loss.
 */
export interface SharedArticle {
  title?: string;
  plainText: string;
  coverImageUrl?: string;
}

export interface SharedQuote {
  tweetId: string;
  text: string;
  createdAt: number;
  author: SharedAuthor;
  media?: Media[];
}

export interface SharedPost {
  tweetId: string;
  text: string;
  createdAt: number;
  author: SharedAuthor;
  media?: Media[];
  urls?: TweetUrl[];
  article?: SharedArticle;
  quotedTweet?: SharedQuote;
  retweetedTweet?: SharedQuote;
  tweetKind?: TweetKind;
  tweetDisplayType?: string;
  inReplyToTweetId?: string;
  inReplyToScreenName?: string;
}

export interface SharePayload {
  v: number;
  tweetId: string;
  focal: SharedPost;
  thread: SharedPost[];
}

function omitEmpty<T extends object>(value: T): T {
  const out = {} as Record<string, unknown>;
  for (const [key, entry] of Object.entries(value)) {
    if (entry === undefined || entry === null) continue;
    if (Array.isArray(entry) && entry.length === 0) continue;
    if (typeof entry === "string" && entry.length === 0) continue;
    out[key] = entry;
  }
  return out as T;
}

function toSharedAuthor(author: Author): SharedAuthor {
  return omitEmpty({
    name: author.name,
    screenName: author.screenName,
    profileImageUrl: author.profileImageUrl,
    verified: author.verified || undefined,
  });
}

function fromSharedAuthor(author: SharedAuthor | undefined): Author {
  return {
    name: author?.name ?? "",
    screenName: author?.screenName ?? "",
    profileImageUrl: author?.profileImageUrl ?? "",
    verified: Boolean(author?.verified),
  };
}

function toSharedArticle(article: ArticleContent | null | undefined): SharedArticle | undefined {
  if (!article) return undefined;
  const plainText = article.plainText?.trim() ?? "";
  if (!plainText && !article.title) return undefined;
  return omitEmpty({
    title: article.title,
    plainText,
    coverImageUrl: article.coverImageUrl,
  });
}

function fromSharedArticle(article: SharedArticle | undefined): ArticleContent | null {
  if (!article) return null;
  return omitEmpty({
    title: article.title,
    plainText: article.plainText ?? "",
    coverImageUrl: article.coverImageUrl,
  }) as ArticleContent;
}

function toSharedQuote(quote: QuotedTweet | null | undefined): SharedQuote | undefined {
  if (!quote) return undefined;
  return omitEmpty({
    tweetId: quote.tweetId,
    text: quote.text,
    createdAt: quote.createdAt,
    author: toSharedAuthor(quote.author),
    media: quote.media,
  });
}

function fromSharedQuote(quote: SharedQuote | undefined): QuotedTweet | null {
  if (!quote) return null;
  return {
    tweetId: quote.tweetId ?? "",
    text: quote.text ?? "",
    createdAt: quote.createdAt ?? 0,
    author: fromSharedAuthor(quote.author),
    media: quote.media ?? [],
  };
}

type ShareablePost = Pick<
  Bookmark,
  | "tweetId"
  | "text"
  | "createdAt"
  | "author"
  | "media"
  | "urls"
  | "tweetKind"
  | "tweetDisplayType"
  | "inReplyToTweetId"
  | "inReplyToScreenName"
> &
  Pick<Partial<Bookmark>, "article" | "quotedTweet" | "retweetedTweet">;

function toSharedPost(post: ShareablePost): SharedPost {
  return omitEmpty({
    tweetId: post.tweetId,
    text: post.text,
    createdAt: post.createdAt,
    author: toSharedAuthor(post.author),
    media: post.media,
    urls: post.urls,
    article: toSharedArticle(post.article),
    quotedTweet: toSharedQuote(post.quotedTweet),
    retweetedTweet: toSharedQuote(post.retweetedTweet),
    tweetKind: post.tweetKind,
    tweetDisplayType: post.tweetDisplayType,
    inReplyToTweetId: post.inReplyToTweetId,
    inReplyToScreenName: post.inReplyToScreenName,
  });
}

function hasMediaKind(media: Media[], kind: Media["type"]): boolean {
  return media.some((item) => item.type === kind);
}

export function buildSharePayload(
  focalTweet: Bookmark,
  thread: ThreadTweet[],
): SharePayload {
  return {
    v: SHARE_PAYLOAD_VERSION,
    tweetId: focalTweet.tweetId,
    focal: toSharedPost(focalTweet),
    thread: thread.map(toSharedPost),
  };
}

/**
 * Drops the heaviest optional fields, in increasing order of how much the
 * reader misses them. Callers re-encode after each step until the link fits.
 */
export const SHARE_PAYLOAD_TRIM_STEPS: Array<(payload: SharePayload) => SharePayload> = [
  (payload) => ({
    ...payload,
    focal: stripAltText(payload.focal),
    thread: payload.thread.map(stripAltText),
  }),
  (payload) => ({
    ...payload,
    focal: stripCards(payload.focal),
    thread: payload.thread.map(stripCards),
  }),
  (payload) => ({
    ...payload,
    focal: stripArticleBody(payload.focal),
    thread: payload.thread.map(stripArticleBody),
  }),
];

function stripAltText(post: SharedPost): SharedPost {
  if (!post.media?.length) return post;
  return {
    ...post,
    media: post.media.map(({ altText: _altText, ...rest }) => rest),
  };
}

function stripCards(post: SharedPost): SharedPost {
  if (!post.urls?.length) return post;
  return {
    ...post,
    urls: post.urls.map(({ card: _card, ...rest }) => rest as TweetUrl),
  };
}

function stripArticleBody(post: SharedPost): SharedPost {
  if (!post.article) return post;
  return { ...post, article: omitEmpty({ ...post.article, plainText: "" }) };
}

function fromSharedPost(post: SharedPost): Bookmark {
  const media = post.media ?? [];
  const urls = post.urls ?? [];
  return {
    id: post.tweetId,
    tweetId: post.tweetId,
    text: post.text ?? "",
    createdAt: post.createdAt ?? 0,
    sortIndex: "",
    bookmarked: false,
    author: fromSharedAuthor(post.author),
    metrics: { likes: 0, retweets: 0, replies: 0, views: 0, bookmarks: 0 },
    media,
    urls,
    isThread: post.tweetKind === "thread",
    hasImage: hasMediaKind(media, "photo"),
    hasVideo: hasMediaKind(media, "video") || hasMediaKind(media, "animated_gif"),
    hasLink: urls.length > 0,
    quotedTweet: fromSharedQuote(post.quotedTweet),
    retweetedTweet: fromSharedQuote(post.retweetedTweet) ?? undefined,
    article: fromSharedArticle(post.article),
    tweetKind: post.tweetKind,
    tweetDisplayType: post.tweetDisplayType,
    inReplyToTweetId: post.inReplyToTweetId,
    inReplyToScreenName: post.inReplyToScreenName,
  };
}

function toThreadTweet(post: SharedPost): ThreadTweet {
  const bookmark = fromSharedPost(post);
  return {
    tweetId: bookmark.tweetId,
    text: bookmark.text,
    createdAt: bookmark.createdAt,
    author: bookmark.author,
    media: bookmark.media,
    urls: bookmark.urls,
    article: bookmark.article ?? null,
    quotedTweet: bookmark.quotedTweet,
    retweetedTweet: bookmark.retweetedTweet ?? null,
    tweetKind: bookmark.tweetKind,
    tweetDisplayType: bookmark.tweetDisplayType,
    inReplyToTweetId: bookmark.inReplyToTweetId,
    inReplyToScreenName: bookmark.inReplyToScreenName,
    isThread: bookmark.isThread,
  };
}

export function isSharePayload(value: unknown): value is SharePayload {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<SharePayload>;
  if (candidate.v !== SHARE_PAYLOAD_VERSION) return false;
  if (typeof candidate.tweetId !== "string" || candidate.tweetId.length === 0) return false;
  if (!candidate.focal || typeof candidate.focal.tweetId !== "string") return false;
  return Array.isArray(candidate.thread);
}

export function readSharePayload(payload: SharePayload): {
  focalTweet: Bookmark;
  thread: ThreadTweet[];
} {
  return {
    focalTweet: fromSharedPost(payload.focal),
    thread: payload.thread.map(toThreadTweet),
  };
}
