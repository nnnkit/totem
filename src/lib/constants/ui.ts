export const NEW_BADGE_CUTOFF_MS = 24 * 60 * 60 * 1000;

export const COMPACT_PREVIEW_MAX = 130;
export const PICK_TITLE_MAX = 92;
export const PICK_EXCERPT_MAX = 210;

export const OFFLINE_PREFETCH_POOL = 20;
export const OFFLINE_PREFETCH_UNREAD_MAX = 10;

export const READING_WPM = 180;
export const ARTICLE_READING_WPM = 200;
export const MIN_READING_MINUTES = 2;

export const TODAY_QUEUE_DONE_TITLE = "Nice. Today's Read is clear.";
export const TODAY_QUEUE_DONE_MESSAGE =
  "You handled everything for today. We'll line up a fresh read tomorrow.";

// "Two more" — the calm, optional post-completion extension. Understated and
// repeatable; no streak, counter, or momentum language (done is always the
// headline). When the safe pool is empty the control retires for the day.
export const TODAY_QUEUE_TWO_MORE_LABEL = "Two more";
export const TODAY_QUEUE_TWO_MORE_PENDING = "Adding…";
export const TODAY_QUEUE_TWO_MORE_EXHAUSTED = "Nothing else to add today.";
