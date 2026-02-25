// Content script: runs at document_start on x.com (ISOLATED world)
// Reads the twid cookie to detect the logged-in user ID and relays
// mutation messages from the MAIN world hook to the service worker.
(function () {
  const MESSAGE_SOURCE = "totem-bookmark-mutation";

  function parseTwidUserId(rawValue) {
    if (typeof rawValue !== "string" || !rawValue) return null;

    const candidates = [rawValue];
    try {
      const decoded = decodeURIComponent(rawValue);
      if (decoded && decoded !== rawValue) {
        candidates.push(decoded);
      }
    } catch {}

    for (const candidate of candidates) {
      const trimmed = candidate.trim();
      if (!trimmed) continue;

      const userMatch = trimmed.match(/u=(\d+)/);
      if (userMatch?.[1]) return userMatch[1];

      const encodedMatch = trimmed.match(/u%3[Dd](\d+)/);
      if (encodedMatch?.[1]) return encodedMatch[1];

      if (/^\d+$/.test(trimmed)) return trimmed;
    }

    return null;
  }

  const twidPair = document.cookie
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith("twid="));
  const twidRawValue = twidPair ? twidPair.slice("twid=".length) : "";
  const currentUserId = parseTwidUserId(twidRawValue);

  if (currentUserId) {
    chrome.storage.local.set({ totem_user_id: currentUserId });
  } else {
    chrome.storage.local.remove(["totem_user_id"]);
  }

  function handleBookmarkMutationMessage(event) {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || typeof data !== "object") return;
    if (data.__source !== MESSAGE_SOURCE) return;

    if (data.type === "query_ids" && data.ids && typeof data.ids === "object") {
      chrome.runtime.sendMessage({
        type: "STORE_QUERY_IDS",
        ids: data.ids,
      });
      return;
    }

    const operation =
      data.operation === "CreateBookmark" || data.operation === "DeleteBookmark"
        ? data.operation
        : null;
    if (!operation) return;

    const tweetId = typeof data.tweetId === "string" ? data.tweetId : "";
    chrome.runtime.sendMessage({
      type: "BOOKMARK_MUTATION",
      operation,
      tweetId,
      source: "injected-script",
    });
  }

  window.addEventListener("message", handleBookmarkMutationMessage);
})();
