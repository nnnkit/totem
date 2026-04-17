import type { Bookmark, BookmarkIntent, IntentSource } from "../types";
import { getAllBookmarks, upsertBookmarks } from "./index";

export interface IntentUpdate {
  intent: BookmarkIntent;
  intentSource: IntentSource;
  intentConfidence?: number;
}

export async function getIntent(
  bookmarkId: string,
): Promise<BookmarkIntent | null> {
  const all = await getAllBookmarks();
  const bookmark = all.find((b) => b.id === bookmarkId);
  return bookmark?.intent ?? null;
}

export async function setIntent(
  bookmarkId: string,
  update: IntentUpdate,
): Promise<void> {
  const all = await getAllBookmarks();
  const bookmark = all.find((b) => b.id === bookmarkId);
  if (!bookmark) return;

  const updated: Bookmark = {
    ...bookmark,
    intent: update.intent,
    intentSource: update.intentSource,
    intentConfidence: update.intentConfidence,
    intentAssignedAt: new Date().toISOString(),
  };
  await upsertBookmarks([updated]);
}

export async function bulkSetIntent(
  bookmarkIds: string[],
  update: IntentUpdate,
): Promise<void> {
  if (bookmarkIds.length === 0) return;

  const all = await getAllBookmarks();
  const idSet = new Set(bookmarkIds);
  const now = new Date().toISOString();
  const toUpdate: Bookmark[] = [];

  for (const bookmark of all) {
    if (idSet.has(bookmark.id)) {
      toUpdate.push({
        ...bookmark,
        intent: update.intent,
        intentSource: update.intentSource,
        intentConfidence: update.intentConfidence,
        intentAssignedAt: now,
      });
    }
  }

  if (toUpdate.length > 0) {
    await upsertBookmarks(toUpdate);
  }
}

export async function getByIntent(
  intent: BookmarkIntent,
): Promise<Bookmark[]> {
  const all = await getAllBookmarks();
  return all.filter((b) => (b.intent ?? "unsorted") === intent);
}
