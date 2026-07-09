import { isEdge } from "../chrome";

export const CHROME_WEB_STORE_LISTING_URL =
  "https://chromewebstore.google.com/detail/acpkgdfhoaalmnhjifhneghcgfnjkglo";
export const CHROME_WEB_STORE_REVIEW_URL =
  `${CHROME_WEB_STORE_LISTING_URL}/reviews`;

// Fill in after the first Microsoft Edge Add-ons submission — the product ID
// (a GUID) is shown on the extension's Overview page in Partner Center. Edge
// Add-ons has no dedicated review path; the detail page carries the ratings
// section, so the review URL is the listing URL.
export const EDGE_ADDONS_PRODUCT_ID = "";
export const EDGE_ADDONS_LISTING_URL = EDGE_ADDONS_PRODUCT_ID
  ? `https://microsoftedge.microsoft.com/addons/detail/${EDGE_ADDONS_PRODUCT_ID}`
  : "";
export const EDGE_ADDONS_REVIEW_URL = EDGE_ADDONS_LISTING_URL;

// On Edge, point the review prompt at the Edge Add-ons listing — but only once
// the product ID is known post-submission; until then fall back to the Chrome
// listing so the prompt never links nowhere.
export function getStoreReviewUrl(): string {
  if (isEdge() && EDGE_ADDONS_REVIEW_URL) return EDGE_ADDONS_REVIEW_URL;
  return CHROME_WEB_STORE_REVIEW_URL;
}
export const PRIVACY_POLICY_URL = "https://usetotem.xyz/privacy";
export const UNINSTALL_FEEDBACK_URL =
  "https://usetotem.xyz/uninstall-feedback?utm_source=extension&utm_medium=uninstall&utm_campaign=feedback";
export const X_BOOKMARKS_URL = "https://x.com/i/bookmarks";

export const REVIEW_PROMPT_READER_OPEN_THRESHOLD = 5;
export const ACTIVATION_READER_OPEN_THRESHOLD = 3;
export const ACTIVATION_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
export const REENGAGEMENT_NUDGE_DELAY_MS = 3 * 24 * 60 * 60 * 1000;
