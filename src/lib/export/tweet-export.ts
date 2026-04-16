import { normalizeText } from "../../lib/text";
import { stripCardUrlsFromTweetText } from "../../lib/tweet-text";
import type {
  ArticleContent,
  Bookmark,
  Media,
  QuotedTweet,
  ThreadTweet,
  TweetKind,
  TweetUrl,
} from "../../types";
import { hasExportableArticle } from "./article-to-markdown";

type TweetExportNode = {
  tweetId: string;
  author: { screenName: string; name: string };
  text: string;
  urls: TweetUrl[];
  media: Media[];
  article?: ArticleContent | null;
  quotedTweet?: QuotedTweet | null;
  retweetedTweet?: QuotedTweet | null;
  tweetKind?: TweetKind;
  tweetDisplayType?: string;
  isThread?: boolean;
  inReplyToTweetId?: string;
};

function tweetStatusUrl(tweet: TweetExportNode): string {
  return `https://x.com/${tweet.author.screenName}/status/${tweet.tweetId}`;
}

function exportTweetKind(tweet: TweetExportNode): TweetKind {
  if (tweet.tweetKind) return tweet.tweetKind;
  if (tweet.retweetedTweet) return "repost";
  if (tweet.isThread || tweet.tweetDisplayType === "SelfThread") {
    return "thread";
  }
  if (tweet.inReplyToTweetId) return "reply";
  if (tweet.quotedTweet) return "quote";
  if (tweet.article?.plainText?.trim()) return "article";
  return "tweet";
}

function appendMediaMarkdown(body: string, media: Media[], watchOnXUrl: string): string {
  const parts: string[] = [];
  const trimmed = body.trim();
  if (trimmed) parts.push(trimmed);

  for (const m of media) {
    if (m.type === "photo") {
      parts.push(`![](${m.url})`);
    }
    if (m.type === "video" || m.type === "animated_gif") {
      if (m.url) parts.push(`![](${m.url})`);
      parts.push(`[Watch on X](${watchOnXUrl})`);
    }
  }

  return parts.join("\n\n");
}

function appendQuotedTweetExport(
  body: string,
  quoted: QuotedTweet | null | undefined,
): string {
  if (!quoted) return body;
  const qt = stripCardUrlsFromTweetText(
    quoted.text,
    quoted.urls ?? [],
  ).trim();
  if (!qt) return body;
  const trimmed = body.trim();
  const appendix = `— Quoting @${quoted.author.screenName} —\n\n${qt}`;
  return trimmed ? `${trimmed}\n\n${appendix}` : appendix;
}

function tweetNodeToPlainExport(tweet: TweetExportNode): string {
  const kind = exportTweetKind(tweet);
  let core: string;

  if (kind === "repost" && tweet.retweetedTweet) {
    const repostComment =
      normalizeText(tweet.text) !== normalizeText(tweet.retweetedTweet.text)
        ? stripCardUrlsFromTweetText(tweet.text, tweet.urls).trim()
        : "";
    const innerUrls = tweet.retweetedTweet.urls ?? [];
    const inner = stripCardUrlsFromTweetText(
      tweet.retweetedTweet.text,
      innerUrls,
    ).trim();
    const a = tweet.retweetedTweet.author;
    const attribution = `@${a.screenName} (${a.name})`;
    core = repostComment
      ? `${repostComment}\n\n— Reposted from ${attribution} —\n\n${inner}`
      : `— Repost from ${attribution} —\n\n${inner}`;
  } else {
    core = stripCardUrlsFromTweetText(tweet.text, tweet.urls).trim();
  }

  if (tweet.quotedTweet && kind !== "repost") {
    core = appendQuotedTweetExport(core, tweet.quotedTweet);
  }

  return appendMediaMarkdown(core, tweet.media, tweetStatusUrl(tweet)).trim();
}

function firstPhotoUrl(media: Media[]): string | undefined {
  const photo = media.find((m) => m.type === "photo");
  return photo?.url;
}

function deriveExportTitle(bookmark: Bookmark): string | undefined {
  const fromArticle = bookmark.article?.title?.trim();
  if (fromArticle) return fromArticle;
  const preview = stripCardUrlsFromTweetText(bookmark.text, bookmark.urls)
    .trim()
    .split("\n")[0];
  if (!preview) return undefined;
  return preview.length <= 200 ? preview : `${preview.slice(0, 197)}…`;
}

export function buildSyntheticExportPlainText(
  bookmark: Bookmark,
  thread: ThreadTweet[],
  includeThread = false,
): string {
  const focal = tweetNodeToPlainExport(bookmark);
  if (!includeThread) {
    return focal || "(No text in this post.)";
  }

  const sorted = thread.toSorted((a, b) => a.createdAt - b.createdAt);
  const focalHandle = bookmark.author.screenName.toLowerCase();
  const extras: string[] = [];
  for (const t of sorted) {
    if (t.tweetId === bookmark.tweetId) continue;
    const piece = tweetNodeToPlainExport(t);
    if (!piece) continue;
    if (t.author.screenName.toLowerCase() === focalHandle) {
      extras.push(piece);
    } else {
      extras.push(
        `— @${t.author.screenName} (${t.author.name}) —\n\n${piece}`,
      );
    }
  }
  if (extras.length === 0) {
    return focal || "(No text in this post.)";
  }
  const threadBlock = extras.join("\n\n---\n\n");
  if (!focal) return threadBlock;
  return `${focal}\n\n---\n\n${threadBlock}`;
}

export function resolveReaderExportArticle(
  bookmark: Bookmark,
  thread: ThreadTweet[],
  options?: { includeThreadInExport?: boolean },
): ArticleContent {
  if (bookmark.article && hasExportableArticle(bookmark.article)) {
    return bookmark.article;
  }
  const plainText = buildSyntheticExportPlainText(
    bookmark,
    thread,
    options?.includeThreadInExport ?? false,
  );
  const title = deriveExportTitle(bookmark);
  const coverImageUrl = firstPhotoUrl(bookmark.media);
  return {
    plainText,
    ...(title ? { title } : {}),
    ...(coverImageUrl ? { coverImageUrl } : {}),
  };
}
