import { memo } from "react";
import {
  ArrowSquareOutIcon,
  BookmarkSimpleIcon,
  CheckIcon,
  LightningIcon,
} from "@phosphor-icons/react";
import type { Bookmark, ThreadTweet, TweetKind } from "../../types";
import {
  buildGrokUrl,
  normalizeText,
  resolveTweetKind,
  toEmbeddedReaderTweet,
} from "./utils";
import { estimateReadingMinutes } from "../../lib/bookmark-utils";
import { TweetHeader } from "./TweetHeader";
import { RichTextBlock } from "./TweetText";
import { TweetMedia } from "./TweetMedia";
import { TweetQuote } from "./TweetQuote";
import { TweetArticle } from "./TweetArticle";
import { TweetLinks } from "./TweetLinks";
import { TweetRecommendations } from "./TweetRecommendations";
import type { ReaderTweet } from "./types";
import { cn } from "../../lib/cn";
import { Button } from "../ui/Button";
import { OfflineBanner } from "../ui/OfflineBanner";

interface TweetBodyProps {
  tweet: ReaderTweet;
  compact?: boolean;
  sectionIdPrefix?: string;
}

function stripCardUrls(
  text: string,
  urls: { url: string; expandedUrl: string }[],
): string {
  if (urls.length === 0) return text;
  let result = text;
  for (const u of urls) {
    if (u.url) result = result.replaceAll(u.url, "");
    if (u.expandedUrl) result = result.replaceAll(u.expandedUrl, "");
  }
  return result.replace(/\n+$/, "").trimEnd();
}

function TweetBody({
  tweet,
  compact = false,
  sectionIdPrefix,
}: TweetBodyProps) {
  const kind = resolveTweetKind(tweet);

  if (kind === "repost" && tweet.retweetedTweet) {
    const repostComment =
      normalizeText(tweet.text) !== normalizeText(tweet.retweetedTweet.text)
        ? tweet.text
        : "";

    return (
      <>
        {repostComment && (
          <RichTextBlock text={repostComment} compact={compact} style="tweet" />
        )}
        <div className="mt-4 rounded border border-border p-4">
          <p className="text-xs uppercase text-muted">Reposted content</p>
          <div className="mt-2 flex items-center gap-2 text-sm">
            <img
              src={tweet.retweetedTweet.author.profileImageUrl}
              alt=""
              className="size-7 rounded-full"
              loading="lazy"
            />
            <span className="truncate font-semibold text-foreground">
              {tweet.retweetedTweet.author.name}
            </span>
            <span className="truncate text-muted">
              @{tweet.retweetedTweet.author.screenName}
            </span>
          </div>
          <div className="mt-3">
            <TweetBody
              tweet={toEmbeddedReaderTweet(tweet.retweetedTweet)}
              compact
            />
          </div>
        </div>
      </>
    );
  }

  const articleText = tweet.article?.plainText?.trim() || "";
  const hasArticle = articleText.length > 0 && tweet.article;
  const textMatchesArticle =
    hasArticle && normalizeText(articleText) === normalizeText(tweet.text);

  const isArticleKind = kind === "article" && hasArticle;
  const hasArticleBlocks = Boolean(tweet.article?.contentBlocks?.length);

  const showArticle =
    hasArticle && (isArticleKind || !textMatchesArticle || hasArticleBlocks);
  const showText = !((isArticleKind || hasArticleBlocks) && textMatchesArticle);

  const displayText = stripCardUrls(tweet.text, tweet.urls);

  return (
    <>
      {showText && (
        <RichTextBlock
          text={displayText}
          compact={compact}
          style="tweet"
          sectionIdPrefix={sectionIdPrefix}
        />
      )}

      <TweetMedia items={tweet.media} bleed={!compact} />
      <TweetQuote quotedTweet={tweet.quotedTweet || null} />

      {showArticle && (
        <TweetArticle
          article={tweet.article!}
          compact={compact}
          authorProfileImageUrl={tweet.author?.profileImageUrl}
        />
      )}

      <TweetLinks urls={tweet.urls} />
    </>
  );
}

function formatThreadDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

interface ThreadTweetsProps {
  tweets: ThreadTweet[];
}

