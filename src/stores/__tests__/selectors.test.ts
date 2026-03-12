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
    hasQueryId: true,
    authRetryDelayMs: null,
    bookmarksLoaded: true,
    detailedIdsLoaded: true,
    bookmarks: [],
    detailedTweetIds: new Set<string>(),
    syncStatus: "idle",
    syncJobKind: "none",
    syncBlockedReason: null,
    bootPolicy: "auto",
    bootGeneration: 1,
    syncGeneration: 1,
    readerActive: false,
    prefetchStatus: "idle",
    actions: {
      boot: noop,
      dispose: vi.fn(),
      checkAuth: noop,
      connectingTimeout: vi.fn(),
      startLogin: noop,
      refresh: async () => ({ accepted: true }),
      handleBookmarkEvents: noop,
      prepareForReset: vi.fn(),
      unbookmark: async () => ({}),
      releaseLease: vi.fn(),
      setReaderActive: vi.fn(),
      detailCached: vi.fn(),
      loadReaderDetail: async () => ({ focalTweet: null, thread: [] }),
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

  it("disables sync affordances while capability is degraded", () => {
    const state = makeState({
      capability: {
        bookmarksApi: "blocked",
        detailApi: "ready",
      },
    });

    const syncButton = selectSyncButtonState(state);
    expect(selectRuntimeMode(state)).toBe("online_blocked");
    expect(selectFooterState(state, false)).toBe("preparing_sync");
    expect(syncButton.visible).toBe(false);
    expect(syncButton.disabled).toBe(true);
    expect(syncButton.title).toBe("Preparing X API...");
  });
});
