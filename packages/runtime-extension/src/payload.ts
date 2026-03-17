import { getAllReadingProgress, getTweetDetailCache } from "../../../src/db";
import type { Bookmark, ThemePreference, TotemSeedPayload, UserSettings } from "@totem/contracts";

export async function createExtensionDemoPayload(
  bookmarks: Bookmark[],
  settings: UserSettings,
  themePreference: ThemePreference,
): Promise<TotemSeedPayload> {
  const detailEntries = await Promise.all(
    bookmarks.map(async (bookmark) => {
      const detail = await getTweetDetailCache(bookmark.tweetId).catch(() => null);
      return [bookmark.tweetId, detail] as const;
    }),
  );

  const detailByTweetId: TotemSeedPayload["detailByTweetId"] = {};

  for (const [tweetId, detail] of detailEntries) {
    if (!detail) continue;
    detailByTweetId[tweetId] = detail;
  }

  const readingProgress = await getAllReadingProgress().catch(() => []);

  return {
    version: 1,
    source: "extension-export",
    generatedAt: new Date().toISOString(),
    bookmarks,
    detailByTweetId,
    readingProgress,
    settings,
    themePreference,
  };
}
