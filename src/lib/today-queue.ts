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

interface DiversityItem {
  authorKey: string;
  kind: string;
}

interface ScoredCandidate extends DiversityItem {
  bookmark: Bookmark;
  progress: ReadingProgress | null;
  metadata: BookmarkQueueMetadata | null;
  score: number;
  tieBreak: number;
  savedAt: number;
  minutes: number;
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

// A daily-set record is keyed by (date, budget, version). When the scoring
// version is bumped, prior-version records are orphaned: nothing reads them and
// the reader regenerates a fresh set under the current version. This pure
// decision returns those orphaned keys so a load-time sweep can drop them.
export function selectStaleTodayQueueSnapshotKeys(
  records: readonly Pick<TodayQueueSnapshot, "key" | "version">[],
  currentVersion: number = TODAY_QUEUE.version,
): string[] {
  return records
    .filter((record) => record.version !== currentVersion)
    .map((record) => record.key);
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

export function shouldPersistTodayQueueSnapshot(
  snapshot: TodayQueueSnapshot,
): boolean {
  return snapshot.tweetIds.length > 0;
}

export function isTodayQueueSnapshotDone({
  snapshot,
  handledItems,
  existingTweetIds,
}: {
  snapshot: TodayQueueSnapshot | null;
  handledItems: TodayQueueHandledItem[];
  existingTweetIds?: ReadonlySet<string>;
}): boolean {
  if (!snapshot || snapshot.tweetIds.length === 0) return false;
  const handledTweetIds = new Set(
    handledItems.map((item) => item.bookmark.tweetId),
  );
  // A queued bookmark that was unbookmarked can never appear in handledItems;
  // count it as handled so one deletion doesn't make "done" unreachable.
  return snapshot.tweetIds.every(
    (tweetId) =>
      handledTweetIds.has(tweetId) ||
      (existingTweetIds !== undefined && !existingTweetIds.has(tweetId)),
  );
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

  // Rebuilding the queue (e.g. after a budget change) re-queues the same day,
  // so count distinct days rather than raw rows — settings churn must not
  // burn a tweet's exposure quota or stack its penalty.
  const queuedDatesByTweetId = new Map<string, Set<string>>();

  for (const exposure of exposures) {
    if (exposure.createdAt < since) continue;
    const current = summary.get(exposure.tweetId) ?? {
      queued: 0,
      engaged: false,
    };
    if (exposure.action === "queued") {
      let dates = queuedDatesByTweetId.get(exposure.tweetId);
      if (!dates) {
        dates = new Set();
        queuedDatesByTweetId.set(exposure.tweetId, dates);
      }
      dates.add(exposure.localDate);
      current.queued = dates.size;
    }
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
  const authorKey = bookmark.author.screenName.toLowerCase();
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
  // Continuous freshness curve: full weight at "just saved", fading linearly to
  // zero at the two-week (neglectedAfter) mark, where the older-item boost takes
  // over. Widening the denominator from freshWindow to neglectedAfter closes the
  // dead 3–14d zone where mid-age saves used to get no recency score at all. The
  // fresh-slot predicate (recent) is unchanged; only the score gating widens.
  if (age < TODAY_QUEUE.neglectedAfterMs) {
    const freshnessRatio = 1 - age / TODAY_QUEUE.neglectedAfterMs;
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
    authorKey,
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
  candidate: DiversityItem,
  picked: DiversityItem[],
): boolean {
  const sameAuthor = picked.filter(
    (item) => item.authorKey === candidate.authorKey,
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

// A candidate repeats a set when the set — counting the candidate itself — holds
// ≥2 of its author or ≥3 of its kind. This inclusive count is intentionally
// stricter than the fill loop (which tolerates a same-author pair while placing
// the slots), so the self-heal can improve a pair the fill loop deliberately
// allowed, and a swapped-in replacement never recreates a repeat.
function repeatsWithin(
  candidate: ScoredCandidate,
  set: ScoredCandidate[],
): boolean {
  return violatesDiversity(
    candidate,
    set.includes(candidate) ? set : [...set, candidate],
  );
}

// One bounded, deterministic repair pass after the slots + fill loop: swap the
// weakest fill-tail violator for the strongest non-violating unpicked candidate.
// Never touches the four priority slots or a deliberate (in-progress / read-soon
// / pinned) pick, and never manufactures variety the library can't supply.
function repairDiversity(
  candidates: ScoredCandidate[],
  picked: ScoredCandidate[],
  pickedIds: Set<string>,
  prioritySlotCount: number,
): void {
  const evictable = picked
    .map((candidate, index) => ({ candidate, index }))
    .filter(
      ({ candidate, index }) =>
        index >= prioritySlotCount &&
        !candidate.inProgress &&
        !candidate.readSoon &&
        !candidate.pinned &&
        repeatsWithin(candidate, picked),
    );
  if (evictable.length === 0) return;

  // compareCandidates sorts best-first, so the last entry is the lowest-scoring.
  evictable.sort((a, b) => compareCandidates(a.candidate, b.candidate));
  const target = evictable[evictable.length - 1];

  const remaining = picked.filter((_, index) => index !== target.index);
  const replacement = candidates.find(
    (candidate) =>
      !pickedIds.has(candidate.bookmark.tweetId) &&
      !repeatsWithin(candidate, remaining),
  );
  if (!replacement) return;

  pickedIds.delete(target.candidate.bookmark.tweetId);
  pickedIds.add(replacement.bookmark.tweetId);
  picked[target.index] = replacement;
}

// Suppression + scoring over the whole library, deduped and sorted best-first.
// Shared by the daily build and the "Two more" pick so both apply identical
// eligibility (completed / snoozed / Reference / Action Needed / over-exposed /
// uncached are all dropped here) and identical scoring.
function buildScoredCandidates({
  accountId,
  localDate,
  budgetMinutes,
  version = TODAY_QUEUE.version,
  now = Date.now(),
  bookmarks,
  readingProgress,
  metadata,
  exposures,
  pinnedTweetIds,
  detailedTweetIds = new Set<string>(),
  restrictToCachedDetails = false,
}: TodayQueueBuildInput): ScoredCandidate[] {
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
  return candidates;
}

export function buildTodayQueue(input: TodayQueueBuildInput): TodayQueueBuildResult {
  const {
    localDate,
    budgetMinutes,
    version = TODAY_QUEUE.version,
    size = TODAY_QUEUE.size,
    now = Date.now(),
  } = input;
  const key = makeTodayQueueKey({ localDate, budgetMinutes, version });
  const candidates = buildScoredCandidates({ ...input, now });

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

  const prioritySlotCount = picked.length;

  while (picked.length < size) {
    const next = pickBest(candidates, pickedIds, picked, () => true);
    if (!next) break;
    add(next);
  }

  repairDiversity(candidates, picked, pickedIds, prioritySlotCount);

  return {
    key,
    localDate,
    budgetMinutes,
    version,
    tweetIds: picked.map((candidate) => candidate.bookmark.tweetId),
    generatedAt: now,
  };
}

export interface AdditionalTodayReadInput extends TodayQueueBuildInput {
  // Already shown today (the current snapshot's ids) — excluded from the pool.
  excludeTweetIds: ReadonlySet<string>;
  count?: number;
  // Injectable so the random pick is deterministic under test.
  random?: () => number;
}

// The safe pool for "Two more": eligible saves (suppression already applied in
// buildScoredCandidates) that fit the reading budget and are not already in
// today's set. Deterministic and budget-bounded — never a 40-minute monster.
function selectAdditionalReadPool(
  input: TodayQueueBuildInput,
  excludeTweetIds: ReadonlySet<string>,
): ScoredCandidate[] {
  return buildScoredCandidates(input).filter(
    (candidate) =>
      candidate.minutes <= input.budgetMinutes &&
      !excludeTweetIds.has(candidate.bookmark.tweetId),
  );
}

// Deterministic, RNG-free view of the pool — drives the done-state's choice
// between offering "Two more" and showing the archive-exhausted line.
export function getAdditionalTodayReadPool({
  excludeTweetIds,
  ...input
}: TodayQueueBuildInput & {
  excludeTweetIds: ReadonlySet<string>;
}): string[] {
  return selectAdditionalReadPool(input, excludeTweetIds).map(
    (candidate) => candidate.bookmark.tweetId,
  );
}

// Up to `count` ids chosen at random from the safe pool, favoring author/kind
// variety against what is already shown today where the pool allows. The pick
// is intentionally serendipitous (random, not ranked); the caller persists the
// result once, so reloads are stable.
export function pickAdditionalTodayReadItems({
  excludeTweetIds,
  count = TODAY_QUEUE.additionalReadCount,
  random = Math.random,
  ...input
}: AdditionalTodayReadInput): string[] {
  if (count <= 0) return [];
  const pool = selectAdditionalReadPool(input, excludeTweetIds);
  if (pool.length === 0) return [];

  // Seed diversity with the authors/kinds already shown today so extras add
  // variety rather than piling onto what the reader already saw.
  const shown: DiversityItem[] = input.bookmarks
    .filter((bookmark) => excludeTweetIds.has(bookmark.tweetId))
    .map((bookmark) => ({
      authorKey: bookmark.author.screenName.toLowerCase(),
      kind: inferKindBadge(bookmark).toLowerCase(),
    }));

  const chosen: ScoredCandidate[] = [];
  const remaining = [...pool];

  while (chosen.length < count && remaining.length > 0) {
    const context = [...shown, ...chosen];
    const nonRepeating = remaining.filter(
      (candidate) => !violatesDiversity(candidate, context),
    );
    const choices = nonRepeating.length > 0 ? nonRepeating : remaining;
    const index = Math.min(
      choices.length - 1,
      Math.max(0, Math.floor(random() * choices.length)),
    );
    const pick = choices[index];
    chosen.push(pick);
    remaining.splice(remaining.indexOf(pick), 1);
  }

  return chosen.map((candidate) => candidate.bookmark.tweetId);
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

// Two exposures for the same tweet + action can land in the same millisecond
// (e.g. queue rebuild plus manual add); a sequence keeps their ids distinct so
// one row doesn't silently overwrite the other.
let exposureSequence = 0;

export function makeQueueExposure({
  tweetId,
  action,
  localDate,
  createdAt = Date.now(),
}: Omit<TodayQueueExposure, "id" | "createdAt"> & {
  createdAt?: number;
}): TodayQueueExposure {
  exposureSequence += 1;
  return {
    id: `${createdAt}:${tweetId}:${action}:${exposureSequence.toString(36)}:${hashString(`${tweetId}:${action}:${createdAt}`)}`,
    tweetId,
    action,
    localDate,
    createdAt,
  };
}
