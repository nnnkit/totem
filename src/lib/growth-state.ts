import {
  ACTIVATION_READER_OPEN_THRESHOLD,
  ACTIVATION_WINDOW_MS,
  REENGAGEMENT_NUDGE_DELAY_MS,
  REVIEW_PROMPT_READER_OPEN_THRESHOLD,
} from "./constants/growth";
import { CS_GROWTH_STATE } from "./storage-keys";

const CURRENT_VERSION = 1;
const MAX_READER_OPEN_EVENTS = 40;
const DUPLICATE_READER_OPEN_WINDOW_MS = 2 * 60 * 1000;

export interface ReaderOpenEvent {
  tweetId: string;
  at: number;
}

export interface GrowthState {
  version: 1;
  installedAt: number;
  onboarding: {
    showRequestedAt: number | null;
    shownAt: number | null;
    completedAt: number | null;
    dismissedAt: number | null;
  };
  activation: {
    firstSyncedAt: number | null;
    lastSyncedAt: number | null;
    lastBookmarkCount: number;
    readerOpens: ReaderOpenEvent[];
    activatedAt: number | null;
    reengagementPromptedAt: number | null;
    reengagementDismissedAt: number | null;
  };
  review: {
    readerOpenCount: number;
    promptedAt: number | null;
    dismissedAt: number | null;
    reviewedAt: number | null;
  };
}

