import type { TweetUrl } from "../types";

export function stripCardUrlsFromTweetText(text: string, urls: TweetUrl[]): string {
  if (urls.length === 0) return text;
  let result = text;
  for (const u of urls) {
    if (u.card?.title) {
      if (u.url) result = result.replaceAll(u.url, "");
      if (u.expandedUrl) result = result.replaceAll(u.expandedUrl, "");
    } else if (u.url && u.expandedUrl) {
      result = result.replaceAll(u.url, u.expandedUrl);
    }
  }
  return result.replace(/\n+$/, "").trimEnd();
}
