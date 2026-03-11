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

  const idsToDelete = Array.from(
    new Set(deleteEvents.map((e) => e.tweetId).filter(Boolean)),
  );

  const needsPageFetch = createEvents.length > 0;
  const ackIds = events.map((e) => e.id);

  return {
    idsToDelete,
    needsPageFetch,
    ackIds,
  };
}
