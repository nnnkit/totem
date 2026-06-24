import type { Bookmark } from "../types";

export interface ReaderBookmarkResolution {
  localBookmark: Bookmark | null;
  hiddenBookmark: Bookmark | null;
  prevBookmark: Bookmark | null;
  nextBookmark: Bookmark | null;
}

export function resolveReaderRouteBookmarks(
  tweetId: string | null,
  readableBookmarks: Bookmark[],
  allBookmarks: Bookmark[],
): ReaderBookmarkResolution {
  if (!tweetId) {
    return {
      localBookmark: null,
      hiddenBookmark: null,
      prevBookmark: null,
      nextBookmark: null,
    };
  }

  const localIndex = readableBookmarks.findIndex(
    (bookmark) => bookmark.tweetId === tweetId,
  );
  const localBookmark =
    localIndex >= 0 ? readableBookmarks[localIndex] : null;
  const hiddenBookmark =
    localBookmark ??
    allBookmarks.find((bookmark) => bookmark.tweetId === tweetId) ??
    null;

  return {
    localBookmark,
    hiddenBookmark: localBookmark ? null : hiddenBookmark,
    prevBookmark: localIndex > 0 ? readableBookmarks[localIndex - 1] : null,
    nextBookmark:
      localIndex >= 0 && localIndex < readableBookmarks.length - 1
        ? readableBookmarks[localIndex + 1]
        : null,
  };
}

/**
 * Whether the reader route must fetch a tweet's detail from the network.
 *
 * Gated purely on the *existence* of a usable local row — a real tweetId with
 * no local or hidden bookmark. It deliberately does NOT look at the bookmark's
 * `bookmarked` flag: un-bookmarking an item must not retrigger a detail fetch.
 * That state is applied as an overlay on already-fetched data (see
 * `selectReaderDisplayBookmark`), so `bookmarked` never belongs in the fetch
 * effect's dependency set.
 */
export function shouldFetchExternalDetail(input: {
  tweetId: string | null;
  localBookmark: Bookmark | null;
  hiddenBookmark: Bookmark | null;
}): boolean {
  return (
    Boolean(input.tweetId) && !input.localBookmark && !input.hiddenBookmark
  );
}

export interface ReaderExternalDetail {
  tweetId: string;
  focalTweet: Bookmark;
}

/**
 * The bookmark the reader route should display, by precedence:
 * live local row → its last snapshot → externally-fetched detail.
 *
 * The un-bookmark overlay applies only to the external branch: when the user
 * removes a bookmark we don't own a local row for, we mark the fetched copy
 * `bookmarked: false` in place rather than refetching. Local rows carry their
 * own `bookmarked` state through the store, so they need no overlay.
 */
export function selectReaderDisplayBookmark(input: {
  localBookmark: Bookmark | null;
  localBookmarkSnapshot: Bookmark | null;
  externalDetail: ReaderExternalDetail | null;
  externalUnbookmarkedTweetId: string | null;
}): Bookmark | null {
  const {
    localBookmark,
    localBookmarkSnapshot,
    externalDetail,
    externalUnbookmarkedTweetId,
  } = input;
  if (localBookmark) return localBookmark;
  if (localBookmarkSnapshot) return localBookmarkSnapshot;
  if (!externalDetail) return null;
  if (externalUnbookmarkedTweetId === externalDetail.tweetId) {
    return { ...externalDetail.focalTweet, bookmarked: false };
  }
  return externalDetail.focalTweet;
}
