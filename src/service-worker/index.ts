/**
 * Service worker entry point.
 *
 * Merges handler maps from each module, registers Chrome API listeners
 * (message routing, webRequest header capture, action click), and runs
 * startup initialization.
 */

import type { MessageRequest } from "../types/messages";
import {
  markAuthAuthenticated,
  markAuthLoggedOut,
  recordWeakAuthNegativeSignal,
  setAuthState,
  authHandlers,
} from "./auth";
import { captureGraphqlEndpoint, discoverAllMissingQueryIds, queryIdHandlers } from "./query-id";
import { syncHandlers } from "./sync";
import { apiProxyHandlers } from "./api-proxy";
import { pushBookmarkEvent, eventHandlers } from "./events";
import {
  parseTwidUserId,
  getCookieHeaderValue,
  normalizeAuthState,
  parseBookmarkMutation,
  extractTweetIdFromVariables,
  extractGraphqlOperationName,
} from "../lib/sw-pure";
import { CS_ACCOUNT_CONTEXT_ID } from "../lib/storage-keys";

// ── Types ────────────────────────────────────────────────────

export type Handler = (
  message: MessageRequest,
  sender: chrome.runtime.MessageSender,
) => Promise<unknown>;

export type HandlerMap = Record<string, Handler>;

// ── Constants ────────────────────────────────────────────────

const CAPTURED_HEADERS = new Set([
  "authorization",
  "accept-language",
  "cookie",
  "x-csrf-token",
  "x-client-uuid",
  "x-client-transaction-id",
  "x-twitter-active-user",
  "x-twitter-auth-type",
  "x-twitter-client-language",
]);

const AUTH_PROTECTED_OPERATIONS = new Set([
  "Bookmarks",
  "TweetDetail",
  "DeleteBookmark",
  "CreateBookmark",
]);

// ── Handler map utilities ────────────────────────────────────

export function mergeHandlerMaps(...maps: HandlerMap[]): HandlerMap {
  const merged: HandlerMap = {};
  for (const map of maps) {
    for (const key of Object.keys(map)) {
      if (merged[key]) {
        throw new Error(`Duplicate handler for message type: ${key}`);
      }
      merged[key] = map[key];
    }
  }
  return merged;
}

export function createMessageRouter(handlers: HandlerMap) {
  return (
    message: unknown,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: unknown) => void,
  ): boolean => {
    if (!message || typeof message !== "object" || !("type" in message)) {
      return false;
    }

    const { type } = message as { type: string };
    const handler = handlers[type];
    if (!handler) {
      return false;
    }

    handler(message as MessageRequest, sender)
      .then(sendResponse)
      .catch((err: unknown) => {
        const errorMessage =
          err instanceof Error ? err.message : "UNKNOWN_ERROR";
        sendResponse({ error: errorMessage });
      });

    return true;
  };
}

// ── No-op handler ────────────────────────────────────────────

export const pingHandler: HandlerMap = {
  PING: async () => ({ ok: true, pong: true }),
};

// ── Extra handlers not in any module ─────────────────────────

const extraHandlers: HandlerMap = {
  OPEN_TOTEM_READER: async (message: MessageRequest) => {
    const msg = message as MessageRequest & { tweetId?: string };
    const tweetId = typeof msg.tweetId === "string" ? msg.tweetId : "";
    if (!tweetId || !/^\d{1,20}$/.test(tweetId)) {
      return { error: "INVALID_TWEET_ID" };
    }
    const readParam = `?read=${encodeURIComponent(tweetId)}`;
    const tab = await chrome.tabs.create({
      url: chrome.runtime.getURL(`reader.html${readParam}`),
      active: true,
    });
    return { ok: true, tabId: tab?.id };
  },
};

// ── All module handler maps, merged into one ─────────────────

export const allHandlers: HandlerMap = mergeHandlerMaps(
  pingHandler,
  authHandlers,
  queryIdHandlers,
  syncHandlers,
  apiProxyHandlers,
  eventHandlers,
  extraHandlers,
);

// ── Helpers ──────────────────────────────────────────────────

function isExtensionInitiated(
  details: { initiator?: string },
): boolean {
  return (
    typeof details.initiator === "string" &&
    details.initiator.startsWith("chrome-extension://")
  );
}

