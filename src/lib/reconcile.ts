import type { Bookmark } from "../types";
import type { BookmarkPageResult } from "../api/parsers";

interface ReconcileResult {
  newBookmarks: Bookmark[];
  staleIds: string[];
  pagesRequested: number;
}

interface ReconcileOptions {
  localIds: Set<string>;
  fetchPage: (cursor?: string) => Promise<BookmarkPageResult>;
  fullReconcile: boolean;
  onPage?: (newBookmarks: Bookmark[]) => void | Promise<void>;
}

export async function reconcileBookmarks(
  opts: ReconcileOptions,
): Promise<ReconcileResult> {
  const { localIds, fetchPage, fullReconcile, onPage } = opts;
  const seen = new Set(localIds);
  const seenCursors = new Set<string>();
  const remoteIds = new Set<string>();
  const allNew: Bookmark[] = [];
  let cursor: string | undefined;
  let pagesRequested = 0;

  while (true) {
    if (cursor) {
      if (seenCursors.has(cursor)) break;
      seenCursors.add(cursor);
    }

    const result = await fetchPage(cursor);
    pagesRequested++;

    const pageNew = result.bookmarks.filter((b) => !seen.has(b.tweetId));

    if (fullReconcile) {
      for (const b of result.bookmarks) {
        remoteIds.add(b.tweetId);
      }
    }

    if (pageNew.length === 0 && !fullReconcile) break;
    if (result.stopOnEmptyResponse && result.bookmarks.length === 0) break;

    if (pageNew.length > 0) {
      for (const b of pageNew) {
        seen.add(b.tweetId);
      }
      allNew.push(...pageNew);
      await onPage?.(pageNew);
    }

    const nextCursor = result.cursor || undefined;
    if (!nextCursor) break;
    if (nextCursor === cursor) break;
    cursor = nextCursor;
  }

  if (pagesRequested === 1 && allNew.length > 0 && !cursor) {
    console.warn("[totem] Sync stopped after 1 page (" + allNew.length +
      " bookmarks) — no cursor in response. Check API response format.");
  }

  let staleIds: string[] = [];
  if (fullReconcile) {
    staleIds = [...localIds].filter((id) => !remoteIds.has(id));
  }

  return { newBookmarks: allNew, staleIds, pagesRequested };
}
