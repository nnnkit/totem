import type { UseTodayQueueResult } from "../hooks/useTodayQueue";

export interface TodayQueueProgress {
  handledCount: number;
  leftCount: number;
  totalCount: number;
  pct: number;
  handledLabel: string;
  leftLabel: string;
  ariaLabel: string;
}

export function getTodayQueueProgress(
  todayQueue?: Pick<UseTodayQueueResult, "handledCount" | "totalCount">,
): TodayQueueProgress | null {
  const totalCount = todayQueue?.totalCount ?? 0;
  if (totalCount <= 0) return null;

  const handledCount = Math.min(
    totalCount,
    Math.max(0, todayQueue?.handledCount ?? 0),
  );
  const leftCount = Math.max(0, totalCount - handledCount);
  const pct = (handledCount / totalCount) * 100;
  const handledLabel = `${handledCount} / ${totalCount} handled`;
  const leftLabel = `${leftCount} left today`;

  return {
    handledCount,
    leftCount,
    totalCount,
    pct,
    handledLabel,
    leftLabel,
    ariaLabel: `Today's Read progress: ${handledLabel}`,
  };
}

export function TodayQueueProgressIndicator({
  progress,
}: {
  progress: TodayQueueProgress;
}) {
  return (
    <div className="mt-3" title={progress.handledLabel}>
      <div
        className="h-1 overflow-hidden rounded-full bg-white/10"
        aria-hidden="true"
      >
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-300 ease-out"
          style={{ width: `${progress.pct}%` }}
        />
      </div>
    </div>
  );
}
