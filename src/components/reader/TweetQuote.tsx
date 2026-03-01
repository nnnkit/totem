import type { Bookmark } from "../../types";
import { TweetMedia } from "./TweetMedia";
import { TweetLinks } from "./TweetLinks";
import { RichTextBlock } from "./TweetText";
import { compactPreview, normalizeText } from "./utils";

interface Props {
  quotedTweet: Bookmark["quotedTweet"];
  variant?: "full" | "compact";
}

const QUOTE_TEXT_COMPACT_MAX = 220;
const ARTICLE_EXCERPT_COMPACT_MAX = 120;
const ARTICLE_EXCERPT_FULL_MAX = 220;
const COMPACT_QUOTE_MEDIA_LIMIT = 1;
const COMPACT_QUOTE_LINK_LIMIT = 1;

type ResolvedQuote = NonNullable<Bookmark["quotedTweet"]>;

function renderExcerpt(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars).trimEnd()}…`;
}

function QuoteHeader({ quotedTweet }: { quotedTweet: ResolvedQuote }) {
  return (
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
  );
}

function QuoteArticleCard({
  quotedTweet,
  compact,
}: {
  quotedTweet: ResolvedQuote;
  compact: boolean;
}) {
  const article = quotedTweet.article;
  if (!article) return null;

  const twitterUrl = `https://x.com/${quotedTweet.author.screenName}/status/${quotedTweet.tweetId}`;
  const articleText = article.plainText?.trim() ?? "";
  const excerpt = renderExcerpt(
    articleText,
    compact ? ARTICLE_EXCERPT_COMPACT_MAX : ARTICLE_EXCERPT_FULL_MAX,
  );

  return (
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
          className={compact ? "h-28 w-full object-cover" : "h-36 w-full object-cover"}
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
  );
}

function TweetQuoteContent({
  quotedTweet,
  compact,
}: {
  quotedTweet: ResolvedQuote;
  compact: boolean;
}) {
  const article = quotedTweet.article ?? null;
  const articleText = article?.plainText?.trim() ?? "";

  const textMatchesArticle =
    article != null && normalizeText(articleText) === normalizeText(quotedTweet.text);
  const showTweetText = article == null || !textMatchesArticle;
  const text = compact ? compactPreview(quotedTweet.text, QUOTE_TEXT_COMPACT_MAX) : quotedTweet.text;
  const urls = quotedTweet.urls ?? [];
  const visibleUrls = compact ? urls.slice(0, COMPACT_QUOTE_LINK_LIMIT) : urls;

  return (
    <>
      {showTweetText && (
        <RichTextBlock text={text} compact style="tweet" />
      )}

      {article == null && quotedTweet.media.length > 0 && (
        <TweetMedia
          items={compact ? quotedTweet.media.slice(0, COMPACT_QUOTE_MEDIA_LIMIT) : quotedTweet.media}
          compact={compact}
        />
      )}

      {article != null ? (
        <QuoteArticleCard quotedTweet={quotedTweet} compact={compact} />
      ) : (
        visibleUrls.length > 0 && <TweetLinks urls={visibleUrls} />
      )}
    </>
  );
}

export function TweetQuoteCompact({ quotedTweet }: Pick<Props, "quotedTweet">) {
  if (!quotedTweet) return null;

  return (
    <div className="mt-5 rounded border border-border p-4">
      <QuoteHeader quotedTweet={quotedTweet} />
      <TweetQuoteContent quotedTweet={quotedTweet} compact />
    </div>
  );
}

export function TweetQuoteFull({ quotedTweet }: Pick<Props, "quotedTweet">) {
  if (!quotedTweet) return null;

  return (
    <div className="mt-5 rounded border border-border p-4">
      <QuoteHeader quotedTweet={quotedTweet} />
      <TweetQuoteContent quotedTweet={quotedTweet} compact={false} />
    </div>
  );
}

export function TweetQuote({ quotedTweet, variant = "compact" }: Props) {
  if (variant === "full") {
    return <TweetQuoteFull quotedTweet={quotedTweet} />;
  }
  return <TweetQuoteCompact quotedTweet={quotedTweet} />;
}
