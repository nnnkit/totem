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
  maxPages?: number;
  maxBookmarks?: number;
}

export async function reconcileBookmarks(
  opts: ReconcileOptions,
): Promise<ReconcileResult> {
  const {
    localIds,
    fetchPage,
    fullReconcile,
    onPage,
    maxPages,
    maxBookmarks,
  } = opts;
  const seen = new Set(localIds);
  const seenCursors = new Set<string>();
  const remoteIds = new Set<string>();
  const allNew: Bookmark[] = [];
  let cursor: string | undefined;
  let pagesRequested = 0;
  const cappedMode = !fullReconcile;
  const effectiveMaxPages =
    cappedMode && Number.isFinite(maxPages) && (maxPages || 0) > 0
      ? Math.floor(maxPages as number)
      : Number.POSITIVE_INFINITY;
  const effectiveMaxBookmarks =
    cappedMode && Number.isFinite(maxBookmarks) && (maxBookmarks || 0) > 0
      ? Math.floor(maxBookmarks as number)
      : Number.POSITIVE_INFINITY;

  while (true) {
    if (pagesRequested >= effectiveMaxPages) break;
    if (allNew.length >= effectiveMaxBookmarks) break;

    if (cursor) {
      if (seenCursors.has(cursor)) break;
      seenCursors.add(cursor);
    }

    const result = await fetchPage(cursor);
    pagesRequested++;

    const pageNewRaw = result.bookmarks.filter((b) => !seen.has(b.tweetId));
    const remaining = effectiveMaxBookmarks - allNew.length;
    const pageNew =
      remaining > 0 ? pageNewRaw.slice(0, remaining) : [];

    if (fullReconcile) {
      for (const b of result.bookmarks) {
        remoteIds.add(b.tweetId);
      }
    }

    if (pageNewRaw.length === 0 && !fullReconcile) break;
    if (result.stopOnEmptyResponse && result.bookmarks.length === 0) break;

    if (pageNew.length > 0) {
      for (const b of pageNew) {
        seen.add(b.tweetId);
      }
      allNew.push(...pageNew);
      await onPage?.(pageNew);
    }
    if (allNew.length >= effectiveMaxBookmarks) break;

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
