export const IDB_DATABASE_NAME = "totem";
export const LEGACY_IDB_DATABASE_NAME = "xbt";
export const IDB_ACCOUNT_DATABASE_PREFIX = "totem_acct_";

export const LS_READING_TAB = "totem_reading_tab";
export const LS_READING_SORTS = "totem_reading_sorts";
export const LS_RETURN_SURFACE = "totem_return_surface";
export const LS_WALLPAPER_INDEX = "totem_wallpaper_index";
export const LS_MANUAL_SYNC_REQUIRED = "totem_manual_sync_required";
export const LS_BOOT_SYNC_POLICY = "totem_boot_sync_policy";
export const LS_PINNED_TWEETS = "totem_pinned_tweets";
export const LS_READER_ACTIVITY = "totem_reader_activity";
export const LS_RECENT_SEARCHES = "totem_recent_searches";

export const LOCAL_STORAGE_KEYS = [
  LS_READING_TAB,
  LS_READING_SORTS,
  LS_RETURN_SURFACE,
  LS_WALLPAPER_INDEX,
  LS_MANUAL_SYNC_REQUIRED,
  LS_BOOT_SYNC_POLICY,
  LS_PINNED_TWEETS,
  LS_READER_ACTIVITY,
  LS_RECENT_SEARCHES,
  "totem_has_bookmarks", // legacy — kept for reset cleanup
] as const;

export const CS_DB_CLEANUP_AT = "totem_db_cleanup_at";
export const CS_LAST_RECONCILE = "totem_last_reconcile";
export const CS_BOOKMARK_EVENTS = "totem_bookmark_events";
// Broadcast signal — reset.ts writes it, every open page + the SW drop their
// IDB handles on change so the subsequent deleteDatabase() isn't blocked.
export const CS_RESET_EPOCH = "totem_reset_epoch";
export const CS_AUTH_HEADERS = "totem_auth_headers";
export const CS_AUTH_TIME = "totem_auth_time";
export const CS_USER_ID = "totem_user_id";
export const CS_ACCOUNT_CONTEXT_ID = "totem_account_context_id";
export const CS_VIEWER_PROFILE = "totem_viewer_profile";
export const CS_AUTH_STATE = "totem_auth_state";
export const CS_SYNC_AUTO_ENABLED = "totem_sync_auto_enabled";
export const CS_RUNTIME_AUDIT = "totem_runtime_audit";

// ─── SW-owned keys — deliberately NOT exported here ──────────────────────
// (see ARCHITECTURE.md §16 Invariant #1).
//
// CS_SYNC_ORCHESTRATOR_STATE, CS_RUNTIME_STATE_V2, CS_LAST_SYNC,
// CS_LAST_SOFT_SYNC, CS_SOFT_SYNC_NEEDED live in
// service-worker/storage-keys-sw.ts. Runtime code does not import them;
// it reads their values through the SW-owned RuntimeSnapshot or through
// chrome.storage.onChanged subscriptions on string-literal keys.
//
// The reset pathway (src/lib/reset.ts) imports them directly from the SW
// module as an explicit, allowlisted exception — its job is to wipe them.
//
// If you need one of these keys from runtime code, you almost certainly
// want to read it via the snapshot instead. Ask before exposing.

// These are written/read exclusively by service worker modules (src/service-worker/).
// Listed here so reset (chrome.storage.local.clear()) covers them.
//   totem_graphql_catalog    – captured GraphQL endpoint catalog
//   totem_sw_cleanup_at      – weekly service worker cleanup timestamp
//   totem_features           – captured Twitter feature flags JSON
//   totem_last_mutation      – last bookmark mutation debug info (write-only debug)
//   totem_last_mutation_done – last completed mutation debug info (write-only debug)

export const SYNC_SETTINGS = "totem_settings";
export const SYNC_THEME = "totem_theme";

export const CHROME_SYNC_KEYS = [
  SYNC_SETTINGS,
  SYNC_THEME,
] as const;

export const LEGACY_LOCAL_STORAGE_KEY_MAP = {
  xbt_reading_tab: LS_READING_TAB,
  xbt_wallpaper_index: LS_WALLPAPER_INDEX,
  xbt_has_bookmarks: "totem_has_bookmarks",
} as const;

export const LEGACY_CHROME_LOCAL_KEY_MAP = {
  xbt_db_cleanup_at: CS_DB_CLEANUP_AT,
  xbt_last_reconcile: CS_LAST_RECONCILE,
  xbt_bookmark_events: CS_BOOKMARK_EVENTS,
  xbt_auth_headers: CS_AUTH_HEADERS,
  xbt_auth_time: CS_AUTH_TIME,
  xbt_user_id: CS_USER_ID,
  // no dedicated legacy key existed for account context. It is derived and
  // persisted by current runtime flows.
  xbt_auth_state: CS_AUTH_STATE,
  // SW-owned legacy mappings — strings inlined rather than imported so
  // runtime code doesn't gain symbolic access to SW-owned keys through
  // this file. The reset pathway reads the current names from
  // service-worker/storage-keys-sw.ts directly.
  xbt_last_sync: "totem_last_sync",
  xbt_last_light_sync: "totem_last_light_sync",
  xbt_light_sync_needed: "totem_light_sync_needed",
  xbt_sync_orchestrator_state: "totem_sync_orchestrator_state",
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
