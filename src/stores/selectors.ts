import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { openAccountDb, type AccountDb } from "../db";
import {
  classifyDetailError,
  type DetailErrorKind,
} from "../components/reader/detail-error";
import {
  selectActiveAccountId,
  selectAuthPhase,
  selectBookmarks,
  selectDetailedTweetIds,
  selectFooterState,
  selectIsOffline,
  selectReaderAvailabilityState,
  selectRuntimeMode,
  selectShouldRestrictToCachedDetails,
  selectSyncButtonState,
  selectSyncRetryDelay,
  selectSyncUiState,
  useRuntimeStoreBase,
  type FooterState,
  type ReaderAvailabilityState,
  type RuntimeActions,
  type RuntimeMode,
  type SyncButtonState,
  type SyncUiState,
} from "./runtime-store";

export type {
  FooterState,
  ReaderAvailabilityState,
  RuntimeMode,
  SyncButtonState,
  SyncJobKind,
  SyncUiState,
} from "./runtime-store";

export interface ReaderAvailabilitySelection extends ReaderAvailabilityState {
  errorKind: DetailErrorKind;
}

// Stable reference: `actions` is built once in createInitialState and never
// reassigned, so this selector returns the same object across renders.
// Callers can safely include the return value in a useEffect dependency array.
export function useRuntimeActions(): RuntimeActions {
  return useRuntimeStoreBase((state) => state.actions);
}

export function useAppMode(): RuntimeMode {
  return useRuntimeStoreBase(selectRuntimeMode);
}

export function useAuthPhase() {
  return useRuntimeStoreBase(selectAuthPhase);
}

export function useAuthRetryDelayMs() {
  return useRuntimeStoreBase(selectSyncRetryDelay);
}

export function useDisplayBookmarks() {
  const bookmarks = useRuntimeStoreBase(selectBookmarks);
  const detailedTweetIds = useRuntimeStoreBase(selectDetailedTweetIds);
  const restrictToCachedDetails = useRuntimeStoreBase(selectShouldRestrictToCachedDetails);

  return useMemo(() => {
    if (!restrictToCachedDetails) {
      return bookmarks;
    }
    return bookmarks.filter((bookmark) => detailedTweetIds.has(bookmark.tweetId));
  }, [bookmarks, detailedTweetIds, restrictToCachedDetails]);
}

export function useAllBookmarks() {
  return useRuntimeStoreBase(selectBookmarks);
}

// True once hydrateCurrentAccount has pointed the IDB layer at the
// active-account database. Side effects that write to IDB on page load
// must wait for this — otherwise they land in the default "totem" DB
// before setActiveAccountId runs. See reader progress write in App.tsx.
export function useBookmarksLoaded(): boolean {
  return useRuntimeStoreBase((state) => state.bookmarksLoaded);
}

export function useDetailedTweetIds() {
  return useRuntimeStoreBase(selectDetailedTweetIds);
}

export function useActiveAccountId() {
  return useRuntimeStoreBase(selectActiveAccountId);
}

// Account-bound persistence handle for the active account. openAccountDb
// memoizes per db name, so this returns a stable ref until the account changes.
export function useAccountDb(): AccountDb {
  return openAccountDb(useRuntimeStoreBase(selectActiveAccountId));
}

export function useIsOffline() {
  return useRuntimeStoreBase(selectIsOffline);
}

export function useSyncUiState(): SyncUiState {
  return useRuntimeStoreBase(useShallow(selectSyncUiState));
}

export function useSyncButtonState(): SyncButtonState {
  return useRuntimeStoreBase(useShallow(selectSyncButtonState));
}

export function useFooterState(hasCurrentItem: boolean, isResetting = false): FooterState {
  return useRuntimeStoreBase(
    (state) => selectFooterState(state, hasCurrentItem, isResetting),
  );
}

export function useReaderAvailabilityState(
  detailError: string | null = null,
): ReaderAvailabilitySelection {
  const state = useRuntimeStoreBase(useShallow(selectReaderAvailabilityState));
  return {
    ...state,
    errorKind: classifyDetailError(detailError, {
      isOnline: state.offlineMode
        ? false
        : typeof navigator !== "undefined"
          ? navigator.onLine
          : true, // Assume online when navigator is unavailable (tests)
    }),
  };
}
