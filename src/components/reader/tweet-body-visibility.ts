import type { TweetKind } from "../../types";
import type { ReaderTweet } from "./types";
import { normalizeText } from "./utils";

export interface TweetBodyVisibility {
  showArticle: boolean;
  showText: boolean;
}

function normalizeArticleFingerprint(value: string | null | undefined): string {
  if (!value) return "";
  return normalizeText(value).replace(/\s+/g, " ").toLowerCase().trim();
}

function hasDuplicatedQuotedArticle(tweet: ReaderTweet): boolean {
  const article = tweet.article;
  const quotedArticle = tweet.quotedTweet?.article;
  if (!article || !quotedArticle) return false;

  const articleText = normalizeArticleFingerprint(article.plainText);
  const quotedArticleText = normalizeArticleFingerprint(quotedArticle.plainText);
  if (articleText && quotedArticleText && articleText === quotedArticleText) {
    return true;
  }

  const articleTitle = normalizeArticleFingerprint(article.title);
  const quotedArticleTitle = normalizeArticleFingerprint(quotedArticle.title);
  const articleCover = normalizeArticleFingerprint(article.coverImageUrl);
  const quotedArticleCover = normalizeArticleFingerprint(quotedArticle.coverImageUrl);

  return Boolean(
    articleTitle &&
      quotedArticleTitle &&
      articleTitle === quotedArticleTitle &&
      articleCover &&
      quotedArticleCover &&
      articleCover === quotedArticleCover,
  );
}

export function resolveTweetBodyVisibility(
  tweet: ReaderTweet,
  kind: TweetKind,
): TweetBodyVisibility {
  const articleText = tweet.article?.plainText?.trim() || "";
  const hasArticle = articleText.length > 0 && Boolean(tweet.article);
  if (!hasArticle) {
    return { showArticle: false, showText: true };
  }

  const textMatchesArticle = normalizeText(articleText) === normalizeText(tweet.text);
  const isArticleKind = kind === "article";
  const hasArticleBlocks = Boolean(tweet.article?.contentBlocks?.length);
  const prefersArticleBody = isArticleKind || hasArticleBlocks || !textMatchesArticle;
  const suppressDuplicateQuotedArticle = hasDuplicatedQuotedArticle(tweet);

  const showArticle = prefersArticleBody && !suppressDuplicateQuotedArticle;
  const hideTextBecauseArticleAlreadyCoversIt =
    textMatchesArticle &&
    (isArticleKind || hasArticleBlocks) &&
    (showArticle || suppressDuplicateQuotedArticle);

  return {
    showArticle,
    showText: !hideTextBecauseArticleAlreadyCoversIt,
  };
}
