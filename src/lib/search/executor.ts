import type { Bookmark } from "../../types";
import {
  collectFreeTextTerms,
  freeTextQuery,
  parseQuery,
  type Ast,
  type OperatorNode,
} from "./parser";
import { queryToTerms } from "./highlight";

/** Used by the engine to compute BM25 scores on free-text terms only. */
export interface FreeTextSearcher {
  /** Returns scored hits for the free-text portion of the query. */
  searchText(text: string): Array<{ id: string; score: number }>;
}

export interface RunOptions {
  /** Source corpus to filter operator predicates against. */
  bookmarks: Bookmark[];
  /** Engine view that scores free-text terms. */
  searcher: FreeTextSearcher;
  /** Optional pre-resolved AST. */
  ast?: Ast;
  /** Optional raw query (used when `ast` is omitted). */
  query?: string;
}

export interface RunResult {
  /** Bookmarks in rank order (best first). */
  results: Bookmark[];
  /** AST used. */
  ast: Ast;
  /** Lowercased terms for the highlighter. */
  queryTerms: ReadonlySet<string>;
}

const DAY_MS = 1000 * 60 * 60 * 24;

export function runQuery({
  bookmarks,
  searcher,
  ast,
  query,
}: RunOptions): RunResult {
  const tree: Ast = ast ?? parseQuery(query ?? "");

  if (tree.kind === "empty") {
    return { results: bookmarks, ast: tree, queryTerms: new Set() };
  }

  // 1. Apply operator predicates to filter the corpus.
  const filtered = bookmarks.filter((b) => evalNode(tree, b));

  // 2. If there's a free-text portion, re-rank the filtered slice via BM25.
  const text = freeTextQuery(tree);
  const trimmed = text.trim();

  if (!trimmed) {
    // Operators-only query: return filtered bookmarks newest-first.
    const sorted = filtered.toSorted((a, b) => b.createdAt - a.createdAt);
    return { results: sorted, ast: tree, queryTerms: new Set() };
  }

  const allowed = new Set<string>();
  for (const b of filtered) allowed.add(b.tweetId);

  const hits = searcher.searchText(trimmed).filter((h) => allowed.has(h.id));

  const byId = new Map<string, Bookmark>();
  for (const b of filtered) byId.set(b.tweetId, b);

  const ranked: Bookmark[] = [];
  for (const h of hits) {
    const b = byId.get(h.id);
    if (b) ranked.push(b);
  }

  // Build query terms for highlighting from the free-text portion only.
  const freeTerms = collectFreeTextTerms(tree).join(" ");
  const queryTerms = queryToTerms(freeTerms);

  return { results: ranked, ast: tree, queryTerms };
}

// ---------- AST evaluation ----------

function evalNode(node: Ast, b: Bookmark): boolean {
  switch (node.kind) {
    case "empty":
      return true;
    case "term":
    case "phrase":
      // Free-text nodes are handled by BM25, not predicates. They always pass
      // the predicate phase; ranking happens after.
      return true;
    case "and":
      return node.children.every((c) => evalNode(c, b));
    case "or":
      return node.children.some((c) => evalNode(c, b));
    case "not":
      return !evalNode(node.child, b);
    case "operator":
      return evalOperator(node, b);
  }
}

