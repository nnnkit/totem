import { useCallback, useEffect, useReducer, useState } from "react";
import { useBookmarksLoaded, useRuntimeActions } from "../stores/selectors";
import type { TweetDetailContent } from "../api/parsers";

/**
 * A loaded reader detail. Matches `TweetDetailContent` — the shape returned
 * by `fetchTweetDetail` — so promoting this hook to a router loader later
 * is a rename, not a field-by-field mapping.
 */
export type ReaderDetailData = TweetDetailContent & { focalTweet: NonNullable<TweetDetailContent["focalTweet"]> };

export type ReaderDetailState =
  | { status: "idle" }
  | { status: "pending"; tweetId: string }
  | { status: "success"; tweetId: string; data: ReaderDetailData }
  | { status: "error"; tweetId: string; error: string };

export type ReaderDetailEvent =
  | { type: "reset" }
  | { type: "fetch"; tweetId: string }
  | { type: "resolved"; tweetId: string; data: ReaderDetailData }
  | { type: "not_found"; tweetId: string }
  | { type: "error"; tweetId: string; error: string };

/**
 * Pure state transitions for the reader-detail loader.
 *
 * Late-arriving results from a previous tweetId (stale responses) collapse
 * to a no-op because `resolved` / `not_found` / `error` only apply when the
 * current pending tweetId matches the event's tweetId. This removes the need
 * for a manual cancellation flag in the useEffect.
 */
export function reduceReaderDetail(
  state: ReaderDetailState,
  event: ReaderDetailEvent,
): ReaderDetailState {
  switch (event.type) {
    case "reset":
      return state.status === "idle" ? state : { status: "idle" };
    case "fetch":
      if (state.status === "pending" && state.tweetId === event.tweetId) {
        return state;
      }
      return { status: "pending", tweetId: event.tweetId };
    case "resolved":
      if (state.status !== "pending" || state.tweetId !== event.tweetId) {
        return state;
      }
      return {
        status: "success",
        tweetId: event.tweetId,
        data: event.data,
      };
    case "not_found":
      if (state.status !== "pending" || state.tweetId !== event.tweetId) {
        return state;
      }
      return {
        status: "error",
        tweetId: event.tweetId,
        error: "DETAIL_NOT_FOUND",
      };
    case "error":
      if (state.status !== "pending" || state.tweetId !== event.tweetId) {
        return state;
      }
      return { status: "error", tweetId: event.tweetId, error: event.error };
  }
}

export interface UseReaderDetailReturn {
  state: ReaderDetailState;
  refetch: () => void;
}

const INITIAL_STATE: ReaderDetailState = { status: "idle" };

/**
 * Pure gate for whether a detail fetch should fire. Exported for testing —
 * the hook composes it with live `bookmarksLoaded` from the store, so the
 * hook itself stays a thin wrapper over state we can exercise directly.
 *
 * `bookmarksLoaded` gates the fetch because getDb() in the DB layer reads
 * the active account's dbName at call time. Firing before
 * hydrateCurrentAccount has run setActiveAccountId routes the read (and any
 * upsert) at the default "totem" DB, returning empty cache and polluting
 * the wrong database. When hydration completes, bookmarksLoaded flips true
 * and the effect reruns with the account DB pointed correctly.
 */
export function shouldFetchReaderDetail(
  tweetId: string | null,
  bookmarksLoaded: boolean,
): tweetId is string {
  return Boolean(tweetId) && bookmarksLoaded;
}

/**
 * Loader-shaped hook for a single tweet's reader detail.
 *
 * Replaces the useEffect+cancelled+retryKey triad the reader route used to
 * carry. The return shape matches what a route loader would expose so
 * promotion to a real router loader is a swap, not a rewrite.
 *
 * Pass `null` (or an empty string) as tweetId to stay idle — e.g. when the
 * bookmark is already available locally and no fetch is needed.
 */
export function useReaderDetail(tweetId: string | null): UseReaderDetailReturn {
  const actions = useRuntimeActions();
  const bookmarksLoaded = useBookmarksLoaded();
  const [state, dispatch] = useReducer(reduceReaderDetail, INITIAL_STATE);
  const [refetchNonce, setRefetchNonce] = useState(0);

  const refetch = useCallback(() => {
    setRefetchNonce((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!shouldFetchReaderDetail(tweetId, bookmarksLoaded)) {
      dispatch({ type: "reset" });
      return;
    }

    dispatch({ type: "fetch", tweetId });

    actions
      .loadReaderDetail(tweetId)
      .then((detail) => {
        if (!detail.focalTweet) {
          dispatch({ type: "not_found", tweetId });
          return;
        }
        dispatch({
          type: "resolved",
          tweetId,
          data: { focalTweet: detail.focalTweet, thread: detail.thread },
        });
      })
      .catch((error: unknown) => {
        const message =
          error instanceof Error && error.message ? error.message : "DETAIL_ERROR";
        dispatch({ type: "error", tweetId, error: message });
      });
  }, [actions, tweetId, refetchNonce, bookmarksLoaded]);

  return { state, refetch };
}
