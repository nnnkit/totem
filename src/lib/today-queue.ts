import type {
  Bookmark,
  BookmarkQueueMetadata,
  ReadingProgress,
  TodayQueueBudgetMinutes,
  TodayQueueExposure,
  TodayQueueSnapshot,
} from "../types";
import { estimateReadingMinutes, inferKindBadge } from "./bookmark-utils";
import { TODAY_QUEUE, TODAY_QUEUE_WEIGHTS } from "./constants/scoring";
import { sortIndexToTimestamp } from "./time";

export interface TodayQueueItem {
  bookmark: Bookmark;
  metadata: BookmarkQueueMetadata | null;
  progress: ReadingProgress | null;
}

export type TodayQueueHandledReason =
  | "read"
  | "snoozed"
  | "archived"
  | "action";

export interface TodayQueueHandledItem extends TodayQueueItem {
  reason: TodayQueueHandledReason;
}

export interface TodayQueueBuildInput {
  accountId: string | null;
  localDate: string;
  budgetMinutes: TodayQueueBudgetMinutes;
  version?: number;
  size?: number;
  now?: number;
  bookmarks: Bookmark[];
  readingProgress: ReadingProgress[];
  metadata: BookmarkQueueMetadata[];
  exposures: TodayQueueExposure[];
  pinnedTweetIds: string[];
  detailedTweetIds?: ReadonlySet<string>;
  restrictToCachedDetails?: boolean;
}

export interface TodayQueueBuildResult {
  key: string;
  localDate: string;
  budgetMinutes: TodayQueueBudgetMinutes;
  version: number;
  tweetIds: string[];
  generatedAt: number;
}

interface ScoredCandidate {
  bookmark: Bookmark;
  progress: ReadingProgress | null;
  metadata: BookmarkQueueMetadata | null;
  score: number;
  tieBreak: number;
  savedAt: number;
  minutes: number;
  kind: string;
  inProgress: boolean;
  recent: boolean;
  pinned: boolean;
  neglected: boolean;
  readSoon: boolean;
}

const ENGAGEMENT_ACTIONS = new Set<TodayQueueExposure["action"]>([
  "added",
  "opened",
  "snoozed",
  "read",
  "reference",
  "act",
  "pinned",
]);

