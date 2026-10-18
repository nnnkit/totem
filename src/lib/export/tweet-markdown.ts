import type {
  ArticleContent,
  Author,
  Media,
  Poll,
  QuotedTweet,
  TextStyleRange,
  TweetUrl,
} from "../../types";

export interface TweetMarkdownNode {
  tweetId: string;
  author: Pick<Author, "name" | "screenName">;
  text: string;
  urls?: TweetUrl[];
  textStyles?: TextStyleRange[];
  media: Media[];
  poll?: Poll;
  article?: ArticleContent | null;
  quotedTweet?: QuotedTweet | null;
  retweetedTweet?: QuotedTweet | null;
  inReplyToTweetId?: string;
  inReplyToScreenName?: string;
}

type TokenKind = "url" | "mention" | "hashtag" | "cashtag" | "drop";

interface Token {
  start: number;
  end: number;
  kind: TokenKind;
  value: string;
}

const URL_RE = /https?:\/\/[^\s<>"]+/g;
const MENTION_RE = /(?<![\p{L}\p{N}_@])@([A-Za-z0-9_]{1,15})(?![A-Za-z0-9_@])/gu;
const HASHTAG_RE = /(?<![\p{L}\p{N}_&#/])[#＃]([\p{L}\p{M}\p{N}_]+)/gu;
const CASHTAG_RE = /(?<![\p{L}\p{N}_$])\$([A-Za-z]{1,6}(?:[._][A-Za-z]{1,2})?)(?![A-Za-z0-9_])/gu;
const SAFE_BARE_URL = /^https?:\/\/[^\s<>()[\]*_`~\\]+$/;

export function statusUrl(screenName: string, tweetId: string): string {
  return `https://x.com/${screenName}/status/${tweetId}`;
}

export function escapeInline(text: string): string {
  return text
    .replace(/[\\`*_[\]<~$]/g, "\\$&")
    .replace(/&(?=#?\w+;)/g, "&amp;");
}

function escapeLineStart(line: string): string {
  return line
    .replace(/^( {0,3})(#{1,6})(?=\s|$)/, "$1\\$2")
    .replace(/^( {0,3})>/, "$1\\>")
    .replace(/^( {0,3})([-+=])/, "$1\\$2")
    .replace(/^( {0,3})(\d{1,9})([.)])(?=\s|$)/, "$1$2\\$3")
    .replace(/^ {4,}/, (spaces) => " ".repeat(spaces.length));
}

function trimUrlMatch(url: string): string {
  let out = url.replace(/[.,;:!?'"…]+$/, "");
  while (out.endsWith(")")) {
    const opens = out.split("(").length - 1;
    const closes = out.split(")").length - 1;
    if (closes <= opens) break;
    out = out.slice(0, -1).replace(/[.,;:!?'"…]+$/, "");
  }
  return out;
}

function overlaps(tokens: Token[], start: number, end: number): boolean {
  return tokens.some((t) => start < t.end && end > t.start);
}

// A card URL is dropped only when it trails the text (X hides it behind the
// card); mid-sentence it is part of the prose and must stay.
function isTrailing(text: string, end: number): boolean {
  return /^(?:\s|https?:\/\/\S+)*$/.test(text.slice(end));
}

function tokenize(text: string, urls: TweetUrl[]): Token[] {
  const tokens: Token[] = [];
  const dropped = new Set<string>();
  const known: string[] = [];
  for (const u of urls) {
    const candidates = [u.expandedUrl, u.url].filter(Boolean);
    if (u.card?.title) candidates.forEach((c) => dropped.add(c));
    known.push(...candidates);
  }

  for (const value of known.toSorted((a, b) => b.length - a.length)) {
    let from = 0;
    while ((from = text.indexOf(value, from)) !== -1) {
      const end = from + value.length;
      if (!overlaps(tokens, from, end)) {
        const drop = dropped.has(value) && isTrailing(text, end);
        tokens.push({ start: from, end, kind: drop ? "drop" : "url", value });
      }
      from = end;
    }
  }

  for (const m of text.matchAll(URL_RE)) {
    const value = trimUrlMatch(m[0]);
    const start = m.index!;
    const end = start + value.length;
    if (!overlaps(tokens, start, end)) {
      const drop = dropped.has(value) && isTrailing(text, end);
      tokens.push({ start, end, kind: drop ? "drop" : "url", value });
    }
  }

  const patterns: Array<[RegExp, TokenKind]> = [
    [MENTION_RE, "mention"],
    [CASHTAG_RE, "cashtag"],
    [HASHTAG_RE, "hashtag"],
  ];
  for (const [re, kind] of patterns) {
    for (const m of text.matchAll(re)) {
      const start = m.index!;
      const end = start + m[0].length;
      if (kind === "hashtag" && /^[\p{N}_]+$/u.test(m[1])) continue;
      if (!overlaps(tokens, start, end)) {
        tokens.push({ start, end, kind, value: m[1] });
      }
    }
  }

  return tokens.toSorted((a, b) => a.start - b.start);
}

function renderUrl(url: string): string {
  return SAFE_BARE_URL.test(url) ? url : `<${url.replace(/[\s<>]/g, encodeURIComponent)}>`;
}

function renderToken(token: Token): string {
  switch (token.kind) {
    case "url":
      return renderUrl(token.value);
    case "mention":
      return `[@${token.value}](https://x.com/${token.value})`;
    case "hashtag":
      return `[#${token.value}](https://x.com/hashtag/${encodeURIComponent(token.value)})`;
    case "cashtag":
      // Escaped so two cashtags on one line don't pair up as Obsidian inline math.
      return `[\\$${token.value}](https://x.com/search?q=${encodeURIComponent(`$${token.value}`)})`;
    case "drop":
      return "";
  }
}

interface Piece {
  text: string;
  token?: Token;
  bold: boolean;
  italic: boolean;
}

function wrapEmphasis(inner: string, bold: boolean, italic: boolean): string {
  if (!bold && !italic) return inner;
  const match = /^(\s*)([\s\S]*?)(\s*)$/.exec(inner)!;
  if (!match[2]) return inner;
  const marker = bold && italic ? "***" : bold ? "**" : "*";
  return `${match[1]}${marker}${match[2]}${marker}${match[3]}`;
}

function renderLine(pieces: Piece[]): string {
  let out = "";
  let i = 0;
  while (i < pieces.length) {
    const { bold, italic } = pieces[i];
    let inner = "";
    while (i < pieces.length && pieces[i].bold === bold && pieces[i].italic === italic) {
      const p = pieces[i];
      inner += p.token ? renderToken(p.token) : escapeInline(p.text);
      i++;
    }
    out += wrapEmphasis(inner, bold, italic);
  }
  return escapeLineStart(out.trimEnd());
}

export function tweetTextToMarkdown(
  text: string,
  urls: TweetUrl[] = [],
  textStyles: TextStyleRange[] = [],
): string {
  const normalized = text.replace(/\r\n?/g, "\n");
  if (!normalized.trim()) return "";

  const bold = new Uint8Array(normalized.length);
  const italic = new Uint8Array(normalized.length);
  for (const range of textStyles) {
    const target = range.style === "bold" ? bold : italic;
    target.fill(1, Math.max(0, range.start), Math.min(range.end, normalized.length));
  }

  const tokens = tokenize(normalized, urls);
  const lines: Piece[][] = [[]];
  let tokenIndex = 0;
  let i = 0;
  while (i < normalized.length) {
    const token = tokens[tokenIndex];
    if (token && token.start === i) {
      lines[lines.length - 1].push({
        text: normalized.slice(token.start, token.end),
        token,
        bold: bold[i] === 1,
        italic: italic[i] === 1,
      });
      i = token.end;
      tokenIndex++;
      continue;
    }
    const ch = normalized[i];
    if (ch === "\n") {
      lines.push([]);
      i++;
      continue;
    }
    const line = lines[lines.length - 1];
    const last = line[line.length - 1];
    const b = bold[i] === 1;
    const it = italic[i] === 1;
    if (last && !last.token && last.bold === b && last.italic === it) {
      last.text += ch;
    } else {
      line.push({ text: ch, bold: b, italic: it });
    }
    i++;
  }

  const paragraphs: string[][] = [[]];
  for (const pieces of lines) {
    const rendered = renderLine(pieces);
    if (rendered.trim()) {
      paragraphs[paragraphs.length - 1].push(rendered);
    } else if (paragraphs[paragraphs.length - 1].length > 0) {
      paragraphs.push([]);
    }
  }

  return paragraphs
    .filter((p) => p.length > 0)
    .map((p) => p.join("  \n"))
    .join("\n\n");
}

function imageAlt(value: string): string {
  return value.replace(/[\r\n]+/g, " ").replace(/[\\[\]]/g, "\\$&").trim();
}

function largePhotoUrl(url: string): string {
  return /^https:\/\/pbs\.twimg\.com\/media\/[^?]+\.(jpe?g|png|webp)$/i.test(url)
    ? `${url}?name=large`
    : url;
}

function mediaToMarkdown(media: Media[], node: { author: { screenName: string }; tweetId: string }): string[] {
  const handle = node.author.screenName;
  const parts: string[] = [];
  for (const m of media) {
    const alt = m.altText?.trim();
    if (m.type === "photo" && m.url) {
      parts.push(`![${imageAlt(alt || `Image attached to @${handle}'s post`)}](${largePhotoUrl(m.url)})`);
    } else if (m.type === "video" || m.type === "animated_gif") {
      if (m.url) {
        parts.push(`![${imageAlt(alt || `Video preview from @${handle}'s post`)}](${m.url})`);
      }
      const watch = `[Watch on X](${statusUrl(handle, node.tweetId)})`;
      parts.push(m.videoUrl ? `${watch} · [MP4](${renderLinkTarget(m.videoUrl)})` : watch);
    }
  }
  return parts;
}

function renderLinkTarget(url: string): string {
  return url.replace(/[\s()]/g, encodeURIComponent);
}

function formatPollDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const label = date.toLocaleString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  return `${label} UTC`;
}

function pluralVotes(count: number): string {
  return `${count.toLocaleString("en-US")} ${count === 1 ? "vote" : "votes"}`;
}

export function pollToMarkdown(poll: Poll, now = Date.now()): string {
  const total = poll.choices.reduce((sum, choice) => sum + choice.count, 0);
  const endsAt = poll.endsAt ? Date.parse(poll.endsAt) : NaN;
  const status = poll.ended
    ? "Final results"
    : poll.endsAt
      ? `${endsAt <= now ? "Ended" : "Ends"} ${formatPollDate(poll.endsAt)}`
      : "";
  const header = ["**Poll**", pluralVotes(total), status].filter(Boolean).join(" · ");
  const rows = poll.choices.map((choice) => {
    const share = total > 0 ? ((choice.count / total) * 100).toFixed(1) : "0.0";
    return `- ${escapeLineStart(escapeInline(choice.label.trim()))} — ${pluralVotes(choice.count)} (${share}%)`;
  });
  return [header, "", ...rows].join("\n");
}

function cardsToMarkdown(urls: TweetUrl[]): string[] {
  const seen = new Set<string>();
  const parts: string[] = [];
  for (const u of urls) {
    const card = u.card;
    const href = u.expandedUrl || u.url;
    if (!card?.title || !href || seen.has(href)) continue;
    seen.add(href);
    const lines = [`> [${escapeInline(card.title)}](${renderLinkTarget(href)})`];
    const description = card.description?.replace(/\s+/g, " ").trim();
    if (description) lines.push(`> ${escapeInline(description)}`);
    const domain = card.domain?.trim();
    if (domain && domain !== card.title.trim()) lines.push(`> ${escapeInline(domain)}`);
    parts.push(lines.join("  \n"));
  }
  return parts;
}

function attributedHandle(author: Pick<Author, "name" | "screenName">, href: string): string {
  const name = author.name?.trim();
  const handleLink = `[@${author.screenName}](${href})`;
  return name && name !== author.screenName
    ? `**${escapeInline(name)}** (${handleLink})`
    : handleLink;
}

function blockquote(markdown: string): string {
  return markdown
    .split("\n")
    .map((line) => (line ? `> ${line}` : ">"))
    .join("\n");
}

function articleTeaser(article: ArticleContent | null | undefined, href: string): string {
  const title = article?.title?.trim();
  return title ? `**Article:** [${escapeInline(title)}](${href})` : "";
}

// The parser drops the leading reply handles, so say who the post answers
// unless the parent is already part of the export.
function replyContext(node: TweetMarkdownNode): string {
  const target = node.inReplyToScreenName;
  if (!target || target.toLowerCase() === node.author.screenName.toLowerCase()) return "";
  return `Replying to [@${target}](https://x.com/${target})`;
}

function contentParts(node: TweetMarkdownNode, parentShown = false): string[] {
  const urls = node.urls ?? [];
  const parts: string[] = [];
  const reply = parentShown ? "" : replyContext(node);
  if (reply) parts.push(reply);
  const text = tweetTextToMarkdown(node.text, urls, node.textStyles);
  if (text) parts.push(text);
  const teaser = articleTeaser(node.article, statusUrl(node.author.screenName, node.tweetId));
  if (teaser && !node.text.includes(node.article?.title?.trim() ?? "\0")) parts.push(teaser);
  parts.push(...mediaToMarkdown(node.media, node));
  if (node.poll) parts.push(pollToMarkdown(node.poll));
  parts.push(...cardsToMarkdown(urls));
  return parts;
}

function quotedToMarkdown(quoted: QuotedTweet): string {
  const href = statusUrl(quoted.author.screenName, quoted.tweetId);
  const parts = [`Quoting ${attributedHandle(quoted.author, href)}`, ...contentParts(quoted)];
  return blockquote(parts.join("\n\n"));
}

export function tweetNodeToMarkdown(node: TweetMarkdownNode, parentShown = false): string {
  const reposted = node.retweetedTweet;
  if (reposted) {
    const href = statusUrl(reposted.author.screenName, reposted.tweetId);
    const inner: TweetMarkdownNode = {
      ...reposted,
      media: reposted.media.length > 0 ? reposted.media : node.media,
    };
    return [`Reposted from ${attributedHandle(reposted.author, href)}`, ...contentParts(inner)].join("\n\n");
  }

  const parts = contentParts(node, parentShown);
  if (node.quotedTweet) parts.push(quotedToMarkdown(node.quotedTweet));
  return parts.join("\n\n");
}

export function tweetThreadToMarkdown(
  focal: TweetMarkdownNode,
  thread: Array<TweetMarkdownNode & { createdAt: number }>,
  focalCreatedAt: number,
): string {
  const nodes = [
    { ...focal, createdAt: focalCreatedAt },
    ...thread.filter((t) => t.tweetId !== focal.tweetId),
  ].toSorted((a, b) => a.createdAt - b.createdAt);

  const focalHandle = focal.author.screenName.toLowerCase();
  const multiAuthor = nodes.some((n) => n.author.screenName.toLowerCase() !== focalHandle);

  const shownIds = new Set(nodes.map((n) => n.tweetId));
  return nodes
    .map((node) => {
      const parentShown = Boolean(node.inReplyToTweetId && shownIds.has(node.inReplyToTweetId));
      const body = tweetNodeToMarkdown(node, parentShown);
      if (!multiAuthor) return body;
      const header = attributedHandle(node.author, statusUrl(node.author.screenName, node.tweetId));
      return body ? `${header}\n\n${body}` : header;
    })
    .filter(Boolean)
    .join("\n\n---\n\n");
}