export function createGrowthState(now = Date.now()): GrowthState {
  return {
    version: CURRENT_VERSION,
    installedAt: now,
    onboarding: {
      showRequestedAt: null,
      shownAt: null,
      completedAt: null,
      dismissedAt: null,
    },
    activation: {
      firstSyncedAt: null,
      lastSyncedAt: null,
      lastBookmarkCount: 0,
      readerOpens: [],
      activatedAt: null,
      reengagementPromptedAt: null,
      reengagementDismissedAt: null,
    },
    review: {
      readerOpenCount: 0,
      promptedAt: null,
      dismissedAt: null,
      reviewedAt: null,
    },
  };
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeReaderOpens(value: unknown): ReaderOpenEvent[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((event) => {
    if (!event || typeof event !== "object") return [];
    const record = event as Record<string, unknown>;
    const tweetId = typeof record.tweetId === "string" ? record.tweetId : "";
    const at = finiteNumber(record.at);
    if (!tweetId || at === null || at <= 0) return [];
    return [{ tweetId, at }];
  });
}

export function normalizeGrowthState(raw: unknown, now = Date.now()): GrowthState {
  const base = createGrowthState(now);
  if (!raw || typeof raw !== "object") return base;
  const root = raw as Record<string, unknown>;
  const onboarding =
    root.onboarding && typeof root.onboarding === "object"
      ? (root.onboarding as Record<string, unknown>)
      : {};
  const activation =
    root.activation && typeof root.activation === "object"
      ? (root.activation as Record<string, unknown>)
      : {};
  const review =
    root.review && typeof root.review === "object"
      ? (root.review as Record<string, unknown>)
      : {};

  return {
    version: CURRENT_VERSION,
    installedAt: finiteNumber(root.installedAt) ?? base.installedAt,
    onboarding: {
      showRequestedAt: finiteNumber(onboarding.showRequestedAt),
      shownAt: finiteNumber(onboarding.shownAt),
      completedAt: finiteNumber(onboarding.completedAt),
      dismissedAt: finiteNumber(onboarding.dismissedAt),
    },
    activation: {
      firstSyncedAt: finiteNumber(activation.firstSyncedAt),
      lastSyncedAt: finiteNumber(activation.lastSyncedAt),
      lastBookmarkCount: finiteNumber(activation.lastBookmarkCount) ?? 0,
      readerOpens: normalizeReaderOpens(activation.readerOpens),
      activatedAt: finiteNumber(activation.activatedAt),
      reengagementPromptedAt: finiteNumber(activation.reengagementPromptedAt),
      reengagementDismissedAt: finiteNumber(activation.reengagementDismissedAt),
    },
    review: {
      readerOpenCount: finiteNumber(review.readerOpenCount) ?? 0,
      promptedAt: finiteNumber(review.promptedAt),
      dismissedAt: finiteNumber(review.dismissedAt),
      reviewedAt: finiteNumber(review.reviewedAt),
    },
  };
}

function isDuplicateReaderOpen(
  events: ReaderOpenEvent[],
  tweetId: string,
  now: number,
): boolean {
  const last = events.at(-1);
  return Boolean(
    last &&
      last.tweetId === tweetId &&
      now - last.at >= 0 &&
      now - last.at < DUPLICATE_READER_OPEN_WINDOW_MS,
  );
}

function trailingReaderOpens(events: ReaderOpenEvent[], now: number): ReaderOpenEvent[] {
  return events
    .filter((event) => now - event.at <= ACTIVATION_WINDOW_MS)
    .slice(-MAX_READER_OPEN_EVENTS);
}

function countUniqueTweetIds(events: ReaderOpenEvent[]): number {
  return new Set(events.map((event) => event.tweetId)).size;
}

export function applyBookmarksSynced(
  state: GrowthState,
  bookmarkCount: number,
  now = Date.now(),
): GrowthState {
  if (bookmarkCount <= 0) return state;
  return {
    ...state,
    activation: {
      ...state.activation,
      firstSyncedAt: state.activation.firstSyncedAt ?? now,
      lastSyncedAt: now,
      lastBookmarkCount: bookmarkCount,
    },
  };
}

export function applyReaderOpen(
  state: GrowthState,
  tweetId: string,
  now = Date.now(),
): GrowthState {
  if (!tweetId) return state;
  if (isDuplicateReaderOpen(state.activation.readerOpens, tweetId, now)) {
    return state;
  }

  const readerOpens = trailingReaderOpens(
    [...state.activation.readerOpens, { tweetId, at: now }],
    now,
  );
  const activated =
    state.activation.activatedAt !== null ||
    countUniqueTweetIds(readerOpens) >= ACTIVATION_READER_OPEN_THRESHOLD;

  return {
    ...state,
    activation: {
      ...state.activation,
      readerOpens,
      activatedAt: state.activation.activatedAt ?? (activated ? now : null),
    },
    review: {
      ...state.review,
      readerOpenCount: state.review.readerOpenCount + 1,
    },
  };
}

export function shouldShowReviewPrompt(state: GrowthState): boolean {
  return (
    state.review.readerOpenCount >= REVIEW_PROMPT_READER_OPEN_THRESHOLD &&
    state.review.dismissedAt === null &&
    state.review.reviewedAt === null
  );
}

export function shouldShowOnboarding(
  state: GrowthState,
  options: { requestedByUrl?: boolean; bookmarkCount?: number } = {},
): boolean {
  if (state.onboarding.completedAt !== null || state.onboarding.dismissedAt !== null) {
    return false;
  }
  if (options.requestedByUrl) return true;
  if (state.onboarding.showRequestedAt !== null && state.onboarding.shownAt === null) {
    return true;
  }
  return (options.bookmarkCount ?? 0) === 0 && state.onboarding.shownAt === null;
}

export function shouldShowReengagementNudge(
  state: GrowthState,
  bookmarkCount: number,
  now = Date.now(),
): boolean {
  const firstSyncedAt = state.activation.firstSyncedAt;
  if (bookmarkCount <= 0 || firstSyncedAt === null) return false;
  if (state.activation.readerOpens.length > 0) return false;
  if (state.activation.reengagementPromptedAt !== null) return false;
  if (state.activation.reengagementDismissedAt !== null) return false;
  return now - firstSyncedAt >= REENGAGEMENT_NUDGE_DELAY_MS;
}

function hasChromeStorageLocal(): boolean {
  return typeof chrome !== "undefined" && Boolean(chrome.storage?.local);
}

async function mutateGrowthState(
  mutator: (state: GrowthState) => GrowthState,
  now = Date.now(),
): Promise<GrowthState> {
  const current = await readGrowthState(now);
  const next = mutator(current);
  if (hasChromeStorageLocal()) {
    await chrome.storage.local.set({ [CS_GROWTH_STATE]: next });
  }
  return next;
}

export async function readGrowthState(now = Date.now()): Promise<GrowthState> {
  if (!hasChromeStorageLocal()) return createGrowthState(now);
  const stored = await chrome.storage.local.get([CS_GROWTH_STATE]);
  return normalizeGrowthState(stored[CS_GROWTH_STATE], now);
}

export function recordBookmarksSynced(
  bookmarkCount: number,
  now = Date.now(),
): Promise<GrowthState> {
  return mutateGrowthState(
    (state) => applyBookmarksSynced(state, bookmarkCount, now),
    now,
  );
}

export function recordReaderOpen(
  tweetId: string,
  now = Date.now(),
): Promise<GrowthState> {
  return mutateGrowthState((state) => applyReaderOpen(state, tweetId, now), now);
}

export function requestOnboardingForInstall(now = Date.now()): Promise<GrowthState> {
  return mutateGrowthState(
    (state) => ({
      ...state,
      installedAt: state.installedAt || now,
      onboarding: {
        ...state.onboarding,
        showRequestedAt: state.onboarding.showRequestedAt ?? now,
      },
    }),
    now,
  );
}

export function markOnboardingShown(now = Date.now()): Promise<GrowthState> {
  return mutateGrowthState(
    (state) => ({
      ...state,
      onboarding: {
        ...state.onboarding,
        shownAt: state.onboarding.shownAt ?? now,
      },
    }),
    now,
  );
}

export function markOnboardingCompleted(now = Date.now()): Promise<GrowthState> {
  return mutateGrowthState(
    (state) => ({
      ...state,
      onboarding: {
        ...state.onboarding,
        completedAt: state.onboarding.completedAt ?? now,
        dismissedAt: state.onboarding.dismissedAt,
      },
    }),
    now,
  );
}

export function markReviewPrompted(now = Date.now()): Promise<GrowthState> {
  return mutateGrowthState(
    (state) => ({
      ...state,
      review: {
        ...state.review,
        promptedAt: state.review.promptedAt ?? now,
      },
    }),
    now,
  );
}

export function markReviewDismissed(now = Date.now()): Promise<GrowthState> {
  return mutateGrowthState(
    (state) => ({
      ...state,
      review: {
        ...state.review,
        dismissedAt: state.review.dismissedAt ?? now,
      },
    }),
    now,
  );
}

export function markReviewClicked(now = Date.now()): Promise<GrowthState> {
  return mutateGrowthState(
    (state) => ({
      ...state,
      review: {
        ...state.review,
        reviewedAt: state.review.reviewedAt ?? now,
      },
    }),
    now,
  );
}

export function markReengagementPrompted(now = Date.now()): Promise<GrowthState> {
  return mutateGrowthState(
    (state) => ({
      ...state,
      activation: {
        ...state.activation,
        reengagementPromptedAt: state.activation.reengagementPromptedAt ?? now,
      },
    }),
    now,
  );
}

export function markReengagementDismissed(now = Date.now()): Promise<GrowthState> {
  return mutateGrowthState(
    (state) => ({
      ...state,
      activation: {
        ...state.activation,
        reengagementDismissedAt: state.activation.reengagementDismissedAt ?? now,
      },
    }),
    now,
  );
}
