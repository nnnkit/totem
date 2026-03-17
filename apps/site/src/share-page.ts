import {
  getSharedTweetIdFromPath,
  getSharedTweetUrl,
  getTweetStatusUrl,
} from "../../../src/lib/share";
import { SITE_LINKS } from "./site-content";

export type SharePageState =
  | {
      kind: "fallback";
      tweetId: string;
      shareUrl: string;
      tweetUrl: string;
    }
  | {
      kind: "invalid";
    };

export function resolveSharePageState(
  pathname: string,
  search: string,
): SharePageState {
  const tweetId = getSharedTweetIdFromPath(pathname, search);
  if (!tweetId) {
    return { kind: "invalid" };
  }

  const shareUrl = getSharedTweetUrl(tweetId);
  const tweetUrl = getTweetStatusUrl(tweetId);
  if (!shareUrl || !tweetUrl) {
    return { kind: "invalid" };
  }

  return {
    kind: "fallback",
    tweetId,
    shareUrl,
    tweetUrl,
  };
}

function getRuntime() {
  return globalThis.chrome?.runtime;
}

export function getConfiguredExtensionId(): string | null {
  const extensionId = SITE_LINKS.extensionId.trim();
  return extensionId || null;
}

function sendExternalMessage<TResponse>(
  extensionId: string,
  message: unknown,
): Promise<TResponse> {
  return new Promise((resolve, reject) => {
    const runtime = getRuntime();
    if (!runtime?.sendMessage) {
      reject(new Error("RUNTIME_UNAVAILABLE"));
      return;
    }

    runtime.sendMessage(extensionId, message, (response: TResponse) => {
      const lastError = runtime.lastError;
      if (lastError) {
        reject(new Error(lastError.message));
        return;
      }

      resolve(response);
    });
  });
}

export async function openSharedTweetInTotem(
  tweetId: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const extensionId = getConfiguredExtensionId();
  if (!extensionId) {
    return { ok: false, reason: "MISSING_EXTENSION_ID" };
  }

  if (!getRuntime()?.sendMessage) {
    return { ok: false, reason: "RUNTIME_UNAVAILABLE" };
  }

  try {
    const response = await sendExternalMessage<{ ok?: boolean; error?: string }>(
      extensionId,
      {
        type: "OPEN_SHARED_TWEET",
        tweetId,
      },
    );

    if (response?.ok) {
      return { ok: true };
    }

    return { ok: false, reason: response?.error || "OPEN_FAILED" };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "OPEN_FAILED",
    };
  }
}
