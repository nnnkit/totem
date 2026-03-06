// ── Sync policy ─────────────────────────────────────────────
// Centralized config for all sync behavior. Tune these values
// here instead of hunting through service worker and runtime code.

// ── Fetch budget ────────────────────────────────────────────
/** Bookmarks returned per API page (X API default). */
export const SYNC_PAGE_SIZE = 100;

/** Maximum pages fetched per sync job. 3 pages = up to 250 bookmarks. */
export const SYNC_MAX_PAGES_PER_JOB = 3;

/** Hard cap on bookmarks fetched per sync job. */
export const SYNC_MAX_BOOKMARKS_PER_JOB = 250;

// ── Orchestrator timing ─────────────────────────────────────
/** How long an in-flight lease is valid before it's considered stale. */
export const SYNC_LOCK_TTL_MS = 12 * 60 * 1000; // 12 min

/** Minimum wait between manual sync attempts (spam guard). */
export const SYNC_MANUAL_COOLDOWN_MS = 4_000; // 4s

/** Age of an in-flight lease after which a manual sync can reclaim it. */
export const SYNC_MANUAL_RECLAIM_MS = 90_000; // 90s

/** Minimum wait between auto-sync attempts after any attempt. */
export const SYNC_AUTO_BACKOFF_MS = 5 * 60 * 1000; // 5 min

/** Minimum interval between successful auto-syncs. */
export const SYNC_AUTO_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hours

// ── Fetch pacing (human-like delays) ────────────────────────
/** Base delay between consecutive page fetches. */
export const SYNC_FETCH_BASE_DELAY_MS = 1200;

/** Random jitter added on top of base delay. */
export const SYNC_FETCH_JITTER_MS = 1300;

/** Probability of an extra "reading" pause between pages. */
export const SYNC_FETCH_READ_PAUSE_CHANCE = 0.15;

/** Minimum duration of the extra reading pause. */
export const SYNC_FETCH_READ_PAUSE_MIN_MS = 1000;

/** Jitter added to the reading pause. */
export const SYNC_FETCH_READ_PAUSE_JITTER_MS = 2000;

/** Per-page fetch timeout. */
export const SYNC_PAGE_FETCH_TIMEOUT_MS = 45_000; // 45s

// ── Sync abort timeouts ─────────────────────────────────────
/** Base timeout for a full sync job. */
export const SYNC_ABORT_TIMEOUT_FULL_MS = 8 * 60 * 1000; // 8 min

/** Base timeout for an incremental sync job. */
export const SYNC_ABORT_TIMEOUT_INCREMENTAL_MS = 3 * 60 * 1000; // 3 min

/** Maximum sync timeout regardless of bookmark count. */
export const SYNC_ABORT_TIMEOUT_MAX_MS = 12 * 60 * 1000; // 12 min

/** Extra timeout added per 1,000 local bookmarks. */
export const SYNC_ABORT_TIMEOUT_PER_1K_MS = 30_000; // 30s

// ── Rate limit / 429 handling ───────────────────────────────
/** Initial backoff after receiving a 429 response. */
export const RATE_LIMIT_BACKOFF_BASE_MS = 60_000; // 1 min

/** Maximum backoff after repeated 429 responses. */
export const RATE_LIMIT_MAX_BACKOFF_MS = 15 * 60 * 1000; // 15 min

/** Consecutive 429s before entering emergency pause. */
export const RATE_LIMIT_EMERGENCY_THRESHOLD = 3;

// ── Light sync signal ───────────────────────────────────────
/** Debounce for the light sync signal from SW. */
export const LIGHT_SYNC_DEBOUNCE_MS = 60_000; // 1 min

/** Throttle for the light sync signal from SW. */
export const LIGHT_SYNC_THROTTLE_MS = 30 * 60 * 1000; // 30 min
