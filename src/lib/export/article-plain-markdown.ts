import {
  paragraphizeText,
  sanitizeUrl,
  sanitizeUrlRelaxed,
} from "../../components/reader/utils";

const URL_REGEX = /https?:\/\/[^\s<]+/g;
const MENTION_REGEX =
  /(^|[^A-Za-z0-9_])@([A-Za-z0-9_]{1,15})(?=$|[^A-Za-z0-9_])/g;
const HASHTAG_REGEX =
  /(^|[^A-Za-z0-9_])#([A-Za-z0-9_]+)(?=$|[^A-Za-z0-9_])/g;
const MD_LINK = /\[([^\]]*)\]\(([^)]*)\)/g;

export function escapeMarkdownPlain(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/`/g, "\\`")
    .replace(/\*/g, "\\*")
    .replace(/_/g, "\\_")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]");
}

export function wrapInlineCode(content: string): string {
  if (!content.includes("`") && !content.includes("\n")) {
    return "`" + content + "`";
  }
  return "``" + content.replace(/`/g, "`") + "``";
}

export function wrapItalic(inner: string): string {
  if (inner.includes("*") && inner.includes("_")) {
    return `<em>${inner}</em>`;
  }
  if (inner.includes("*")) {
    return `_${inner}_`;
  }
  if (inner.includes("_")) {
    return `*${inner}*`;
  }
  return `*${inner}*`;
}

function applyMentionsAndHashtags(s: string): string {
  const withMentions = s.replace(
    MENTION_REGEX,
    (_match, prefix: string, handle: string) =>
      `${prefix}[@${escapeMarkdownPlain(handle)}](https://x.com/${handle})`,
  );

  return withMentions.replace(
    HASHTAG_REGEX,
    (_match, prefix: string, tag: string) =>
      `${prefix}[#${escapeMarkdownPlain(tag)}](https://x.com/hashtag/${tag})`,
  );
}

function linkifyUrlsAndMentions(text: string): string {
  if (!text) return "";

  const parts: string[] = [];
  let lastIndex = 0;
  const re = new RegExp(URL_REGEX.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > lastIndex) {
      const plain = text.slice(lastIndex, m.index);
      parts.push(applyMentionsAndHashtags(escapeMarkdownPlain(plain)));
    }
    const url = m[0];
    const safe = sanitizeUrl(url);
    parts.push(
      safe ? `[${escapeMarkdownPlain(url)}](${safe})` : escapeMarkdownPlain(url),
    );
    lastIndex = m.index + url.length;
  }
  if (lastIndex < text.length) {
    parts.push(
      applyMentionsAndHashtags(escapeMarkdownPlain(text.slice(lastIndex))),
    );
  }

  return parts.join("");
}

function linkifyPlainWithMdLinks(plain: string): string {
  if (!plain) return "";

  const parts: string[] = [];
  let last = 0;
  const re = new RegExp(MD_LINK.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(plain)) !== null) {
    if (m.index > last) {
      parts.push(linkifyUrlsAndMentions(plain.slice(last, m.index)));
    }
    const label = m[1];
    const url = m[2];
    const safe = sanitizeUrlRelaxed(url) || sanitizeUrl(url);
    if (safe) {
      parts.push(`[${escapeMarkdownPlain(label)}](${safe})`);
    } else {
      parts.push(escapeMarkdownPlain(m[0]));
    }
    last = m.index + m[0].length;
  }
  if (last < plain.length) {
    parts.push(linkifyUrlsAndMentions(plain.slice(last)));
  }
  return parts.join("");
}

export function linkifyMarkdown(text: string): string {
  return linkifyPlainWithMdLinks(text);
}

export function paragraphMarkdown(text: string): string {
  if (!text) return "";
  const out: string[] = [];
  let last = 0;
  const re = /`([^`\n]+)`/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      out.push(linkifyPlainWithMdLinks(text.slice(last, m.index)));
    }
    out.push(wrapInlineCode(m[1]));
    last = m.index + m[0].length;
  }
  if (last < text.length) {
    out.push(linkifyPlainWithMdLinks(text.slice(last)));
  }
  return out.join("").replace(/\n/g, "  \n");
}

export function richTextArticleMarkdown(plainText: string): string {
  const trimmed = plainText.replace(/\r\n/g, "\n").trim();
  if (!trimmed) return "";

  const paragraphs = paragraphizeText(trimmed, "article");
  return paragraphs.map((p) => paragraphMarkdown(p)).join("\n\n");
}