export function formatLocalDate(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function makeTodayQueueKey({
  localDate,
  budgetMinutes,
  version = TODAY_QUEUE.version,
}: {
  localDate: string;
  budgetMinutes: TodayQueueBudgetMinutes;
  version?: number;
}): string {
  return `${localDate}:${budgetMinutes}:v${version}`;
}

export function toTodayQueueSnapshot(
  result: TodayQueueBuildResult,
): TodayQueueSnapshot {
  return {
    key: result.key,
    localDate: result.localDate,
    budgetMinutes: result.budgetMinutes,
    version: result.version,
    tweetIds: result.tweetIds,
    generatedAt: result.generatedAt,
  };
}

export function addTweetIdToTodayQueueSnapshot({
  snapshot,
  tweetId,
  key,
  localDate,
  budgetMinutes,
  version = TODAY_QUEUE.version,
  generatedAt = Date.now(),
}: {
  snapshot: TodayQueueSnapshot | null;
  tweetId: string;
  key: string;
  localDate: string;
  budgetMinutes: TodayQueueBudgetMinutes;
  version?: number;
  generatedAt?: number;
}): TodayQueueSnapshot {
  return {
    key: snapshot?.key ?? key,
    localDate: snapshot?.localDate ?? localDate,
    budgetMinutes: snapshot?.budgetMinutes ?? budgetMinutes,
    version: snapshot?.version ?? version,
    generatedAt: snapshot?.generatedAt ?? generatedAt,
    tweetIds: [
      tweetId,
      ...(snapshot?.tweetIds ?? []).filter((id) => id !== tweetId),
    ],
  };
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function getSavedAt(bookmark: Bookmark): number {
  try {
    const timestamp = sortIndexToTimestamp(bookmark.sortIndex);
    if (Number.isFinite(timestamp)) return timestamp;
  } catch {}
  return bookmark.createdAt;
}

function toMaps(
  progressRows: ReadingProgress[],
  metadataRows: BookmarkQueueMetadata[],
) {
  return {
    progressByTweetId: new Map(progressRows.map((row) => [row.tweetId, row])),
    metadataByTweetId: new Map(metadataRows.map((row) => [row.tweetId, row])),
  };
}

function isFutureSnoozed(
  metadata: BookmarkQueueMetadata | null,
  localDate: string,
): boolean {
  return Boolean(metadata?.snoozedUntil && metadata.snoozedUntil > localDate);
}

function isSuppressedIntent(metadata: BookmarkQueueMetadata | null): boolean {
  return metadata?.intent === "reference" || metadata?.intent === "act";
}

function getHandledReason(
  progress: ReadingProgress | null,
  metadata: BookmarkQueueMetadata | null,
  localDate: string,
): TodayQueueHandledReason | null {
  if (progress?.completed) return "read";
  if (isFutureSnoozed(metadata, localDate)) return "snoozed";
  if (metadata?.intent === "reference") return "archived";
  if (metadata?.intent === "act") return "action";
  return null;
}

function recentExposureSummary(
  exposures: TodayQueueExposure[],
  now: number,
): Map<string, { queued: number; engaged: boolean }> {
  const since = now - TODAY_QUEUE.exposureWindowMs;
  const summary = new Map<string, { queued: number; engaged: boolean }>();

  for (const exposure of exposures) {
    if (exposure.createdAt < since) continue;
    const current = summary.get(exposure.tweetId) ?? {
      queued: 0,
      engaged: false,
    };
    if (exposure.action === "queued") current.queued += 1;
    if (ENGAGEMENT_ACTIONS.has(exposure.action)) current.engaged = true;
    summary.set(exposure.tweetId, current);
  }

  return summary;
}

function isOverExposed(
  tweetId: string,
  exposureSummary: ReadonlyMap<string, { queued: number; engaged: boolean }>,
): boolean {
  const summary = exposureSummary.get(tweetId);
  return Boolean(
    summary &&
      !summary.engaged &&
      summary.queued >= TODAY_QUEUE.maxQueuedExposureWithoutEngagement,
  );
}

function shouldSuppressCandidate({
  bookmark,
  progress,
  metadata,
  exposureSummary,
  localDate,
  restrictToCachedDetails,
  detailedTweetIds,
}: {
  bookmark: Bookmark;
  progress: ReadingProgress | null;
  metadata: BookmarkQueueMetadata | null;
  exposureSummary: ReadonlyMap<string, { queued: number; engaged: boolean }>;
  localDate: string;
  restrictToCachedDetails: boolean;
  detailedTweetIds: ReadonlySet<string>;
}): boolean {
  if (progress?.completed) return true;
  if (isFutureSnoozed(metadata, localDate)) return true;
  if (isSuppressedIntent(metadata)) return true;
  if (restrictToCachedDetails && !detailedTweetIds.has(bookmark.tweetId)) {
    return true;
  }
  return isOverExposed(bookmark.tweetId, exposureSummary);
}

function createCandidate({
  bookmark,
  progress,
  metadata,
  exposureSummary,
  pinnedIndexByTweetId,
  seed,
  now,
  budgetMinutes,
}: {
  bookmark: Bookmark;
  progress: ReadingProgress | null;
  metadata: BookmarkQueueMetadata | null;
  exposureSummary: ReadonlyMap<string, { queued: number; engaged: boolean }>;
  pinnedIndexByTweetId: ReadonlyMap<string, number>;
  seed: string;
  now: number;
  budgetMinutes: TodayQueueBudgetMinutes;
}): ScoredCandidate {
  const savedAt = getSavedAt(bookmark);
  const age = Math.max(0, now - savedAt);
  const minutes = estimateReadingMinutes(bookmark);
  const pinnedIndex = pinnedIndexByTweetId.get(bookmark.tweetId);
  const exposure = exposureSummary.get(bookmark.tweetId);
  const kind = inferKindBadge(bookmark).toLowerCase();
  const recent = age <= TODAY_QUEUE.freshWindowMs;
  const neglected = age >= TODAY_QUEUE.neglectedAfterMs;
  const inProgress = Boolean(progress && !progress.completed);
  const readSoon = metadata?.intent === "read_soon";
  const pinned = pinnedIndex !== undefined;
  let score = 0;

  if (readSoon) score += TODAY_QUEUE_WEIGHTS.readSoon;
  if (inProgress) score += TODAY_QUEUE_WEIGHTS.inProgress;
  if (pinned) {
    score += Math.max(1, TODAY_QUEUE_WEIGHTS.pinned - (pinnedIndex ?? 0));
  }
  if (recent) {
    const freshnessRatio = 1 - age / TODAY_QUEUE.freshWindowMs;
    score += Math.max(0, freshnessRatio * TODAY_QUEUE_WEIGHTS.freshness);
  }
  if (neglected) {
    const revivalRatio = Math.min(1, age / (TODAY_QUEUE.neglectedAfterMs * 4));
    score += revivalRatio * TODAY_QUEUE_WEIGHTS.neglected;
  }
  if (minutes <= budgetMinutes) {
    score += TODAY_QUEUE_WEIGHTS.budgetFit;
  } else {
    score -= Math.min(
      TODAY_QUEUE_WEIGHTS.budgetOverrunPenalty * (minutes - budgetMinutes),
      TODAY_QUEUE_WEIGHTS.budgetOverrunPenalty * 5,
    );
  }
  score -= (exposure?.queued ?? 0) * TODAY_QUEUE_WEIGHTS.queuedExposurePenalty;

  const tieBreak = hashString(`${seed}:${bookmark.tweetId}`) / 0xffffffff;
  score += tieBreak / 100;

  return {
    bookmark,
    progress,
    metadata,
    score,
    tieBreak,
    savedAt,
    minutes,
    kind,
    inProgress,
    recent,
    pinned,
    neglected,
    readSoon,
  };
}

function compareCandidates(a: ScoredCandidate, b: ScoredCandidate): number {
  if (b.score !== a.score) return b.score - a.score;
  if (a.tieBreak !== b.tieBreak) return a.tieBreak - b.tieBreak;
  return b.savedAt - a.savedAt;
}

function violatesDiversity(
  candidate: ScoredCandidate,
  picked: ScoredCandidate[],
): boolean {
  const sameAuthor = picked.filter(
    (item) =>
      item.bookmark.author.screenName.toLowerCase() ===
      candidate.bookmark.author.screenName.toLowerCase(),
  ).length;
  const sameKind = picked.filter((item) => item.kind === candidate.kind).length;
  return sameAuthor >= 2 || sameKind >= 3;
}

function pickBest(
  candidates: ScoredCandidate[],
  pickedIds: Set<string>,
  picked: ScoredCandidate[],
  predicate: (candidate: ScoredCandidate) => boolean,
): ScoredCandidate | null {
  const pool = candidates.filter(
    (candidate) => !pickedIds.has(candidate.bookmark.tweetId) && predicate(candidate),
  );
  if (pool.length === 0) return null;
  return pool.find((candidate) => !violatesDiversity(candidate, picked)) ?? pool[0];
}

export function buildTodayQueue({
  accountId,
  localDate,
  budgetMinutes,
  version = TODAY_QUEUE.version,
  size = TODAY_QUEUE.size,
  now = Date.now(),
  bookmarks,
  readingProgress,
  metadata,
  exposures,
  pinnedTweetIds,
  detailedTweetIds = new Set<string>(),
  restrictToCachedDetails = false,
}: TodayQueueBuildInput): TodayQueueBuildResult {
  const key = makeTodayQueueKey({ localDate, budgetMinutes, version });
  const seed = `${accountId ?? "local"}:${key}`;
  const { progressByTweetId, metadataByTweetId } = toMaps(
    readingProgress,
    metadata,
  );
  const exposureSummary = recentExposureSummary(exposures, now);
  const pinnedIndexByTweetId = new Map(
    pinnedTweetIds.map((tweetId, index) => [tweetId, index]),
  );
  const seenTweetIds = new Set<string>();
  const candidates: ScoredCandidate[] = [];

  for (const bookmark of bookmarks) {
    if (seenTweetIds.has(bookmark.tweetId)) continue;
    seenTweetIds.add(bookmark.tweetId);
    const progress = progressByTweetId.get(bookmark.tweetId) ?? null;
    const row = metadataByTweetId.get(bookmark.tweetId) ?? null;
    if (
      shouldSuppressCandidate({
        bookmark,
        progress,
        metadata: row,
        exposureSummary,
        localDate,
        restrictToCachedDetails,
        detailedTweetIds,
      })
    ) {
      continue;
    }
    candidates.push(
      createCandidate({
        bookmark,
        progress,
        metadata: row,
        exposureSummary,
        pinnedIndexByTweetId,
        seed,
        now,
        budgetMinutes,
      }),
    );
  }

  candidates.sort(compareCandidates);

  const picked: ScoredCandidate[] = [];
  const pickedIds = new Set<string>();
  const add = (candidate: ScoredCandidate | null) => {
    if (!candidate || picked.length >= size) return;
    picked.push(candidate);
    pickedIds.add(candidate.bookmark.tweetId);
  };

  add(pickBest(candidates, pickedIds, picked, (candidate) => candidate.inProgress));
  add(pickBest(candidates, pickedIds, picked, (candidate) => candidate.recent));
  add(
    pickBest(
      candidates,
      pickedIds,
      picked,
      (candidate) => candidate.pinned || candidate.readSoon,
    ),
  );
  add(pickBest(candidates, pickedIds, picked, (candidate) => candidate.neglected));

  while (picked.length < size) {
    const next = pickBest(candidates, pickedIds, picked, () => true);
    if (!next) break;
    add(next);
  }

  return {
    key,
    localDate,
    budgetMinutes,
    version,
    tweetIds: picked.map((candidate) => candidate.bookmark.tweetId),
    generatedAt: now,
  };
}

export function deriveActiveTodayQueueItems({
  snapshot,
  bookmarks,
  readingProgress,
  metadata,
  detailedTweetIds = new Set<string>(),
  restrictToCachedDetails = false,
  localDate,
}: {
  snapshot: TodayQueueSnapshot | null;
  bookmarks: Bookmark[];
  readingProgress: ReadingProgress[];
  metadata: BookmarkQueueMetadata[];
  detailedTweetIds?: ReadonlySet<string>;
  restrictToCachedDetails?: boolean;
  localDate: string;
}): TodayQueueItem[] {
  if (!snapshot) return [];
  const bookmarkByTweetId = new Map(bookmarks.map((item) => [item.tweetId, item]));
  const { progressByTweetId, metadataByTweetId } = toMaps(
    readingProgress,
    metadata,
  );
  const items: TodayQueueItem[] = [];

  for (const tweetId of snapshot.tweetIds) {
    const bookmark = bookmarkByTweetId.get(tweetId);
    if (!bookmark) continue;
    const progress = progressByTweetId.get(tweetId) ?? null;
    const row = metadataByTweetId.get(tweetId) ?? null;
    if (progress?.completed) continue;
    if (isFutureSnoozed(row, localDate)) continue;
    if (isSuppressedIntent(row)) continue;
    if (restrictToCachedDetails && !detailedTweetIds.has(tweetId)) continue;
    items.push({ bookmark, metadata: row, progress });
  }

  return items;
}

export function deriveHandledTodayQueueItems({
  snapshot,
  bookmarks,
  readingProgress,
  metadata,
  detailedTweetIds = new Set<string>(),
  restrictToCachedDetails = false,
  localDate,
}: {
  snapshot: TodayQueueSnapshot | null;
  bookmarks: Bookmark[];
  readingProgress: ReadingProgress[];
  metadata: BookmarkQueueMetadata[];
  detailedTweetIds?: ReadonlySet<string>;
  restrictToCachedDetails?: boolean;
  localDate: string;
}): TodayQueueHandledItem[] {
  if (!snapshot) return [];
  const bookmarkByTweetId = new Map(bookmarks.map((item) => [item.tweetId, item]));
  const { progressByTweetId, metadataByTweetId } = toMaps(
    readingProgress,
    metadata,
  );
  const items: TodayQueueHandledItem[] = [];

  for (const tweetId of snapshot.tweetIds) {
    const bookmark = bookmarkByTweetId.get(tweetId);
    if (!bookmark) continue;
    if (restrictToCachedDetails && !detailedTweetIds.has(tweetId)) continue;
    const progress = progressByTweetId.get(tweetId) ?? null;
    const row = metadataByTweetId.get(tweetId) ?? null;
    const reason = getHandledReason(progress, row, localDate);
    if (!reason) continue;
    items.push({ bookmark, metadata: row, progress, reason });
  }

  return items;
}

export function makeQueueExposure({
  tweetId,
  action,
  localDate,
  createdAt = Date.now(),
}: Omit<TodayQueueExposure, "id" | "createdAt"> & {
  createdAt?: number;
}): TodayQueueExposure {
  return {
    id: `${createdAt}:${tweetId}:${action}:${hashString(`${tweetId}:${action}:${createdAt}`)}`,
    tweetId,
    action,
    localDate,
    createdAt,
  };
}
