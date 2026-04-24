/**
 * Content script: runs at document_start on x.com (ISOLATED world).
 * Reads the twid cookie to detect the logged-in user ID and relays
 * mutation messages from the MAIN world hook to the service worker.
 *
 * TypeScript migration of public/content/detect-user.js.
 * Imports shared auth types for type safety across the pipeline.
 */

import { parseTwidUserId } from "../lib/sw-pure";
import type { BookmarkChangeType } from "../types/messages";
import {
  CS_ACCOUNT_CONTEXT_ID,
  CS_VIEWER_PROFILE,
} from "../lib/storage-keys";

const MESSAGE_SOURCE = "totem-bookmark-mutation";

// ── Cookie detection ────────────────────────────────────────

const twidPair = document.cookie
  .split(";")
  .map((item) => item.trim())
  .find((item) => item.startsWith("twid="));
const twidRawValue = twidPair ? twidPair.slice("twid=".length) : "";
const currentUserId = parseTwidUserId(twidRawValue);

if (currentUserId) {
  chrome.storage.local.set({
    totem_user_id: currentUserId,
    [CS_ACCOUNT_CONTEXT_ID]: currentUserId,
  });
} else {
  // User identity can disappear on logout; keep account context so the new tab
  // can still restore offline cache for the last active account. Drop the
  // cached viewer profile so stale name/avatar never paints for a logged-out user.
  chrome.storage.local.remove(["totem_user_id", CS_VIEWER_PROFILE]);
  chrome.runtime
    .sendMessage({
      type: "SESSION_USER_MISSING" as const,
      source: "detect-user",
    })
    .catch(() => {});
}

// ── Bookmark mutation relay ─────────────────────────────────

interface BookmarkMutationMessage {
  __source: string;
  type?: string;
  ids?: Record<string, string>;
  operation?: string;
  tweetId?: string;
}

function handleBookmarkMutationMessage(event: MessageEvent): void {
  if (event.source !== window) return;
  const data = event.data as BookmarkMutationMessage | null;
  if (!data || typeof data !== "object") return;
  if (data.__source !== MESSAGE_SOURCE) return;

  if (data.type === "query_ids" && data.ids && typeof data.ids === "object") {
    chrome.runtime.sendMessage({
      type: "STORE_QUERY_IDS" as const,
      ids: data.ids,
    });
    return;
  }

  const operation: BookmarkChangeType | null =
    data.operation === "CreateBookmark" || data.operation === "DeleteBookmark"
      ? data.operation
      : null;
  if (!operation) return;

  const tweetId = typeof data.tweetId === "string" ? data.tweetId : "";
  chrome.runtime.sendMessage({
    type: "BOOKMARK_MUTATION" as const,
    operation,
    tweetId,
    source: "injected-script",
  });
}

window.addEventListener("message", handleBookmarkMutationMessage);
