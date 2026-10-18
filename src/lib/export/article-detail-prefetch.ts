import { fetchTweetDetail } from "../../api/core/posts";
import type { TweetDetailContent } from "../../api/parsers";
import { getTweetDetailCache, iterateBookmarks, upsertTweetDetailCache } from "../../db";
import { getHydrationStore } from "../../stores/hydration-store";
import type { Bookmark } from "../../types";

// The Bookmarks feed only carries a truncated Article preview; the full
// contentBlocks arrive with TweetDetail. Kept small so an export never turns
// into a crawl that trips X's TweetDetail rate limit.
export const MAX_ARTICLE_PREFETCH = 25;
export const ARTICLE_PREFETCH_GAP_MS = 1500;

const STOP_CODES = new Set(["RATE_LIMITED", "NO_AUTH", "AUTH_EXPIRED"]);

export interface ArticlePrefetchDeps {
  bookmarks: () => AsyncIterable<Bookmark>;
  hasDetail: (tweetId: string) => Promise<boolean>;
  fetchDetail: (tweetId: string) => Promise<TweetDetailContent>;
  saveDetail: (tweetId: string, detail: TweetDetailContent) => Promise<void>;
  rateLimitedUntil: () => number;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
}

const defaultDeps: ArticlePrefetchDeps = {
  bookmarks: iterateBookmarks,
  hasDetail: async (tweetId) => Boolean(await getTweetDetailCache(tweetId).catch(() => null)),
  fetchDetail: fetchTweetDetail,
  saveDetail: (tweetId, detail) =>
    upsertTweetDetailCache({
      tweetId,
      fetchedAt: Date.now(),
      focalTweet: detail.focalTweet,
      thread: detail.thread,
      detailsStatus: "ok",
    }),
  rateLimitedUntil: () => {
    const state = getHydrationStore().getState();
    return state.status === "paused-429" ? state.pauseUntil : 0;
  },
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now: Date.now,
};

function needsArticleDetail(bookmark: Bookmark): boolean {
  return Boolean(bookmark.article) && !bookmark.article?.contentBlocks?.length;
}

function isStopError(error: unknown): boolean {
  const code = error instanceof Error ? error.message : "";
  return STOP_CODES.has(code) || code.startsWith("DETAIL_ERROR_429");
}

export async function prefetchMissingArticleDetails(
  deps: ArticlePrefetchDeps = defaultDeps,
): Promise<{ fetched: number; stopped: boolean }> {
  if (deps.rateLimitedUntil() > deps.now()) return { fetched: 0, stopped: true };

  const candidates: string[] = [];
  for await (const bookmark of deps.bookmarks()) {
    if (!needsArticleDetail(bookmark)) continue;
    if (await deps.hasDetail(bookmark.tweetId)) continue;
    candidates.push(bookmark.tweetId);
    if (candidates.length >= MAX_ARTICLE_PREFETCH) break;
  }

  let fetched = 0;
  for (const [index, tweetId] of candidates.entries()) {
    if (index > 0) await deps.sleep(ARTICLE_PREFETCH_GAP_MS);
    try {
      const detail = await deps.fetchDetail(tweetId);
      if (!detail.focalTweet && detail.thread.length === 0) continue;
      // fetchTweetDetail's own cache write is fire-and-forget; the export
      // reads the cache right after this, so persist before moving on.
      await deps.saveDetail(tweetId, detail);
      fetched++;
    } catch (error) {
      if (isStopError(error)) return { fetched, stopped: true };
    }
  }
  return { fetched, stopped: false };
}
