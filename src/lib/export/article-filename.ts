import type { ArticleContent } from "../../types";

export function slugifyArticleBasename(article: ArticleContent): string {
  const raw =
    article.title?.trim() ||
    article.plainText?.trim().slice(0, 60) ||
    "article";
  const ascii = raw
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  const slug = ascii
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  return slug || "article";
}
