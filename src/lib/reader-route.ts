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
