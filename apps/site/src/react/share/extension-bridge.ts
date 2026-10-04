/**
 * Talks to the Totem extension from the public share page.
 *
 * A web page cannot navigate itself to a chrome-extension:// URL, so the
 * extension's service worker performs the navigation for us. The page is
 * listed in the extension's `externally_connectable` matches, which is what
 * makes `chrome.runtime` available here at all.
 */

const EXTENSION_ID = "acpkgdfhoaalmnhjifhneghcgfnjkglo";
const EXTENSION_ID_OVERRIDE_KEY = "totem.extensionId";
const PING_TIMEOUT_MS = 500;

const SHARE_PING = "TOTEM_SHARE_PING";
const SHARE_OPEN = "TOTEM_SHARE_OPEN";

interface ExternalRuntime {
  sendMessage: (
    extensionId: string,
    message: unknown,
    callback: (response: unknown) => void,
  ) => void;
  lastError?: { message?: string };
}

export interface ExtensionPresence {
  installed: boolean;
  canOpenThread: boolean;
}

const ABSENT: ExtensionPresence = { installed: false, canOpenThread: false };

function getRuntime(): ExternalRuntime | null {
  const runtime = (window as { chrome?: { runtime?: ExternalRuntime } }).chrome
    ?.runtime;
  return typeof runtime?.sendMessage === "function" ? runtime : null;
}

function resolveExtensionId(): string {
  try {
    return window.localStorage.getItem(EXTENSION_ID_OVERRIDE_KEY) || EXTENSION_ID;
  } catch {
    return EXTENSION_ID;
  }
}

function sendToExtension(message: unknown, timeoutMs: number): Promise<unknown> {
  const runtime = getRuntime();
  if (!runtime) return Promise.resolve(null);

  return new Promise((resolve) => {
    let settled = false;
    const settle = (value: unknown) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    const timer = window.setTimeout(() => settle(null), timeoutMs);

    try {
      runtime.sendMessage(resolveExtensionId(), message, (response) => {
        window.clearTimeout(timer);
        // Reading lastError is what suppresses Chrome's "unchecked runtime
        // error" console noise when the extension is not installed.
        settle(runtime.lastError ? null : response);
      });
    } catch {
      window.clearTimeout(timer);
      settle(null);
    }
  });
}

export async function pingExtension(): Promise<ExtensionPresence> {
  const response = await sendToExtension({ type: SHARE_PING }, PING_TIMEOUT_MS);
  if (!response || typeof response !== "object") return ABSENT;
  const { installed, canOpenThread } = response as Partial<ExtensionPresence>;
  if (!installed) return ABSENT;
  return { installed: true, canOpenThread: Boolean(canOpenThread) };
}

export async function openThreadInExtension(tweetId: string): Promise<boolean> {
  const response = await sendToExtension(
    { type: SHARE_OPEN, tweetId },
    PING_TIMEOUT_MS,
  );
  return Boolean((response as { opened?: boolean } | null)?.opened);
}
