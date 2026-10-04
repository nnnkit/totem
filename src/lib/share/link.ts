import { encodeShareFragment } from "./codec";
import {
  SHARE_PAYLOAD_TRIM_STEPS,
  buildSharePayload,
  type SharePayload,
} from "./payload";
import type { Bookmark, ThreadTweet } from "../../types";

export const SHARE_ORIGIN = "https://usetotem.xyz";
export const SHARE_PATH_PREFIX = "/t/";
export const SHARE_FRAGMENT_KEY = "s";

/**
 * Chrome, Slack and iMessage all handle far longer URLs, but links past this
 * start getting visibly mangled when pasted into plain-text clients. A link
 * that fails to carry the thread still works — it just falls back to the
 * install prompt — so the cap is deliberately conservative.
 */
export const SHARE_URL_MAX_LENGTH = 8000;

const SHARE_PATH_PATTERN = /^\/t\/(\d{1,20})\/?$/;

export interface ShareLink {
  url: string;
  includesThread: boolean;
}

export function buildShareBaseUrl(tweetId: string, origin = SHARE_ORIGIN): string {
  return `${origin.replace(/\/$/, "")}${SHARE_PATH_PREFIX}${tweetId}`;
}

function withFragment(baseUrl: string, fragment: string): string {
  return `${baseUrl}#${SHARE_FRAGMENT_KEY}=${fragment}`;
}

export async function buildShareUrl(
  focalTweet: Bookmark,
  thread: ThreadTweet[],
  options: { origin?: string; maxLength?: number } = {},
): Promise<ShareLink> {
  const baseUrl = buildShareBaseUrl(focalTweet.tweetId, options.origin);
  const maxLength = options.maxLength ?? SHARE_URL_MAX_LENGTH;

  let payload: SharePayload = buildSharePayload(focalTweet, thread);
  let trimStep = 0;

  for (;;) {
    let url: string;
    try {
      url = withFragment(baseUrl, await encodeShareFragment(payload));
    } catch {
      return { url: baseUrl, includesThread: false };
    }
    if (url.length <= maxLength) return { url, includesThread: true };
    if (trimStep >= SHARE_PAYLOAD_TRIM_STEPS.length) {
      return { url: baseUrl, includesThread: false };
    }
    payload = SHARE_PAYLOAD_TRIM_STEPS[trimStep](payload);
    trimStep += 1;
  }
}

export function parseShareTweetId(pathname: string): string | null {
  return SHARE_PATH_PATTERN.exec(pathname)?.[1] ?? null;
}

export function parseShareFragment(hash: string): string | null {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!raw) return null;
  const value = new URLSearchParams(raw).get(SHARE_FRAGMENT_KEY)?.trim();
  return value ? value : null;
}
