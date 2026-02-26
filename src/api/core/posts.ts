import { getTweetDetailCache, upsertTweetDetailCache } from "../../db";
import { parseTweetDetailPayload, type TweetDetailContent } from "../parsers";

interface RuntimeResponse {
  error?: string;
  data?: unknown;
}

function runtimeError(response: RuntimeResponse): string {
  return response.error || "DETAIL_ERROR";
}

export async function fetchTweetDetail(
  tweetId: string,
): Promise<TweetDetailContent> {
  const cached = await getTweetDetailCache(tweetId).catch(() => null);

  if (cached) {
    return {
      focalTweet: cached.focalTweet,
      thread: cached.thread,
    };
  }

  const response = (await chrome.runtime.sendMessage({
    type: "FETCH_TWEET_DETAIL",
    tweetId,
  })) as RuntimeResponse;

  if (response.error) {
    throw new Error(runtimeError(response));
  }

  const detail = parseTweetDetailPayload(response.data, tweetId);
  upsertTweetDetailCache({
    tweetId,
    fetchedAt: Date.now(),
    focalTweet: detail.focalTweet,
    thread: detail.thread,
  }).catch(() => {});

  return detail;
}
