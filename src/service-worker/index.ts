/**
 * Service worker message router.
 * Merges handler maps from each module and dispatches
 * incoming chrome.runtime.onMessage events.
 */

import type { MessageRequest } from "../types/messages";
import { queryIdHandlers } from "./query-id";

export type Handler = (
  message: MessageRequest,
  sender: chrome.runtime.MessageSender,
) => Promise<unknown>;

export type HandlerMap = Record<string, Handler>;

/**
 * Merges multiple handler maps into a single map.
 * Throws if duplicate message type keys are found.
 */
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

/**
 * Creates a chrome.runtime.onMessage listener that dispatches
 * to the appropriate handler based on message.type.
 */
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

    // Indicates async response
    return true;
  };
}

// ── No-op handler to prove the pattern works end-to-end ────

export const pingHandler: HandlerMap = {
  PING: async () => ({ ok: true, pong: true }),
};

// ── All module handler maps, merged into one ────────────────

export const allHandlers: HandlerMap = mergeHandlerMaps(
  pingHandler,
  queryIdHandlers,
);
