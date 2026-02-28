import type { Bookmark } from "../../types";
import { TweetMedia } from "./TweetMedia";
import { TweetLinks } from "./TweetLinks";
import { RichTextBlock } from "./TweetText";
import { normalizeText } from "./utils";

interface Props {
  quotedTweet: Bookmark["quotedTweet"];
}

const EXCERPT_LENGTH = 140;

export function TweetQuote({ quotedTweet }: Props) {
  if (!quotedTweet) return null;

  const twitterUrl = `https://x.com/${quotedTweet.author.screenName}/status/${quotedTweet.tweetId}`;
  const article = quotedTweet.article ?? null;
  const articleText = article?.plainText?.trim() ?? "";

  // Suppress the tweet text when it's just the article intro (same content)
  const textMatchesArticle =
    article != null && normalizeText(articleText) === normalizeText(quotedTweet.text);
  const showTweetText = article == null || !textMatchesArticle;

  const excerpt =
    articleText.length > EXCERPT_LENGTH
      ? articleText.slice(0, EXCERPT_LENGTH).trimEnd() + "…"
      : articleText;

  return (
    <div className="mt-5 rounded border border-border p-4">
      <div className="mb-3 flex items-center gap-2 text-sm">
        <img
          src={quotedTweet.author.profileImageUrl}
          alt=""
          className="size-6 rounded-full"
          loading="lazy"
        />
        <span className="truncate font-semibold text-foreground">
          {quotedTweet.author.name}
        </span>
        <span className="truncate text-muted">
          @{quotedTweet.author.screenName}
        </span>
      </div>

      {showTweetText && (
        <RichTextBlock text={quotedTweet.text} compact style="tweet" />
      )}

      <TweetMedia items={quotedTweet.media} />

      {article != null ? (
        <a
          href={twitterUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 block overflow-hidden rounded border border-border bg-surface-link-card no-underline transition-colors hover:bg-surface-hover"
        >
          {article.coverImageUrl && (
            <img
              src={article.coverImageUrl}
              alt=""
              className="h-36 w-full object-cover"
              loading="lazy"
            />
          )}
          <div className="px-3 py-2.5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
              X Article
            </p>
            {article.title && (
              <p className="mt-0.5 text-sm font-semibold text-foreground">
                {article.title}
              </p>
            )}
            {excerpt && (
              <p className="mt-1 line-clamp-2 text-xs text-muted">{excerpt}</p>
            )}
          </div>
        </a>
      ) : (
        quotedTweet.urls && quotedTweet.urls.length > 0 && (
          <TweetLinks urls={quotedTweet.urls} />
        )
      )}
    </div>
  );
}
