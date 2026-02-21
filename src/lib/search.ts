import type { Bookmark } from "../types";

interface SearchableFields {
  screenName: string;
  authorName: string;
  title: string;
  text: string;
  articleText: string;
  cardTexts: string;
}

function buildSearchableFields(bookmark: Bookmark): SearchableFields {
  const cardTexts = bookmark.urls
    .map((u) => [u.card?.title, u.card?.description].filter(Boolean).join(" "))
    .join(" ");

  const title = (
    bookmark.article?.title || bookmark.text.slice(0, 100)
  ).toLowerCase();

  return {
    screenName: bookmark.author.screenName.toLowerCase(),
    authorName: bookmark.author.name.toLowerCase(),
    title,
    text: bookmark.text.toLowerCase(),
    articleText: (bookmark.article?.plainText ?? "").toLowerCase(),
    cardTexts: cardTexts.toLowerCase(),
  };
}

function scoreBookmark(
  fields: SearchableFields,
  terms: string[],
  phrase: string,
): number {
  let score = 0;

  for (const term of terms) {
    if (fields.screenName === term) score += 10;
    if (fields.authorName.includes(term)) score += 8;
    if (fields.screenName.includes(term) && fields.screenName !== term)
      score += 8;
    if (fields.title.includes(term)) score += 6;
    if (fields.text.includes(term)) score += 3;
    if (fields.articleText.includes(term)) score += 2;
    if (fields.cardTexts.includes(term)) score += 1;
  }

  if (terms.length > 1) {
    if (fields.title.includes(phrase)) score += 5;
    if (fields.text.includes(phrase)) score += 3;
  }

  return score;
}

export function searchBookmarks(
  bookmarks: Bookmark[],
  query: string,
): Bookmark[] {
  const trimmed = query.trim();
  if (trimmed.length === 0) return bookmarks;

  const phrase = trimmed.toLowerCase();
  const terms = phrase.split(/\s+/).map((t) => t.replace(/^@/, ""));

  const scored: { bookmark: Bookmark; score: number; index: number }[] = [];

  for (let i = 0; i < bookmarks.length; i++) {
    const fields = buildSearchableFields(bookmarks[i]);
    const score = scoreBookmark(fields, terms, phrase);
    if (score > 0) {
      scored.push({ bookmark: bookmarks[i], score, index: i });
    }
  }

  scored.sort((a, b) => b.score - a.score || a.index - b.index);

  return scored.map((s) => s.bookmark);
}
