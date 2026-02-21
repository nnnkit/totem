import type { Bookmark } from "../types";
import { RELATED_WEIGHTS } from "./constants";

function shuffle<T>(items: T[]): T[] {
  const next = items.slice();
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const current = next[i];
    next[i] = next[j];
    next[j] = current;
  }
  return next;
}

function tokenize(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .replace(/https?:\/\/\S+/g, " ")
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((token) => token.length >= RELATED_WEIGHTS.minTokenLength),
  );
}

export function pickRelatedBookmarks(
  selected: Bookmark | null,
  allBookmarks: Bookmark[],
  limit = 3,
  randomize = false,
): Bookmark[] {
  if (!selected || allBookmarks.length <= 1) return [];

  const pool = allBookmarks.filter((item) => item.tweetId !== selected.tweetId);
  if (pool.length === 0) return [];

  const selectedTokens = tokenize(selected.text);

  const scored = pool
    .map((candidate) => {
      let score = 0;

      if (candidate.author.screenName === selected.author.screenName) score += RELATED_WEIGHTS.sameAuthor;
      if (candidate.tweetKind && selected.tweetKind && candidate.tweetKind === selected.tweetKind) {
        score += RELATED_WEIGHTS.sameKind;
      }
      if (candidate.article?.plainText && selected.article?.plainText) score += RELATED_WEIGHTS.bothArticle;
      if (candidate.media.length > 0 && selected.media.length > 0) score += RELATED_WEIGHTS.bothMedia;

      if (selectedTokens.size > 0) {
        const candidateTokens = tokenize(candidate.text);
        let overlap = 0;
        for (const token of candidateTokens) {
          if (selectedTokens.has(token)) overlap += 1;
        }
        score += Math.min(RELATED_WEIGHTS.tokenOverlapCap, overlap);
      }

      if (randomize) {
        score += Math.random() * RELATED_WEIGHTS.randomBoost;
      }

      return { candidate, score };
    })
    .sort((a, b) => b.score - a.score);

  const picked: Bookmark[] = [];
  const pickedIds = new Set<string>();

  for (const item of scored) {
    if (picked.length >= limit) break;
    if (item.score <= 0) break;
    picked.push(item.candidate);
    pickedIds.add(item.candidate.tweetId);
  }

  if (picked.length >= limit) return picked.slice(0, limit);

  const randomFill = shuffle(
    pool.filter((item) => !pickedIds.has(item.tweetId)),
  );
  for (const candidate of randomFill) {
    if (picked.length >= limit) break;
    picked.push(candidate);
  }

  return picked.slice(0, limit);
}