function isAuthProtectedOperation(url: string): boolean {
  return AUTH_PROTECTED_OPERATIONS.has(extractGraphqlOperationName(url));
}

function decodeBodyBytes(bytes: ArrayBuffer | undefined): string {
  if (!bytes) return "";
  try {
    return new TextDecoder().decode(bytes);
  } catch {
    return "";
  }
}

function parseJsonSafe(text: unknown): unknown {
  if (typeof text !== "string" || !text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function extractTweetIdFromRequestBody(
  requestBody: chrome.webRequest.WebRequestBody | undefined,
): string | null {
  if (!requestBody) return null;

  if (requestBody.formData) {
    const formData = requestBody.formData;
    const direct = formData["tweet_id"] || formData["tweetId"];
    if (Array.isArray(direct) && typeof direct[0] === "string" && direct[0]) {
      return direct[0];
    }
    const variablesRaw = Array.isArray(formData["variables"])
      ? formData["variables"][0]
      : null;
    const parsed = parseJsonSafe(variablesRaw);
    const tweetId = extractTweetIdFromVariables(parsed);
    if (tweetId) return tweetId;
  }

  const rawParts = Array.isArray(requestBody.raw) ? requestBody.raw : [];
  for (const part of rawParts) {
    const text = decodeBodyBytes(part.bytes).trim();
    if (!text) continue;

    const parsedJson = parseJsonSafe(text) as Record<string, unknown> | null;
    if (parsedJson && typeof parsedJson === "object") {
      const direct = extractTweetIdFromVariables(parsedJson.variables);
      if (direct) return direct;
      const nested = extractTweetIdFromVariables(parsedJson);
      if (nested) return nested;
    }

    try {
      const search = new URLSearchParams(text);
      const varsFromQuery = parseJsonSafe(search.get("variables"));
      const fromVars = extractTweetIdFromVariables(varsFromQuery);
      if (fromVars) return fromVars;
      const directParam = search.get("tweet_id") || search.get("tweetId");
      if (directParam) return directParam;
    } catch {
      // ignore parse errors
    }
  }

  return null;
}

// ══════════════════════════════════════════════════════════════
// CHROME LISTENER REGISTRATIONS
// Guard: only run in real service worker environment (not tests)
// ══════════════════════════════════════════════════════════════

const hasChromeRuntime =
  typeof chrome !== "undefined" &&
  chrome.runtime &&
  typeof chrome.runtime.onMessage?.addListener === "function";

if (hasChromeRuntime) {

// ── Message router ───────────────────────────────────────────

chrome.runtime.onMessage.addListener(createMessageRouter(allHandlers));

// ── Auth header capture from x.com traffic ───────────────────

chrome.webRequest.onSendHeaders.addListener(
  (details) => {
    if (!details.requestHeaders) return;
    const extensionInitiated = isExtensionInitiated(details);

    const headers: Record<string, string> = {};
    for (const header of details.requestHeaders) {
      const name = header.name.toLowerCase();
      if (CAPTURED_HEADERS.has(name) && header.value) {
        headers[name] = header.value;
      }
    }

    // Extract user ID from cookie
    const twidRaw = getCookieHeaderValue(headers["cookie"], "twid");
    const userIdFromHeader = parseTwidUserId(twidRaw);
    if (userIdFromHeader) {
      chrome.storage.local
        .set({
          totem_user_id: userIdFromHeader,
          [CS_ACCOUNT_CONTEXT_ID]: userIdFromHeader,
        })
        .catch(() => {});
    }

    // Track auth state from protected operations
    const protectedOperation = isAuthProtectedOperation(details.url);
    const hasAuthTrio = Boolean(
      headers["authorization"] &&
        headers["cookie"] &&
        headers["x-csrf-token"],
    );
    if (protectedOperation && !extensionInitiated) {
      if (hasAuthTrio) {
        markAuthAuthenticated("headers_trio", chrome.storage.local).catch(() => {});
      } else {
        recordWeakAuthNegativeSignal("headers_missing_auth_trio", chrome.storage.local).catch(() => {});
      }
    }

    // Store auth headers (only from real user browsing, not extension requests)
    if (
      !extensionInitiated &&
      headers["authorization"] &&
      headers["cookie"] &&
      headers["x-csrf-token"]
    ) {
      chrome.storage.local.set({
        totem_auth_headers: headers,
        totem_auth_time: Date.now(),
      });
      discoverAllMissingQueryIds().catch(() => {});
    }

    // Capture GraphQL endpoint into catalog
    captureGraphqlEndpoint(details);

    // Capture bookmarks features for request params
    const match = details.url.match(/\/i\/api\/graphql\/[^/]+\/Bookmarks\?(.+)/);
    if (match) {
      try {
        const params = new URLSearchParams(match[1]);
        const features = params.get("features");
        if (features) chrome.storage.local.set({ totem_features: features });
      } catch {
        // ignore parse errors
      }
    }
  },
  { urls: ["https://x.com/i/api/graphql/*"] },
  ["requestHeaders", "extraHeaders"],
);

// ── Bookmark mutation capture (before request) ───────────────

chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (isExtensionInitiated(details)) return;
    const mutation = parseBookmarkMutation(details.url);
    if (!mutation) return;

    const tweetId = extractTweetIdFromRequestBody(details.requestBody ?? undefined) || "";

    // For deletes, push event immediately (targeted local removal, no API call needed).
    // For creates, wait for onCompleted — x.com hasn't confirmed yet.
    if (mutation.operation === "DeleteBookmark") {
      pushBookmarkEvent("DeleteBookmark", tweetId, "x.com").catch(() => {});
    }
  },
  {
    urls: [
      "https://x.com/i/api/graphql/*/DeleteBookmark*",
      "https://x.com/i/api/graphql/*/CreateBookmark*",
    ],
  },
  ["requestBody"],
);

// ── Bookmark mutation completion ─────────────────────────────

chrome.webRequest.onCompleted.addListener(
  (details) => {
    if (isExtensionInitiated(details)) return;
    if (details.statusCode < 200 || details.statusCode >= 300) return;
    const mutation = parseBookmarkMutation(details.url);
    if (!mutation) return;

    // For creates, x.com has confirmed — a page fetch will find the bookmark.
    if (mutation.operation === "CreateBookmark") {
      pushBookmarkEvent("CreateBookmark", "", "x.com-completed").catch(() => {});
    }
  },
  {
    urls: [
      "https://x.com/i/api/graphql/*/DeleteBookmark*",
      "https://x.com/i/api/graphql/*/CreateBookmark*",
    ],
  },
);

// ── Auth state tracking from API response status ─────────────

chrome.webRequest.onCompleted.addListener(
  (details) => {
    if (isExtensionInitiated(details)) return;
    if (!isAuthProtectedOperation(details.url)) return;

    if (details.statusCode === 401 || details.statusCode === 403) {
      markAuthLoggedOut(`completed_${details.statusCode}`, true, chrome.storage.local).catch(() => {});
      return;
    }
    if (details.statusCode >= 200 && details.statusCode < 300) {
      markAuthAuthenticated("completed_ok", chrome.storage.local).catch(() => {});
    }
  },
  { urls: ["https://x.com/i/api/graphql/*"] },
);

// ── Extension icon click ─────────────────────────────────────

chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL("newtab.html") });
});

// ══════════════════════════════════════════════════════════════
// STARTUP
// ══════════════════════════════════════════════════════════════

// On startup, normalize auth state and proactively discover query IDs.
chrome.storage.local.get(
  ["totem_auth_headers", "totem_auth_state"],
  (stored: Record<string, unknown>) => {
    const authHeaders = stored.totem_auth_headers as Record<string, string> | undefined;
    const hasAuthHeader = Boolean(authHeaders?.authorization);
    const state = normalizeAuthState(stored.totem_auth_state, hasAuthHeader);

    if (hasAuthHeader) {
      if (state !== "authenticated" && state !== "stale") {
        setAuthState("stale", "startup_has_auth", {}, chrome.storage.local).catch(() => {});
      }
      discoverAllMissingQueryIds().catch(() => {});
      return;
    }
    if (state !== "logged_out") {
      setAuthState("logged_out", "startup_no_auth", { clearAuth: false }, chrome.storage.local).catch(() => {});
    }
  },
);

} // end hasChromeRuntime guard