function ThreadTweets({ tweets }: ThreadTweetsProps) {
  if (tweets.length === 0) return null;

  return (
    <section className="mt-10 rounded-lg bg-accent-surface/40 px-4 py-5">
      <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted">
        Thread
      </p>
      <div>
        {tweets.map((tweet, index) => {
          const isLast = index === tweets.length - 1;
          return (
            <article
              key={tweet.tweetId}
              id={`section-thread-${index + 1}`}
              className="relative flex gap-3"
            >
              <div className="flex flex-col items-center">
                <img
                  src={tweet.author.profileImageUrl}
                  alt=""
                  className="size-10 shrink-0 rounded-full"
                  loading="lazy"
                />
                {!isLast && <div className="mt-1 w-0.5 flex-1 bg-border" />}
              </div>
              <div className={cn("min-w-0 flex-1", !isLast && "pb-5")}>
                <div className="flex items-center gap-1.5 text-sm">
                  <span className="truncate font-bold text-foreground">
                    {tweet.author.name}
                  </span>
                  <span className="truncate text-muted">
                    @{tweet.author.screenName}
                  </span>
                  <span className="text-muted">&middot;</span>
                  <span className="shrink-0 text-muted">
                    {formatThreadDate(tweet.createdAt)}
                  </span>
                </div>
                <div className="mt-1">
                  <TweetBody tweet={tweet} compact />
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

/* ── Action bar (Substack-style social bar) ── */

interface ActionBarProps {
  viewOnXUrl: string;
  onToggleRead?: () => void;
  isMarkedRead?: boolean;
  onDeleteBookmark?: () => void;
}

function ActionBar({
  viewOnXUrl,
  onToggleRead,
  isMarkedRead,
  onDeleteBookmark,
}: ActionBarProps) {
  const grokUrl = buildGrokUrl(viewOnXUrl);

  return (
    <div className="flex items-center gap-1 border-y border-border py-2">
      <Button variant="ghost" size="sm" href={viewOnXUrl}>
        <ArrowSquareOutIcon className="size-3.5" />
        View on X
      </Button>

      <Button variant="ghost" size="sm" href={grokUrl}>
        <LightningIcon weight="bold" className="size-3.5" />
        Grok
      </Button>

      <div className="ml-auto flex items-center gap-1">
        {onDeleteBookmark && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onDeleteBookmark}
            className="hover:text-red-500"
          >
            <BookmarkSimpleIcon weight="fill" className="size-3.5" />
            Remove
          </Button>
        )}
        {onToggleRead && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleRead}
            className={isMarkedRead ? "text-success" : undefined}
          >
            <CheckIcon weight="bold" className="size-3.5" />
            {isMarkedRead ? "Read" : "Mark read"}
          </Button>
        )}
      </div>
    </div>
  );
}

/* ── Main component ── */

interface Props {
  displayBookmark: Bookmark;
  displayKind: TweetKind;
  detailThread: ThreadTweet[];
  detailLoading: boolean;
  detailError: string | null;
  relatedBookmarks: Bookmark[];
  onOpenBookmark: (bookmark: Bookmark) => void;
  onShuffle?: () => void;
  tweetSectionIdPrefix?: string;
  onToggleRead?: () => void;
  isMarkedRead?: boolean;
  onDeleteBookmark?: () => void;
  onLogin?: () => void;
}

export const TweetContent = memo(function TweetContent({
  displayBookmark,
  displayKind,
  detailThread,
  detailLoading,
  detailError,
  relatedBookmarks,
  onOpenBookmark,
  onShuffle,
  tweetSectionIdPrefix,
  onToggleRead,
  isMarkedRead,
  onDeleteBookmark,
  onLogin,
}: Props) {
  const viewOnXUrl = `https://x.com/${displayBookmark.author.screenName}/status/${displayBookmark.tweetId}`;

  return (
    <div>
      <TweetHeader
        author={displayBookmark.author}
        displayKind={displayKind}
        createdAt={displayBookmark.createdAt}
        readingMinutes={
          detailLoading ? null : estimateReadingMinutes(displayBookmark)
        }
      />

      <div className="mt-5">
        <ActionBar
          viewOnXUrl={viewOnXUrl}
          onToggleRead={onToggleRead}
          isMarkedRead={isMarkedRead}
          onDeleteBookmark={onDeleteBookmark}
        />
      </div>

      <div id="section-main-tweet" className="mt-10">
        <TweetBody
          tweet={displayBookmark}
          sectionIdPrefix={tweetSectionIdPrefix}
        />
        <ThreadTweets tweets={detailThread} />
      </div>

      {detailLoading && (
        <div className="mt-8 flex items-center gap-3 py-4 text-sm text-muted">
          <span className="animate-spin">
            <div className="size-4 rounded-full border-2 border-accent border-t-transparent" />
          </span>
          Loading details...
        </div>
      )}

      {detailError && (
        <div className="mt-8">
          <OfflineBanner onLogin={onLogin} />
        </div>
      )}


      <div className="mt-10">
        <ActionBar
          viewOnXUrl={viewOnXUrl}
          onToggleRead={onToggleRead}
          isMarkedRead={isMarkedRead}
          onDeleteBookmark={onDeleteBookmark}
        />
      </div>

      <TweetRecommendations
        relatedBookmarks={relatedBookmarks}
        onOpenBookmark={onOpenBookmark}
        onShuffle={onShuffle}
      />
    </div>
  );
});
