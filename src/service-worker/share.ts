/**
 * Handoff for share links on the marketing site.
 *
 * The site cannot navigate a tab to a chrome-extension:// URL itself, so it
 * pings the extension over `externally_connectable` and the service worker
 * performs the navigation. Manifest `matches` already restricts who can send
 * these messages; the origin check here is the second lock.
 */

import type { SessionSnapshot } from "../types/auth";

export const SHARE_PING = "TOTEM_SHARE_PING";
export const SHARE_OPEN = "TOTEM_SHARE_OPEN";

const SHARE_HOST = "usetotem.xyz";
const TWEET_ID_PATTERN = /^\d{1,20}$/;

export interface ShareExternalDeps {
  getVersion: () => string;
  getSessionSnapshot: () => Promise<SessionSnapshot>;
  openReader: (tweetId: string, tabId?: number) => Promise<void>;
}

export type ShareRequest =
  | { kind: "ping" }
  | { kind: "open"; tweetId: string };

export function isAllowedShareSender(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const { protocol, hostname } = new URL(url);
    if (protocol !== "https:") return false;
    return hostname === SHARE_HOST || hostname.endsWith(`.${SHARE_HOST}`);
  } catch {
    return false;
  }
}

export function parseShareMessage(
  message: unknown,
  senderUrl: string | undefined,
): ShareRequest | null {
  if (!message || typeof message !== "object" || !("type" in message)) return null;
  if (!isAllowedShareSender(senderUrl)) return null;

  const { type, tweetId } = message as { type: string; tweetId?: unknown };
  if (type === SHARE_PING) return { kind: "ping" };
  if (type !== SHARE_OPEN) return null;
  if (typeof tweetId !== "string" || !TWEET_ID_PATTERN.test(tweetId)) return null;
  return { kind: "open", tweetId };
}

/**
 * Whether the extension can actually render a shared thread right now. The
 * reader fetches thread detail with the viewer's own X session, so without one
 * the handoff would land them on an error state — the site keeps them on the
 * web page instead.
 */
function canOpenThread(snapshot: SessionSnapshot): boolean {
  return (
    snapshot.authState === "authenticated" &&
    snapshot.hasAuthHeader &&
    snapshot.capability.detailApi !== "blocked"
  );
}

export async function respondToShareRequest(
  request: ShareRequest,
  tabId: number | undefined,
  deps: ShareExternalDeps,
): Promise<unknown> {
  if (request.kind === "ping") {
    const snapshot = await deps.getSessionSnapshot().catch(() => null);
    return {
      installed: true,
      version: deps.getVersion(),
      canOpenThread: snapshot ? canOpenThread(snapshot) : false,
    };
  }

  await deps.openReader(request.tweetId, tabId);
  return { opened: true };
}

export function createShareExternalListener(deps: ShareExternalDeps) {
  return (
    message: unknown,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: unknown) => void,
  ): boolean => {
    const request = parseShareMessage(message, sender.url);
    if (!request) return false;

    respondToShareRequest(request, sender.tab?.id, deps)
      .then(sendResponse)
      .catch((error: unknown) => {
        sendResponse({
          error: error instanceof Error ? error.message : "SHARE_ERROR",
        });
      });

    return true;
  };
}
