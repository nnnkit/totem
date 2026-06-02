import { afterEach, describe, expect, it, vi } from "vitest";
import { createFakeChrome } from "../../test-utils/fake-chrome";
import {
  ACTIVATION_WINDOW_MS,
  REENGAGEMENT_NUDGE_DELAY_MS,
  REVIEW_PROMPT_READER_OPEN_THRESHOLD,
} from "../constants/growth";
import {
  applyBookmarksSynced,
  applyReaderOpen,
  createGrowthState,
  markReviewDismissed,
  normalizeGrowthState,
  readGrowthState,
  recordReaderOpen,
  shouldShowOnboarding,
  shouldShowReengagementNudge,
  shouldShowReviewPrompt,
} from "../growth-state";
import { CS_GROWTH_STATE } from "../storage-keys";

describe("growth-state", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("triggers the review prompt after five reader opens", () => {
    let state = createGrowthState(1000);
    for (let i = 0; i < REVIEW_PROMPT_READER_OPEN_THRESHOLD; i += 1) {
      state = applyReaderOpen(state, `tweet-${i}`, 2000 + i * 200_000);
    }

    expect(state.review.readerOpenCount).toBe(5);
    expect(shouldShowReviewPrompt(state)).toBe(true);
  });

  it("persists review prompt dismissal in chrome storage", async () => {
    const fakeChrome = createFakeChrome();
    vi.stubGlobal("chrome", fakeChrome);

    for (let i = 0; i < REVIEW_PROMPT_READER_OPEN_THRESHOLD; i += 1) {
      await recordReaderOpen(`tweet-${i}`, 2000 + i * 200_000);
    }

    expect(shouldShowReviewPrompt(await readGrowthState())).toBe(true);

    await markReviewDismissed(9999);
    const state = await readGrowthState();
    const stored = await fakeChrome.storage.local.get([CS_GROWTH_STATE]);

    expect(state.review.dismissedAt).toBe(9999);
    expect(shouldShowReviewPrompt(state)).toBe(false);
    expect(stored[CS_GROWTH_STATE]).toMatchObject({
      review: { dismissedAt: 9999 },
    });
  });

  it("does not double count a duplicate reader open from the same mount window", () => {
    let state = createGrowthState(1000);
    state = applyReaderOpen(state, "tweet-1", 2000);
    state = applyReaderOpen(state, "tweet-1", 2500);

    expect(state.review.readerOpenCount).toBe(1);
    expect(state.activation.readerOpens).toHaveLength(1);
  });

  it("marks activation after three unique reader opens inside seven days", () => {
    let state = createGrowthState(1000);
    state = applyReaderOpen(state, "tweet-1", 2000);
    state = applyReaderOpen(state, "tweet-2", 3000);
    state = applyReaderOpen(state, "tweet-3", 4000);

    expect(state.activation.activatedAt).toBe(4000);
  });

  it("does not mark activation from reader opens outside the seven-day window", () => {
    let state = createGrowthState(1000);
    state = applyReaderOpen(state, "tweet-1", 2000);
    state = applyReaderOpen(state, "tweet-2", 3000);
    state = applyReaderOpen(state, "tweet-3", 3000 + ACTIVATION_WINDOW_MS + 1);

    expect(state.activation.activatedAt).toBeNull();
    expect(state.activation.readerOpens.map((event) => event.tweetId)).toEqual([
      "tweet-3",
    ]);
  });

  it("shows first-launch onboarding for unsynced users until it has been shown", () => {
    const state = createGrowthState(1000);

    expect(shouldShowOnboarding(state, { bookmarkCount: 0 })).toBe(true);
    expect(
      shouldShowOnboarding(
        {
          ...state,
          onboarding: { ...state.onboarding, shownAt: 2000 },
        },
        { bookmarkCount: 0 },
      ),
    ).toBe(false);
  });

  it("shows a one-time day-three nudge for synced users with no reader opens", () => {
    const now = 1000;
    const state = applyBookmarksSynced(createGrowthState(now), 47, now);

    expect(
      shouldShowReengagementNudge(
        state,
        47,
        now + REENGAGEMENT_NUDGE_DELAY_MS - 1,
      ),
    ).toBe(false);
    expect(
      shouldShowReengagementNudge(
        state,
        47,
        now + REENGAGEMENT_NUDGE_DELAY_MS,
      ),
    ).toBe(true);
    expect(
      shouldShowReengagementNudge(
        {
          ...state,
          activation: {
            ...state.activation,
            reengagementPromptedAt: now + REENGAGEMENT_NUDGE_DELAY_MS,
          },
        },
        47,
        now + REENGAGEMENT_NUDGE_DELAY_MS + 1000,
      ),
    ).toBe(false);
  });

  it("normalizes malformed stored data to the current shape", () => {
    const state = normalizeGrowthState({
      installedAt: "bad",
      activation: {
        lastBookmarkCount: 12,
        readerOpens: [
          { tweetId: "ok", at: 2000 },
          { tweetId: "", at: 3000 },
          { tweetId: "bad-time", at: "nope" },
        ],
      },
      review: {
        readerOpenCount: 4,
      },
    }, 1000);

    expect(state.installedAt).toBe(1000);
    expect(state.activation.lastBookmarkCount).toBe(12);
    expect(state.activation.readerOpens).toEqual([{ tweetId: "ok", at: 2000 }]);
    expect(state.review.readerOpenCount).toBe(4);
  });
});
