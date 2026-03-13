export type ReturnSurface = "home" | "reading";

const VALID_RETURN_SURFACES = new Set<ReturnSurface>(["home", "reading"]);
const FALLBACK_EXTENSION_URL = "chrome-extension://extension-id/newtab.html";

function buildExtensionUrl(
  fileName: "newtab.html" | "reader.html",
  params?: Record<string, string | null | undefined>,
  currentUrl = typeof window !== "undefined" ? window.location.href : FALLBACK_EXTENSION_URL,
): string {
  const url = new URL(fileName, currentUrl);
  url.search = "";
  url.hash = "";

  for (const [key, value] of Object.entries(params ?? {})) {
    if (!value) continue;
    url.searchParams.set(key, value);
  }

  return url.toString();
}

export function getReaderUrl(
  tweetId: string,
  currentUrl?: string,
  returnSurface: ReturnSurface = "home",
): string {
  return buildExtensionUrl(
    "reader.html",
    {
      read: tweetId,
      from: returnSurface === "reading" ? returnSurface : undefined,
    },
    currentUrl,
  );
}

export function getReaderReturnSurface(
  search = typeof window !== "undefined" ? window.location.search : "",
): ReturnSurface {
  const surface = new URLSearchParams(search).get("from");
  return VALID_RETURN_SURFACES.has(surface as ReturnSurface)
    ? (surface as ReturnSurface)
    : "home";
}

export function getNewTabUrl(
  currentUrl?: string,
  view?: ReturnSurface,
): string {
  return buildExtensionUrl(
    "newtab.html",
    view === "reading" ? { view } : undefined,
    currentUrl,
  );
}

export function getNewTabView(
  search = typeof window !== "undefined" ? window.location.search : "",
): ReturnSurface | null {
  const view = new URLSearchParams(search).get("view");
  return VALID_RETURN_SURFACES.has(view as ReturnSurface)
    ? (view as ReturnSurface)
    : null;
}

export function getReaderTweetId(search = typeof window !== "undefined" ? window.location.search : ""): string | null {
  const tweetId = new URLSearchParams(search).get("read")?.trim() ?? "";
  return tweetId || null;
}

export function isReaderRoute(pathname = typeof window !== "undefined" ? window.location.pathname : ""): boolean {
  return pathname.endsWith("reader.html");
}
