import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
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
  BootSyncPolicy,
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

export function useDetailedTweetIds() {
  return useRuntimeStoreBase(selectDetailedTweetIds);
}

export function useActiveAccountId() {
  return useRuntimeStoreBase(selectActiveAccountId);
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
        : typeof navigator === "undefined"
          ? true
          : navigator.onLine,
    }),
  };
}
