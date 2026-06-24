export const SYNC_PAGE_SIZE = 100;

export const SYNC_LOCK_TTL_MS = 12 * 60 * 1000;
export const SYNC_MANUAL_COOLDOWN_MS = 4_000;
export const SYNC_MANUAL_RECLAIM_MS = 90_000;
// Separate knob from SYNC_MANUAL_RECLAIM_MS even though the value matches: an
// auto reserve reclaims an orphaned in-flight lease (a prior sync tab unloaded
// before COMPLETE_SYNC) older than this. Kept distinct so tuning the manual
// reclaim window cannot silently retime orphaned-auto-lease recovery.
export const SYNC_AUTO_RECLAIM_MS = 90_000;
export const SYNC_AUTO_BACKOFF_MS = 5 * 60 * 1000;
// Seed-incomplete (`lastFullSyncAt === 0`) auto-retries are a user reloading to
// resume the first sync, not unsolicited polling — use a short window so a
// reload retries instead of waiting out the 5-min poll backoff.
export const SYNC_SEED_BACKOFF_MS = 30 * 1000;
export const SYNC_AUTO_INTERVAL_MS = 4 * 60 * 60 * 1000;

export const SYNC_FETCH_BASE_DELAY_MS = 1200;
export const SYNC_FETCH_JITTER_MS = 1300;
export const SYNC_FETCH_READ_PAUSE_CHANCE = 0.15;
export const SYNC_FETCH_READ_PAUSE_MIN_MS = 1000;
export const SYNC_FETCH_READ_PAUSE_JITTER_MS = 2000;
export const SYNC_PAGE_FETCH_TIMEOUT_MS = 45_000;

export const SYNC_ABORT_TIMEOUT_FULL_MS = 8 * 60 * 1000;
export const SYNC_ABORT_TIMEOUT_INCREMENTAL_MS = 3 * 60 * 1000;
export const SYNC_ABORT_TIMEOUT_MAX_MS = 12 * 60 * 1000;
export const SYNC_ABORT_TIMEOUT_PER_1K_MS = 30_000;

export const RATE_LIMIT_BACKOFF_BASE_MS = 60_000;
export const RATE_LIMIT_MAX_BACKOFF_MS = 15 * 60 * 1000;
export const RATE_LIMIT_EMERGENCY_THRESHOLD = 3;

export const LIGHT_SYNC_DEBOUNCE_MS = 60_000;
export const LIGHT_SYNC_THROTTLE_MS = 30 * 60 * 1000;
