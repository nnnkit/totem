/**
 * Bookmarks slice — bookmark data ownership and event handling.
 *
 * Owns: bookmarks[], detailedTweetIds, bookmarksLoaded, detailedIdsLoaded.
 * Handles bookmark events: processes deletes directly, delegates creates
 * to sync slice via requestSoftSync().
 *
 * Exposes: upsertBookmarks(), deleteBookmarks(), handleBookmarkEvents().
 */

import { create } from "zustand";
import type { Bookmark } from "../../types";
import type { BookmarkChangeEvent } from "../../types/messages";

// ── Types ─────────────────────────────────────────────────────

export interface BookmarksSliceState {
  bookmarks: Bookmark[];
  detailedTweetIds: Set<string>;
  bookmarksLoaded: boolean;
  detailedIdsLoaded: boolean;
}

export interface BookmarksSliceActions {
  /** Replace all bookmarks (used during hydration). */
  setBookmarks: (bookmarks: Bookmark[]) => void;
  /** Add or update bookmarks (used during sync page callbacks). */
  upsertBookmarks: (newBookmarks: Bookmark[]) => void;
  /** Remove bookmarks by tweet ID. */
  deleteBookmarks: (tweetIds: string[]) => void;
  /** Mark a tweet ID as having cached details. */
  detailCached: (tweetId: string) => void;
  /** Set detailed tweet IDs (used during hydration). */
  setDetailedTweetIds: (ids: Set<string>) => void;
  /** Set loaded flags (used during hydration lifecycle). */
  setLoaded: (opts: { bookmarks?: boolean; detailedIds?: boolean }) => void;
  /** Reset to empty state (for account change / dispose). */
  reset: () => void;
  /** Process bookmark events — deletes directly, returns create event IDs. */
  processDeleteEvents: (events: BookmarkChangeEvent[]) => string[];
}

// ── Dependencies ──────────────────────────────────────────────

export interface BookmarksSliceDeps {
  /** Persist bookmarks to IndexedDB. */
  persistBookmarks?: (bookmarks: Bookmark[]) => Promise<void>;
  /** Delete bookmarks from IndexedDB. */
  deleteFromDb?: (tweetIds: string[], opts: { purgeHighlights: boolean }) => Promise<void>;
}

// ── Helpers ───────────────────────────────────────────────────

function compareSortIndexDesc(a: Bookmark, b: Bookmark): number {
  return b.sortIndex.localeCompare(a.sortIndex);
}

const EMPTY_SET = new Set<string>();

// ── Slice factory ─────────────────────────────────────────────

export type BookmarksStore = ReturnType<typeof createBookmarksSlice>;

export function createBookmarksSlice(deps: BookmarksSliceDeps = {}) {
  const store = create<BookmarksSliceState & { actions: BookmarksSliceActions }>((set, get) => {
    const actions: BookmarksSliceActions = {
      setBookmarks: (bookmarks) => {
        set({
          bookmarks: bookmarks.toSorted(compareSortIndexDesc),
          bookmarksLoaded: true,
        });
      },

      upsertBookmarks: (newBookmarks) => {
        if (newBookmarks.length === 0) return;
        const current = get().bookmarks;
        const currentIds = new Set(current.map((b) => b.tweetId));
        const deduped = newBookmarks.filter((b) => !currentIds.has(b.tweetId));
        if (deduped.length === 0) return;

        const updated = [...current, ...deduped].toSorted(compareSortIndexDesc);
        set({ bookmarks: updated });

        if (deps.persistBookmarks) {
          deps.persistBookmarks(deduped).catch(() => {});
        }
      },

      deleteBookmarks: (tweetIds) => {
        if (tweetIds.length === 0) return;
        const toDelete = new Set(tweetIds);
        set((state) => ({
          bookmarks: state.bookmarks.filter((b) => !toDelete.has(b.tweetId)),
        }));

        if (deps.deleteFromDb) {
          deps.deleteFromDb(tweetIds, { purgeHighlights: false }).catch(() => {});
        }
      },

      detailCached: (tweetId) => {
        if (!tweetId) return;
        set((state) => {
          if (state.detailedTweetIds.has(tweetId)) return state;
          const next = new Set(state.detailedTweetIds);
          next.add(tweetId);
          return { detailedTweetIds: next };
        });
      },

      setDetailedTweetIds: (ids) => {
        set({ detailedTweetIds: ids, detailedIdsLoaded: true });
      },

      setLoaded: (opts) => {
        const patch: Partial<BookmarksSliceState> = {};
        if (opts.bookmarks !== undefined) patch.bookmarksLoaded = opts.bookmarks;
        if (opts.detailedIds !== undefined) patch.detailedIdsLoaded = opts.detailedIds;
        set(patch);
      },

      reset: () => {
        set({
          bookmarks: [],
          detailedTweetIds: EMPTY_SET,
          bookmarksLoaded: false,
          detailedIdsLoaded: false,
        });
      },

      processDeleteEvents: (events) => {
        const deleteIds: string[] = [];
        const createEventIds: string[] = [];

        for (const event of events) {
          if (event.type === "DeleteBookmark") {
            deleteIds.push(event.tweetId);
          } else if (event.type === "CreateBookmark") {
            createEventIds.push(event.id);
          }
        }

        if (deleteIds.length > 0) {
          actions.deleteBookmarks(deleteIds);
        }

        return createEventIds;
      },
    };

    return {
      bookmarks: [],
      detailedTweetIds: EMPTY_SET,
      bookmarksLoaded: false,
      detailedIdsLoaded: false,
      actions,
    };
  });

  return store;
}
