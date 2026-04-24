import { getTweetDetailCache, upsertTweetDetailCache } from "../../db";
import { parseTweetDetailPayload, type TweetDetailContent } from "../parsers";

interface RuntimeResponse {
  error?: string;
  data?: unknown;
}

function runtimeError(response: RuntimeResponse): string {
  return response.error || "DETAIL_ERROR";
}

// Errors the server will not stop producing on retry. Propagating them
// immediately lets the reader's error classifier show the correct action
// (Log in for auth, Try again later for rate-limit, View on X for missing).
// Retrying would stack a second failed request on top of the first for no
// user benefit.
const TERMINAL_ERROR_CODES = new Set([
  "NO_AUTH",
  "AUTH_EXPIRED",
  "RATE_LIMITED",
  "DETAIL_NOT_FOUND",
]);

// Collapses concurrent callers (reader + prefetch) for the same tweetId into
// one network round-trip. The entry is removed on settle so GC is automatic.
const inflight = new Map<string, Promise<TweetDetailContent>>();

const SW_WAKE_RETRY_DELAY_MS = 250;

async function sendTweetDetailRequest(tweetId: string): Promise<RuntimeResponse> {
  return (await chrome.runtime.sendMessage({
    type: "FETCH_TWEET_DETAIL",
    tweetId,
  })) as RuntimeResponse;
}

/**
 * One retry, but only for transport-layer failures (sendMessage itself
 * throws — typically an MV3 service worker that was asleep). Structured
 * error envelopes from the SW — NO_AUTH, AUTH_EXPIRED, RATE_LIMITED,
 * DETAIL_NOT_FOUND — are classified and surfaced to the caller verbatim,
 * so the reader UI can show the action that actually resolves the problem.
 */
async function sendWithTransientRetry(
  tweetId: string,
): Promise<RuntimeResponse> {
  let firstTransportError: unknown;
  try {
    return await sendTweetDetailRequest(tweetId);
  } catch (error) {
    firstTransportError = error;
  }

  await new Promise((resolve) => setTimeout(resolve, SW_WAKE_RETRY_DELAY_MS));

  try {
    return await sendTweetDetailRequest(tweetId);
  } catch {
    throw firstTransportError instanceof Error
      ? firstTransportError
      : new Error("DETAIL_ERROR");
  }
}

export async function fetchTweetDetail(
  tweetId: string,
): Promise<TweetDetailContent> {
  const cached = await getTweetDetailCache(tweetId).catch(() => null);

  const hasUsableCachedDetail =
    cached?.focalTweet !== null &&
    cached?.focalTweet !== undefined &&
    cached.focalTweet.id.length > 0;
  if (cached && hasUsableCachedDetail) {
    return { focalTweet: cached.focalTweet, thread: cached.thread };
  }

  const existing = inflight.get(tweetId);
  if (existing) return existing;

  const request = (async () => {
    const response = await sendWithTransientRetry(tweetId);

    if (response.error) {
      // Propagate the SW's exact code. The reader classifies it via
      // classifyDetailError and renders the matching action — Log in for
      // auth errors, Try again later for rate-limit, View on X for
      // not-found, Retry for everything else.
      throw new Error(runtimeError(response));
    }

    const detail = parseTweetDetailPayload(response.data, tweetId);
    if (detail.focalTweet || detail.thread.length > 0) {
      upsertTweetDetailCache({
        tweetId,
        fetchedAt: Date.now(),
        focalTweet: detail.focalTweet,
        thread: detail.thread,
      }).catch(() => {});
    }
    return detail;
  })();

  inflight.set(tweetId, request);
  request
    .catch(() => {
      // Swallow: the original request promise still rejects and every caller
      // gets the error; this .catch only exists so the .finally observer
      // doesn't surface an "unhandled rejection" in the bookkeeping path.
    })
    .finally(() => {
      if (inflight.get(tweetId) === request) inflight.delete(tweetId);
    });
  return request;
}

// Test-only utility. Body is guarded by `import.meta.env.DEV` so production
// builds reduce to a no-op the bundler can eliminate. Tests run in vitest
// (DEV=true) and get the clear; production callers from DevTools or a
// compromised page get nothing, so the in-flight dedupe can't be nuked at
// runtime on a user's machine.
export function _clearInflightForTesting(): void {
  if (!import.meta.env.DEV) return;
  inflight.clear();
}

export { TERMINAL_ERROR_CODES };
