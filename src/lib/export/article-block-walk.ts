import type {
  ArticleContent,
  ArticleContentBlock,
  ArticleContentEntity,
} from "../../types";
import {
  detectArticleHeadings,
  groupBlocks,
  headingBlockMatchesArticleTitle,
} from "../../components/reader/utils";

type EntityMap = Record<string, ArticleContentEntity>;

export interface ArticleBlockEmit<T> {
  unorderedList(items: ArticleContentBlock[], entityMap: EntityMap): T;
  orderedList(items: ArticleContentBlock[], entityMap: EntityMap): T;
  mediaImage(url: string, alt: string): T | null;
  mediaVideo(imageUrl: string | undefined, postUrl: string | undefined): T;
  markdownEntity(code: string): T;
  divider(): T;
  empty(): T;
  heading(level: 1 | 2 | 3, block: ArticleContentBlock, entityMap: EntityMap): T;
  blockquote(block: ArticleContentBlock, entityMap: EntityMap): T;
  codeBlock(block: ArticleContentBlock): T;
  paragraph(block: ArticleContentBlock, entityMap: EntityMap): T;
}

const HEADING_LEVEL: Record<string, 1 | 2 | 3> = {
  "header-one": 1,
  "header-two": 2,
  "header-three": 3,
};

function stripMarkdownEntityCode(markdown: string): string {
  return markdown.replace(/^```\w*\n?/, "").replace(/\n?```$/, "");
}

function emitAtomic<T>(
  block: ArticleContentBlock,
  entityMap: EntityMap,
  postUrl: string | undefined,
  emit: ArticleBlockEmit<T>,
  out: T[],
): void {
  for (const range of block.entityRanges) {
    const entity = entityMap[String(range.key)];
    if (entity?.type === "MEDIA") {
      const imageUrl = entity.data?.imageUrl;
      const videoUrl = entity.data?.videoUrl;
      if (typeof videoUrl === "string" && videoUrl) {
        out.push(
          emit.mediaVideo(
            typeof imageUrl === "string" && imageUrl ? imageUrl : undefined,
            postUrl,
          ),
        );
        break;
      }
      if (typeof imageUrl === "string" && imageUrl) {
        const alt =
          String(
            entity.data?.altText ||
              entity.data?.imageAlt ||
              entity.data?.alt ||
              "",
          ).trim() || "Media attachment";
        const emitted = emit.mediaImage(imageUrl, alt);
        if (emitted !== null) {
          out.push(emitted);
          break;
        }
      }
    }
    if (entity?.type === "MARKDOWN") {
      const markdown = String(entity.data?.markdown || "");
      if (markdown) {
        out.push(emit.markdownEntity(stripMarkdownEntityCode(markdown)));
        break;
      }
    }
    if (entity?.type === "DIVIDER") {
      out.push(emit.divider());
      break;
    }
  }
}

export function walkArticleBlocks<T>(
  blocks: ArticleContentBlock[],
  entityMap: EntityMap,
  articleTitle: string | undefined,
  postUrl: string | undefined,
  emit: ArticleBlockEmit<T>,
): T[] {
  const groups = groupBlocks(blocks);
  const out: T[] = [];

  for (const group of groups) {
    if (group.type === "unordered-list") {
      out.push(emit.unorderedList(group.items, entityMap));
      continue;
    }

    if (group.type === "ordered-list") {
      out.push(emit.orderedList(group.items, entityMap));
      continue;
    }

    const { block } = group;

    if (block.type === "atomic") {
      emitAtomic(block, entityMap, postUrl, emit, out);
      continue;
    }

    if (!block.text.trim()) {
      out.push(emit.empty());
      continue;
    }

    const headingLevel = HEADING_LEVEL[block.type];
    if (headingLevel !== undefined) {
      if (headingBlockMatchesArticleTitle(block.text, articleTitle)) {
        continue;
      }
      out.push(emit.heading(headingLevel, block, entityMap));
      continue;
    }

    if (block.type === "blockquote") {
      out.push(emit.blockquote(block, entityMap));
      continue;
    }
    if (block.type === "code-block") {
      out.push(emit.codeBlock(block));
      continue;
    }

    out.push(emit.paragraph(block, entityMap));
  }

  return out;
}

export type ArticleShape =
  | { kind: "blocks"; blocks: ArticleContentBlock[] }
  | { kind: "richText"; plainText: string }
  | {
      kind: "heading-chunks";
      plainText: string;
      headings: { index: number; text: string }[];
    };

export function resolveArticleShape(
  article: ArticleContent,
  plainText: string,
): ArticleShape {
  const hasBlocks =
    article.contentBlocks !== undefined && article.contentBlocks.length > 0;
  if (hasBlocks) {
    return { kind: "blocks", blocks: article.contentBlocks! };
  }

  const headings = detectArticleHeadings(plainText, {
    articleTitle: article.title?.trim(),
  });
  if (headings.length === 0) {
    return { kind: "richText", plainText };
  }
  return { kind: "heading-chunks", plainText, headings };
}
