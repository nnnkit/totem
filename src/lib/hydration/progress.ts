export interface HydrationProgressInput {
  bookmarkCount: number;
  readyCount: number;
  queueTotal: number;
  processed: number;
}

export interface HydrationProgress {
  done: number;
  total: number;
  pct: number;
}

function nonNegativeInteger(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

export function getHydrationProgress({
  bookmarkCount,
  readyCount,
  queueTotal,
  processed,
}: HydrationProgressInput): HydrationProgress {
  const bookmarks = nonNegativeInteger(bookmarkCount);
  const ready = nonNegativeInteger(readyCount);
  const newlyProcessed = nonNegativeInteger(processed);
  const queueSpan = nonNegativeInteger(queueTotal) + newlyProcessed;
  const total = bookmarks > 0 ? bookmarks : Math.max(queueSpan, ready + newlyProcessed);
  const rawDone = bookmarks > 0 ? ready : ready + newlyProcessed;
  const done = total > 0 ? Math.min(total, rawDone) : 0;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return { done, total, pct };
}
