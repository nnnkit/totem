/**
 * Central registry of all client-side storage keys used by the extension.
 * Convention: totem_ prefix + snake_case.
 *
 * Service worker (public/service-worker.js) and content scripts cannot import
 * from here — keep string literals there in sync manually.
 *
 * Legacy xbt_* keys are migrated at runtime for backward compatibility.
 */

// ── IndexedDB ──────────────────────────────────────────────────────
export const IDB_DATABASE_NAME = "totem";
export const LEGACY_IDB_DATABASE_NAME = "xbt";

// ── localStorage ───────────────────────────────────────────────────
export const LS_TOUR_COMPLETED = "totem_tour_completed";
export const LS_READING_TAB = "totem_reading_tab";
export const LS_WALLPAPER_INDEX = "totem_wallpaper_index";
export const LS_HAS_BOOKMARKS = "totem_has_bookmarks";

export const LOCAL_STORAGE_KEYS = [
  LS_TOUR_COMPLETED,
  LS_READING_TAB,
  LS_WALLPAPER_INDEX,
  LS_HAS_BOOKMARKS,
] as const;

// ── chrome.storage.local (shared between app + service worker) ─────
export const CS_DB_CLEANUP_AT = "totem_db_cleanup_at";
export const CS_LAST_RECONCILE = "totem_last_reconcile";
export const CS_LAST_SYNC = "totem_last_sync";
export const CS_BOOKMARK_EVENTS = "totem_bookmark_events";
export const CS_AUTH_HEADERS = "totem_auth_headers";
export const CS_AUTH_TIME = "totem_auth_time";
export const CS_USER_ID = "totem_user_id";
export const CS_LAST_SOFT_SYNC = "totem_last_light_sync";
export const CS_SOFT_SYNC_NEEDED = "totem_light_sync_needed";

// ── chrome.storage.local (service-worker only) ─────────────────────
// These are written/read exclusively by public/service-worker.js.
// Listed here so reset (chrome.storage.local.clear()) covers them.
//   totem_graphql_catalog    – captured GraphQL endpoint catalog
//   totem_sw_cleanup_at      – weekly service worker cleanup timestamp
//   totem_features           – captured Twitter feature flags JSON
//   totem_last_mutation      – last bookmark mutation debug info (write-only debug)
//   totem_last_mutation_done – last completed mutation debug info (write-only debug)

// ── chrome.storage.sync ────────────────────────────────────────────
export const SYNC_SETTINGS = "totem_settings";
export const SYNC_THEME = "totem_theme";

export const CHROME_SYNC_KEYS = [
  SYNC_SETTINGS,
  SYNC_THEME,
] as const;

// ── Legacy key maps (xbt_ → totem_) ───────────────────────────────
export const LEGACY_LOCAL_STORAGE_KEY_MAP = {
  xbt_tour_completed: LS_TOUR_COMPLETED,
  xbt_reading_tab: LS_READING_TAB,
  xbt_wallpaper_index: LS_WALLPAPER_INDEX,
  xbt_has_bookmarks: LS_HAS_BOOKMARKS,
} as const;

export const LEGACY_CHROME_LOCAL_KEY_MAP = {
  xbt_db_cleanup_at: CS_DB_CLEANUP_AT,
  xbt_last_reconcile: CS_LAST_RECONCILE,
  xbt_last_sync: CS_LAST_SYNC,
  xbt_bookmark_events: CS_BOOKMARK_EVENTS,
  xbt_auth_headers: CS_AUTH_HEADERS,
  xbt_auth_time: CS_AUTH_TIME,
  xbt_user_id: CS_USER_ID,
  xbt_last_light_sync: CS_LAST_SOFT_SYNC,
  xbt_light_sync_needed: CS_SOFT_SYNC_NEEDED,
  // service-worker-only keys
  xbt_graphql_catalog: "totem_graphql_catalog",
  xbt_sw_cleanup_at: "totem_sw_cleanup_at",
  xbt_features: "totem_features",
  xbt_last_mutation: "totem_last_mutation",
  xbt_last_mutation_done: "totem_last_mutation_done",
  // legacy query-id keys (kept for cleanup/migration completeness)
  xbt_query_id: "totem_query_id",
  xbt_detail_query_id: "totem_detail_query_id",
  xbt_delete_query_id: "totem_delete_query_id",
  xbt_create_query_id: "totem_create_query_id",
} as const;

export const LEGACY_CHROME_SYNC_KEY_MAP = {
  xbt_settings: SYNC_SETTINGS,
  xbt_theme: SYNC_THEME,
} as const;
