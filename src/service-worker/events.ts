/**
 * Bookmark events module — event capture, queue management, acknowledgment.
 *
 * Extracted from the SW monolith. Manages bookmark change events
 * (CreateBookmark, DeleteBookmark) in chrome.storage with max 400 queue.
 *
 * Handler map for GET_BOOKMARK_EVENTS, ACK_BOOKMARK_EVENTS, BOOKMARK_MUTATION.
 */

import type { MessageRequest, BookmarkChangeType } from "../types/messages";
import type { HandlerMap } from "./index";
import { CS_BOOKMARK_EVENTS } from "../lib/storage-keys";

// ── Constants ───────────────────────────────────────────────────

const MAX_BOOKMARK_EVENTS = 400;

// ── Types ───────────────────────────────────────────────────────

interface BookmarkEvent {
  id: string;
  type: BookmarkChangeType;
  tweetId: string;
  at: number;
  source: string;
}

// ── Core functions ──────────────────────────────────────────────

export async function pushBookmarkEvent(
  type: BookmarkChangeType,
  tweetId: string,
  source: string,
  storage?: typeof chrome.storage.local,
): Promise<void> {
  const s = storage ?? defaultStorage();
  const normalizedTweetId = typeof tweetId === "string" ? tweetId : "";
  const now = Date.now();
  const stored = await s.get([CS_BOOKMARK_EVENTS]);
  const existing: BookmarkEvent[] = Array.isArray(
    stored[CS_BOOKMARK_EVENTS],
  )
    ? stored[CS_BOOKMARK_EVENTS]
    : [];

  const next = existing
    .filter(
      (event) =>
        !(
          event &&
          event.tweetId === normalizedTweetId &&
          event.type === type &&
          now - Number(event.at || 0) < 1000
        ),
    )
    .concat({
      id: `${now}-${type}-${normalizedTweetId || "unknown"}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      tweetId: normalizedTweetId,
      at: now,
      source,
    });

  if (next.length > MAX_BOOKMARK_EVENTS) {
    next.splice(0, next.length - MAX_BOOKMARK_EVENTS);
  }

  await s.set({ [CS_BOOKMARK_EVENTS]: next });
}

// ── Handlers ────────────────────────────────────────────────────

interface EventsDeps {
  storage?: typeof chrome.storage.local;
}

function defaultStorage(): typeof chrome.storage.local {
  const g = globalThis as Record<string, unknown>;
  return (g.chrome as { storage: { local: typeof chrome.storage.local } })
    ?.storage?.local;
}

export function createEventHandlers(deps: EventsDeps = {}): HandlerMap {
  const storage = deps.storage ?? defaultStorage();

  async function handleGetBookmarkEvents(): Promise<unknown> {
    const stored = await storage.get([CS_BOOKMARK_EVENTS]);
    const events: BookmarkEvent[] = Array.isArray(
      stored[CS_BOOKMARK_EVENTS],
    )
      ? stored[CS_BOOKMARK_EVENTS]
      : [];
    return { data: { events } };
  }

  async function handleAckBookmarkEvents(
    message: MessageRequest,
  ): Promise<unknown> {
    const msg = message as unknown as Record<string, unknown>;
    const ids = msg.ids;
    const ackSet = new Set(
      Array.isArray(ids)
        ? (ids as string[]).filter(
            (id) => typeof id === "string" && id.length > 0,
          )
        : [],
    );
    if (ackSet.size === 0) {
      return { data: { removed: 0, remaining: 0 } };
    }

    const stored = await storage.get([CS_BOOKMARK_EVENTS]);
    const events: BookmarkEvent[] = Array.isArray(
      stored[CS_BOOKMARK_EVENTS],
    )
      ? stored[CS_BOOKMARK_EVENTS]
      : [];

    const next = events.filter((event) => {
      if (!event || typeof event !== "object") return false;
      const id = typeof event.id === "string" ? event.id : "";
      return id ? !ackSet.has(id) : true;
    });

    await storage.set({ [CS_BOOKMARK_EVENTS]: next });
    return {
      data: {
        removed: events.length - next.length,
        remaining: next.length,
      },
    };
  }

  async function handleBookmarkMutation(
    message: MessageRequest,
  ): Promise<unknown> {
    const msg = message as unknown as Record<string, unknown>;
    const operation =
      msg.operation === "CreateBookmark" ||
      msg.operation === "DeleteBookmark"
        ? (msg.operation as BookmarkChangeType)
        : null;
    if (!operation) return { ok: false };

    const tweetId =
      typeof msg.tweetId === "string" ? msg.tweetId : "";
    if (!tweetId || !/^\d{1,20}$/.test(tweetId)) return { ok: false };
    const source =
      typeof msg.source === "string" ? msg.source : "content-script";
    const confirmed = msg.confirmed === true;

    if (operation === "CreateBookmark") {
      if (!confirmed) return { ok: true };
      await pushBookmarkEvent(operation, tweetId, source, storage);
      return { ok: true };
    }

    await pushBookmarkEvent(operation, tweetId, source, storage);
    return { ok: true };
  }

  return {
    GET_BOOKMARK_EVENTS: handleGetBookmarkEvents,
    ACK_BOOKMARK_EVENTS: handleAckBookmarkEvents,
    BOOKMARK_MUTATION: handleBookmarkMutation,
  };
}

export const eventHandlers: HandlerMap = createEventHandlers();
