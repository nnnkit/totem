// ── Auth ─────────────────────────────────────────────────────
export const AUTH_TIMEOUT_MS = 8000;
export const AUTH_RECHECK_MS = 1200;
export const AUTH_QUICK_CHECK_MS = 500;
export const AUTH_RETRY_MS = 1000;
export const AUTH_POLL_MS = 1000;

// ── Bookmarks sync ──────────────────────────────────────────
export const WEEK_MS = 1000 * 60 * 60 * 24 * 7;
export const DETAIL_CACHE_RETENTION_MS = 1000 * 60 * 60 * 24 * 30;
export const RECONCILE_THROTTLE_MS = 1000 * 60 * 60 * 4;
export const DB_INIT_TIMEOUT_MS = 8000;
export const REAUTH_MAX_ATTEMPTS = 15;
export const REAUTH_POLL_MS = 2000;

// ── Search ──────────────────────────────────────────────────
export const SEARCH_DEBOUNCE_MS = 150;

// ── Reading progress ────────────────────────────────────────
export const READING_SAVE_DEBOUNCE_MS = 3000;
export const READING_SCROLL_THRESHOLD_PX = 50;
export const READING_MIN_SCROLL_HEIGHT_PX = 10;
export const READING_HEIGHT_CHANGE_RATIO = 0.15;

// ── Product tour ────────────────────────────────────────────
export const TOUR_DELAY_MS = 800;

// ── UI transitions ──────────────────────────────────────────
export const CARD_CLOSE_MS = 150;
export const NOTE_PANEL_EXIT_MS = 150;

// ── Clock ───────────────────────────────────────────────────
export const CLOCK_UPDATE_MS = 30_000;

// ── Fetch queue ─────────────────────────────────────────────
export const FETCH_BASE_DELAY_MS = 1200;
export const FETCH_JITTER_MS = 1300;
export const FETCH_READ_PAUSE_CHANCE = 0.15;
export const FETCH_READ_PAUSE_MIN_MS = 1000;
export const FETCH_READ_PAUSE_JITTER_MS = 2000;

// ── Tweet detail cache ──────────────────────────────────────
export const DETAIL_CACHE_TTL_MS = 1000 * 60 * 60 * 6;

// ── Highlights ──────────────────────────────────────────────
export const HIGHLIGHT_RETRY_MS = 100;
