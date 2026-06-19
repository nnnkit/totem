import { describe, expect, it, vi } from "vitest";
import {
  selectFooterState,
  selectRuntimeMode,
  selectSyncButtonState,
  type RuntimeState,
} from "../runtime-store";

const noop = async () => {};

function makeState(overrides: Partial<RuntimeState> = {}): RuntimeState {
  return {
    authPhase: "ready",
    authState: "authenticated",
    sessionState: "logged_in",
    capability: {
      bookmarksApi: "ready",
      detailApi: "ready",
    },
    activeAccountId: "acct-1",
    authRetryDelayMs: null,
    bookmarksLoaded: true,
    detailedIdsLoaded: true,
    bookmarks: [],
    detailedTweetIds: new Set<string>(),
    syncStatus: "idle",
    syncJobKind: "none",
    syncBlockedReason: null,
    bootGeneration: 1,
    syncGeneration: 1,
    readerActive: false,
    prefetchStatus: "idle",
    lastSyncAt: 0,
    actions: {
      boot: noop,
      dispose: vi.fn(),
      checkAuth: noop,
      connectingTimeout: vi.fn(),
      startLogin: noop,
      refresh: async () => ({ accepted: true }),
      reloadLocalData: noop,
      handleBookmarkEvents: noop,
      prepareForReset: vi.fn(),
      unbookmark: async () => ({}),
      releaseLease: vi.fn(),
      setReaderActive: vi.fn(),
      detailCached: vi.fn(),
      loadReaderDetail: async () => ({ focalTweet: null, thread: [] }),
      applyRuntimeSnapshot: async () => {},
    },
    ...overrides,
  };
}

describe("runtime selectors", () => {
  it("prefers cached offline mode when logged out with detailed bookmarks", () => {
    const state = makeState({
      authPhase: "need_login",
      authState: "logged_out",
      sessionState: "logged_out",
      bookmarks: [{
        id: "tweet-1",
        tweetId: "tweet-1",
        text: "Hello",
        createdAt: 1,
        sortIndex: "tweet-1",
        bookmarked: false,
        author: {
          name: "Author",
          screenName: "author",
          profileImageUrl: "https://example.com/avatar.png",
          verified: false,
        },
        metrics: {
          likes: 0,
          retweets: 0,
          replies: 0,
          views: 0,
          bookmarks: 0,
        },
        media: [],
        urls: [],
        isThread: false,
        hasImage: false,
        hasVideo: false,
        hasLink: false,
        quotedTweet: null,
      }],
      detailedTweetIds: new Set(["tweet-1"]),
    });

    expect(selectRuntimeMode(state)).toBe("offline_cached");
    expect(selectFooterState(state, true)).toBe("bookmark_card");
  });

  it("shows a blocking bootstrap footer while the first sync is still seeding content", () => {
    const state = makeState({
      bookmarks: [],
      syncStatus: "syncing",
      syncJobKind: "bootstrap",
    });

    expect(selectFooterState(state, false)).toBe("syncing_bootstrap");
    expect(selectSyncButtonState(state).visible).toBe(false);
  });

  it("treats logged-in state as online_ready regardless of bookmarksApi", () => {
    const state = makeState({
      capability: {
        bookmarksApi: "blocked",
        detailApi: "ready",
      },
    });

    expect(selectRuntimeMode(state)).toBe("online_ready");
  });

  it("shows empty_can_sync before first sync and empty_synced_clean after sync confirmed 0 bookmarks", () => {
    const neverSynced = makeState({ bookmarks: [], lastSyncAt: 0 });
    expect(selectFooterState(neverSynced, false)).toBe("empty_can_sync");

    const syncedEmpty = makeState({ bookmarks: [], lastSyncAt: 1750000000000 });
    expect(selectFooterState(syncedEmpty, false)).toBe("empty_synced_clean");
  });
});
