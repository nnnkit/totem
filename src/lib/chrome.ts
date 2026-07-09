export function hasChromeStorageSync(): boolean {
  return typeof chrome !== "undefined" && Boolean(chrome.storage?.sync);
}

export function hasChromeStorageOnChanged(): boolean {
  return typeof chrome !== "undefined" && Boolean(chrome.storage?.onChanged);
}

export function hasChromeSearch(): boolean {
  return typeof chrome !== "undefined" && Boolean(chrome.search?.query);
}

// Detects Microsoft Edge (Chromium). The same build ships to both the Chrome
// Web Store and Edge Add-ons, so store-specific links are chosen at runtime.
export function isEdge(): boolean {
  if (typeof navigator === "undefined") return false;
  const uaData = (
    navigator as Navigator & {
      userAgentData?: { brands?: Array<{ brand: string }> };
    }
  ).userAgentData;
  if (uaData?.brands?.some((b) => b.brand === "Microsoft Edge")) return true;
  return /\bEdg\//.test(navigator.userAgent);
}
