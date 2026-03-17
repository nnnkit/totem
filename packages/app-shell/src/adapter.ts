import type { SyncRequestResult, TweetDetailCache } from "@totem/contracts";
import type { TotemSeedPayload } from "@totem/contracts";

export interface ShellAdapter {
  kind: "extension" | "site-demo";
  boot(): Promise<TotemSeedPayload>;
  loadDetail(tweetId: string): Promise<TweetDetailCache>;
  sync?(): Promise<SyncRequestResult>;
  startLogin?(): Promise<void>;
  unbookmark?(tweetId: string): Promise<{ apiError?: string }>;
  resetLocalData(): Promise<void>;
  capabilities: {
    canSync: boolean;
    canUseChromePermissions: boolean;
    canOpenSharedTweetInExtension: boolean;
  };
}
