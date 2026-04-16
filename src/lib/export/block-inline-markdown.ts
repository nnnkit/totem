import type {
  ArticleContentBlock,
  ArticleContentEntity,
} from "../../types";
import { sanitizeUrlRelaxed } from "../../components/reader/utils";
import {
  escapeMarkdownPlain,
  linkifyMarkdown,
  wrapInlineCode,
  wrapItalic,
} from "./article-plain-markdown";

export function renderBlockInlineMarkdown(
  block: ArticleContentBlock,
  entityMap: Record<string, ArticleContentEntity>,
): string {
  const { text, inlineStyleRanges, entityRanges } = block;
  if (!text) return "";

  const length = text.length;
  const bold = new Uint8Array(length);
  const italic = new Uint8Array(length);
  const code = new Uint8Array(length);
  const entityKey: (number | -1)[] = new Array(length).fill(-1);
  const linkHref: string[] = new Array(length).fill("");

  for (const range of inlineStyleRanges) {
    const end = Math.min(range.offset + range.length, length);
    const style = range.style.toUpperCase();
    for (let i = range.offset; i < end; i++) {
      if (style === "BOLD") bold[i] = 1;
      if (style === "ITALIC") italic[i] = 1;
      if (style === "CODE") code[i] = 1;
    }
  }

  for (const range of entityRanges) {
    const end = Math.min(range.offset + range.length, length);
    for (let i = range.offset; i < end; i++) {
      entityKey[i] = range.key;
    }
  }

  for (const range of block.data?.urls || []) {
    const start = Math.max(0, Math.min(range.fromIndex, length));
    const rawEnd =
      typeof range.toIndex === "number"
        ? range.toIndex
        : start + (range.text?.length || 0);
    const end = Math.max(start, Math.min(rawEnd, length));
    const href = sanitizeUrlRelaxed((range.text || text.slice(start, end)).trim());
    if (!href || end <= start) continue;
    for (let i = start; i < end; i++) {
      if (entityKey[i] < 0) linkHref[i] = href;
    }
  }

  type Segment = {
    text: string;
    bold: boolean;
    italic: boolean;
    code: boolean;
    entityKey: number;
    linkHref: string;
  };
  const segments: Segment[] = [];

  for (let i = 0; i < length; i++) {
    const seg: Segment = {
      text: text[i],
      bold: bold[i] === 1,
      italic: italic[i] === 1,
      code: code[i] === 1,
      entityKey: entityKey[i],
      linkHref: linkHref[i],
    };
    const last = segments[segments.length - 1];
    if (
      last &&
      last.bold === seg.bold &&
      last.italic === seg.italic &&
      last.code === seg.code &&
      last.entityKey === seg.entityKey &&
      last.linkHref === seg.linkHref
    ) {
      last.text += seg.text;
    } else {
      segments.push(seg);
    }
  }

  for (let i = 0; i < segments.length; i++) {
    if (segments[i].code) {
      segments[i].text = segments[i].text.replace(/^`|`$/g, "");
      if (i > 0 && !segments[i - 1].code) {
        segments[i - 1].text = segments[i - 1].text.replace(/`$/, "");
      }
      if (i < segments.length - 1 && !segments[i + 1].code) {
        segments[i + 1].text = segments[i + 1].text.replace(/^`/, "");
      }
    }
  }

  return segments
    .map((seg) => {
      if (seg.code) {
        return wrapInlineCode(seg.text);
      }

      let inner =
        seg.linkHref || seg.entityKey >= 0
          ? escapeMarkdownPlain(seg.text)
          : linkifyMarkdown(seg.text);

      if (seg.bold && seg.italic) {
        inner = `***${inner}***`;
      } else if (seg.bold) {
        inner = `**${inner}**`;
      } else if (seg.italic) {
        inner = wrapItalic(inner);
      }

      if (seg.entityKey >= 0) {
        const entity = entityMap[String(seg.entityKey)];
        if (entity?.type === "LINK") {
          const url = sanitizeUrlRelaxed(String(entity.data?.url || ""));
          if (url) {
            inner = `[${inner}](${url})`;
          }
        }
      } else if (seg.linkHref) {
        const url = sanitizeUrlRelaxed(seg.linkHref);
        if (url) {
          inner = `[${inner}](${url})`;
        }
      }

      return inner;
    })
    .join("");
}