function evalOperator(node: OperatorNode, b: Bookmark): boolean {
  const value = node.value;
  switch (node.key) {
    case "from":
      return b.author.screenName.toLowerCase() === value.toLowerCase();
    case "to":
      return (
        (b.inReplyToScreenName ?? "").toLowerCase() === value.toLowerCase()
      );
    case "tag":
      // Tags not in data model yet — predicate is false until tags ship.
      return false;
    case "site": {
      const want = value.toLowerCase().replace(/^www\./, "");
      for (const u of b.urls) {
        const host = hostnameOf(u.expandedUrl) || hostnameOf(u.url);
        if (host && hostMatches(host, want)) return true;
      }
      return false;
    }
    case "url": {
      const want = value.toLowerCase();
      for (const u of b.urls) {
        if (
          u.url.toLowerCase().includes(want) ||
          u.displayUrl.toLowerCase().includes(want) ||
          u.expandedUrl.toLowerCase().includes(want)
        ) {
          return true;
        }
      }
      return false;
    }
    case "since": {
      const ts = parseDateOrDuration(value, "since");
      return ts != null && b.createdAt >= ts;
    }
    case "until": {
      const ts = parseDateOrDuration(value, "until");
      return ts != null && b.createdAt < ts;
    }
    case "within": {
      const ms = parseDuration(value);
      if (ms == null) return false;
      return b.createdAt >= Date.now() - ms;
    }
    case "older_than": {
      const ms = parseDuration(value);
      if (ms == null) return false;
      return b.createdAt < Date.now() - ms;
    }
    case "min_faves":
      return b.metrics.likes >= toInt(value);
    case "min_retweets":
      return b.metrics.retweets >= toInt(value);
    case "min_replies":
      return b.metrics.replies >= toInt(value);
    case "has":
    case "filter":
      return evalHasFilter(value.toLowerCase(), b);
    case "is":
      return evalIs(value.toLowerCase(), b);
    case "lang":
      // Language not extracted today — best-effort: never match unless we add it.
      return false;
  }
}

function evalHasFilter(value: string, b: Bookmark): boolean {
  switch (value) {
    case "image":
    case "images":
    case "photo":
    case "photos":
      return b.media.some((m) => m.type === "photo") || b.hasImage;
    case "video":
    case "videos":
      return (
        b.media.some((m) => m.type === "video" || m.type === "animated_gif") ||
        b.hasVideo
      );
    case "media":
      return b.media.length > 0 || b.hasImage || b.hasVideo;
    case "link":
    case "links":
      return b.urls.length > 0 || b.hasLink;
    case "thread":
      return b.isThread;
    case "reply":
    case "replies":
      return b.tweetKind === "reply";
    case "quote":
      return b.quotedTweet != null;
    case "retweet":
    case "retweets":
      return b.tweetKind === "repost" || b.retweetedTweet != null;
    case "article":
      return b.tweetKind === "article" || b.article != null;
    default:
      return false;
  }
}

function evalIs(value: string, b: Bookmark): boolean {
  switch (value) {
    case "thread":
      return b.isThread;
    case "reply":
      return b.tweetKind === "reply";
    case "quote":
      return b.quotedTweet != null;
    case "article":
      return b.tweetKind === "article" || b.article != null;
    case "image":
      return b.hasImage;
    case "video":
      return b.hasVideo;
    case "link":
      return b.hasLink;
    default:
      return false;
  }
}

// ---------- Helpers ----------

function hostnameOf(url: string): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

function hostMatches(host: string, want: string): boolean {
  if (host === want) return true;
  return host.endsWith(`.${want}`);
}

function toInt(value: string): number {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : 0;
}

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseDateOrDuration(
  value: string,
  kind: "since" | "until",
): number | null {
  const m = ISO_DATE_RE.exec(value);
  if (m) {
    const ts = Date.UTC(
      parseInt(m[1], 10),
      parseInt(m[2], 10) - 1,
      parseInt(m[3], 10),
    );
    if (Number.isFinite(ts)) return ts;
  }
  // Treat plain numbers / durations as relative.
  const ms = parseDuration(value);
  if (ms != null) {
    return kind === "since" ? Date.now() - ms : Date.now() + ms;
  }
  return null;
}

const DURATION_RE = /^(\d+)\s*(s|m|h|d|w|mo|y)?$/i;

function parseDuration(value: string): number | null {
  const m = DURATION_RE.exec(value.trim());
  if (!m) return null;
  const n = parseInt(m[1], 10);
  const unit = (m[2] ?? "d").toLowerCase();
  switch (unit) {
    case "s":
      return n * 1000;
    case "m":
      return n * 60 * 1000;
    case "h":
      return n * 60 * 60 * 1000;
    case "d":
      return n * DAY_MS;
    case "w":
      return n * 7 * DAY_MS;
    case "mo":
      return n * 30 * DAY_MS;
    case "y":
      return n * 365 * DAY_MS;
    default:
      return null;
  }
}
