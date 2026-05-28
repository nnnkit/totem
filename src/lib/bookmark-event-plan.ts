import type { BookmarkChangeEvent } from "../api/core/bookmarks";

export interface BookmarkEventPlan {
  idsToDelete: string[];
  needsPageFetch: boolean;
  ackIds: string[];
}

const EMPTY_PLAN: BookmarkEventPlan = {
  idsToDelete: [],
  needsPageFetch: false,
  ackIds: [],
};

export function resolveBookmarkEventPlan(
  events: BookmarkChangeEvent[],
): BookmarkEventPlan {
  if (events.length === 0) return EMPTY_PLAN;

  const deleteEvents = events.filter((e) => e.type === "DeleteBookmark");
  const createEvents = events.filter((e) => e.type === "CreateBookmark");

  const idsToDeleteSet = new Set<string>();
  for (const event of deleteEvents) {
    if (event.tweetId) idsToDeleteSet.add(event.tweetId);
  }
  const idsToDelete = Array.from(idsToDeleteSet);

  const needsPageFetch = createEvents.length > 0;
  const ackIds = events.map((e) => e.id);

  return {
    idsToDelete,
    needsPageFetch,
    ackIds,
  };
}
