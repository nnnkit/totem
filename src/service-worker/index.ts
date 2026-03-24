// Service worker entry point — message router
// Merges handler maps from modules and dispatches chrome.runtime.onMessage events

import type { MessageType } from "../types/messages";

/** A handler receives the full message and returns a response (or void). */
export type Handler = (
  message: Record<string, unknown>,
  sender: chrome.runtime.MessageSender,
) => Promise<unknown> | unknown;

/** A handler map maps message type strings to handlers. */
export type HandlerMap = Record<string, Handler>;

// ── Handler registration ─────────────────────────────────────

const handlers: HandlerMap = {};

/** Merge one or more handler maps into the router. */
export function registerHandlers(...maps: HandlerMap[]): void {
  for (const map of maps) {
    for (const [type, handler] of Object.entries(map)) {
      handlers[type] = handler;
    }
  }
}

// ── No-op ping handler (proves the pattern works) ────────────

const pingHandlers: HandlerMap = {
  PING: () => ({ ok: true, pong: true }),
};

registerHandlers(pingHandlers);

// ── Message dispatcher ───────────────────────────────────────

function dispatch(
  message: { type?: string } & Record<string, unknown>,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
): boolean {
  const type = message?.type as MessageType | undefined;
  if (!type || !(type in handlers)) {
    return false;
  }

  const handler = handlers[type];
  try {
    const result = handler(message, sender);
    if (result instanceof Promise) {
      result
        .then((response) => sendResponse(response))
        .catch((err: Error) => sendResponse({ error: err.message }));
      return true; // async — keep channel open
    }
    sendResponse(result);
    return false; // sync — already responded
  } catch (err) {
    sendResponse({ error: (err as Error).message });
    return false;
  }
}

/** Install the router on chrome.runtime.onMessage. */
export function installRouter(): void {
  chrome.runtime.onMessage.addListener(dispatch);
}

// ── Exports for testing ──────────────────────────────────────

export { handlers as _handlers, dispatch as _dispatch };
