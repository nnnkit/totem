import { asRecord, asString, toNumber } from "../lib/json";

export type BookmarkChangeType = "CreateBookmark" | "DeleteBookmark";

export interface BookmarkChangeEvent {
  id: string;
  type: BookmarkChangeType;
  tweetId: string;
  at: number;
  source: string;
}

export async function checkAuth() {
  return chrome.runtime.sendMessage({ type: "CHECK_AUTH" });
}

export async function startAuthCapture() {
  return chrome.runtime.sendMessage({ type: "START_AUTH_CAPTURE" });
}

export async function closeAuthTab() {
  await chrome.runtime.sendMessage({ type: "CLOSE_AUTH_TAB" });
}

export async function checkReauthStatus() {
  return chrome.runtime.sendMessage({ type: "REAUTH_STATUS" });
}

export async function deleteBookmark(tweetId: string): Promise<void> {
  const response = await chrome.runtime.sendMessage({
    type: "DELETE_BOOKMARK",
    tweetId,
  });
  if (response?.error) throw new Error(response.error);
}

function normalizeBookmarkChangeEvents(value: unknown): BookmarkChangeEvent[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index) => {
      const record = asRecord(item);
      const type = asString(record?.type);
      const tweetId = asString(record?.tweetId);
      if (type !== "CreateBookmark" && type !== "DeleteBookmark") return null;
      const at = toNumber(record?.at);
      const source = asString(record?.source) || "unknown";
      const id =
        asString(record?.id) ||
        `${type}-${at || Date.now()}-${tweetId || "unknown"}-${index}`;
      return {
        id,
        type,
        tweetId: tweetId || "",
        at,
        source,
      };
    })
    .filter((event): event is BookmarkChangeEvent => event !== null);
}

export async function getBookmarkEvents(): Promise<BookmarkChangeEvent[]> {
  const response = await chrome.runtime.sendMessage({
    type: "GET_BOOKMARK_EVENTS",
  });
  if (response?.error) throw new Error(response.error);
  return normalizeBookmarkChangeEvents(response?.data?.events);
}

export async function ackBookmarkEvents(ids: string[]): Promise<void> {
  const response = await chrome.runtime.sendMessage({
    type: "ACK_BOOKMARK_EVENTS",
    ids,
  });
  if (response?.error) throw new Error(response.error);
}

