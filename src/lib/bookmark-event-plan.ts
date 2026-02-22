import type { BookmarkChangeEvent } from "../api/core/bookmarks";

// ─────────────────────────────────────────────────────────
// The plan returned by resolveBookmarkEventPlan().
// The consumer (useBookmarks) executes each field in order.
// ─────────────────────────────────────────────────────────

export interface BookmarkEventPlan {
  /** Tweet IDs to remove from local state + IndexedDB. */
  idsToDelete: string[];

  /**
   * Whether to fetch a small page of bookmarks (count ≈ 20) and add
   * anything missing from local state. True when create events exist.
   */
  needsPageFetch: boolean;

  /** Event IDs to acknowledge (remove from the service worker queue). */
  ackIds: string[];
}

const EMPTY_PLAN: BookmarkEventPlan = {
  idsToDelete: [],
  needsPageFetch: false,
  ackIds: [],
};

// ─────────────────────────────────────────────────────────
// Decision logic — pure function, no side effects.
//
// Receives:
//   events     — raw bookmark mutation events from the service worker
//   localIds   — tweet IDs currently in the app's bookmark list
//
// Decision rules:
//
// DELETE events
//   • Events with a non-empty tweetId:
//       → Add tweetId to idsToDelete (targeted removal from state + DB).
//       → No API call needed — x.com already processed the deletion.
//   • Events with an empty tweetId (rare — extraction failed):
//       → Ack and move on. Next full refresh will clean up.
//   • All delete events are always acked.
//
// CREATE events
//   • Any create event → needsPageFetch = true.
//     The consumer fetches 1 small page (count ≈ 20) from the Bookmarks
//     API and adds whatever is missing from local state.
//   • All create events are always acked.
// ─────────────────────────────────────────────────────────

export function resolveBookmarkEventPlan(
  events: BookmarkChangeEvent[],
): BookmarkEventPlan {
  if (events.length === 0) return EMPTY_PLAN;

  const deleteEvents = events.filter((e) => e.type === "DeleteBookmark");
  const createEvents = events.filter((e) => e.type === "CreateBookmark");

  // ── Deletes: targeted removal by tweetId ──

  const idsToDelete = Array.from(
    new Set(deleteEvents.map((e) => e.tweetId).filter(Boolean)),
  );

  // ── Creates: fetch 1 small page and diff ──

  const needsPageFetch = createEvents.length > 0;

  // Every event gets acked — we've extracted all useful info from them.
  const ackIds = events.map((e) => e.id);

  return {
    idsToDelete,
    needsPageFetch,
    ackIds,
  };
}
