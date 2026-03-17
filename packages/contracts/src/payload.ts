import type {
  Bookmark,
  ReadingProgress,
  TweetDetailCache,
  UserSettings,
} from "./types";
import type { ThemePreference } from "./theme";

export interface TotemSeedPayload {
  version: 1;
  source: "extension-export" | "demo-fixture" | "demo-json";
  generatedAt?: string;
  bookmarks: Bookmark[];
  detailByTweetId: Record<string, TweetDetailCache>;
  readingProgress: ReadingProgress[];
  settings: UserSettings;
  themePreference: ThemePreference;
}
