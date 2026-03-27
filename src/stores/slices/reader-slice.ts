/**
 * Reader slice — reader state: active flag, detail loading, reading progress.
 *
 * Owns: readerActive, readerTweetId.
 *
 * Exposes: openReader(tweetId), closeReader(), setReaderActive().
 */

import { create } from "zustand";

// ── Types ─────────────────────────────────────────────────────

export interface ReaderSliceState {
  readerActive: boolean;
  readerTweetId: string | null;
}

export interface ReaderSliceActions {
  /** Open reader for a specific tweet. */
  openReader: (tweetId: string) => void;
  /** Close reader. */
  closeReader: () => void;
  /** Toggle reader active state. */
  setReaderActive: (active: boolean) => void;
}

// ── Dependencies ──────────────────────────────────────────────

export interface ReaderSliceDeps {
  /** Called when reader is opened/closed for reconciliation. */
  onReconcile?: () => void;
}

// ── Slice factory ─────────────────────────────────────────────

export type ReaderStore = ReturnType<typeof createReaderSlice>;

export function createReaderSlice(deps: ReaderSliceDeps = {}) {
  const store = create<ReaderSliceState & { actions: ReaderSliceActions }>((set, get) => {
    const actions: ReaderSliceActions = {
      openReader: (tweetId) => {
        set({ readerActive: true, readerTweetId: tweetId });
        deps.onReconcile?.();
      },

      closeReader: () => {
        set({ readerActive: false, readerTweetId: null });
        deps.onReconcile?.();
      },

      setReaderActive: (active) => {
        if (get().readerActive === active) return;
        set({
          readerActive: active,
          readerTweetId: active ? get().readerTweetId : null,
        });
        deps.onReconcile?.();
      },
    };

    return {
      readerActive: false,
      readerTweetId: null,
      actions,
    };
  });

  return store;
}
