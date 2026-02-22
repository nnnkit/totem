/**
 * Central registry of all client-side storage keys used by the extension.
 * Convention: xbt_ prefix + snake_case.
 *
 * Service worker (public/service-worker.js) and content scripts cannot import
 * from here — keep string literals there in sync manually.
 */

// ── IndexedDB ──────────────────────────────────────────────────────
export const IDB_DATABASE_NAME = "xbt";

// ── localStorage ───────────────────────────────────────────────────
export const LS_TOUR_COMPLETED = "xbt_tour_completed";
export const LS_READING_TAB = "xbt_reading_tab";
export const LS_WALLPAPER_INDEX = "xbt_wallpaper_index";

export const LOCAL_STORAGE_KEYS = [
  LS_TOUR_COMPLETED,
  LS_READING_TAB,
  LS_WALLPAPER_INDEX,
] as const;

// ── chrome.storage.local (shared between app + service worker) ─────
export const CS_MANUAL_LOGIN = "xbt_manual_login_required";
export const CS_DB_CLEANUP_AT = "xbt_db_cleanup_at";
export const CS_LAST_RECONCILE = "xbt_last_reconcile";
export const CS_LAST_SYNC = "xbt_last_sync";
export const CS_BOOKMARK_EVENTS = "xbt_bookmark_events";
export const CS_AUTH_HEADERS = "xbt_auth_headers";
export const CS_AUTH_TIME = "xbt_auth_time";
export const CS_QUERY_ID = "xbt_query_id";
export const CS_USER_ID = "xbt_user_id";

// ── chrome.storage.local (service-worker only) ─────────────────────
// These are written/read exclusively by public/service-worker.js.
// Listed here so reset (chrome.storage.local.clear()) covers them.
//   xbt_graphql_catalog    – captured GraphQL endpoint catalog
//   xbt_sw_cleanup_at      – weekly service worker cleanup timestamp
//   xbt_features           – captured Twitter feature flags JSON
//   xbt_detail_query_id    – TweetDetail query ID
//   xbt_delete_query_id    – DeleteBookmark query ID
//   xbt_create_query_id    – CreateBookmark query ID
//   xbt_last_mutation      – last bookmark mutation debug info
//   xbt_last_mutation_done – last completed mutation debug info
//   xbt_seen_display_types – seen tweetDisplayType values

export const CHROME_LOCAL_KEYS = [
  CS_MANUAL_LOGIN,
  CS_DB_CLEANUP_AT,
  CS_LAST_RECONCILE,
  CS_LAST_SYNC,
  CS_BOOKMARK_EVENTS,
  CS_AUTH_HEADERS,
  CS_AUTH_TIME,
  CS_QUERY_ID,
  CS_USER_ID,
] as const;

// ── chrome.storage.sync ────────────────────────────────────────────
export const SYNC_SETTINGS = "xbt_settings";
export const SYNC_THEME = "xbt_theme";

export const CHROME_SYNC_KEYS = [
  SYNC_SETTINGS,
  SYNC_THEME,
] as const;
