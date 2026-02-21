export const SEARCH_WEIGHTS = {
  exactScreenName: 10,
  authorName: 8,
  screenName: 8,
  title: 6,
  text: 3,
  articleText: 2,
  cardTexts: 1,
  titlePhrase: 5,
  textPhrase: 3,
} as const;

export const RELATED_WEIGHTS = {
  sameAuthor: 4,
  sameKind: 2,
  bothArticle: 1,
  bothMedia: 1,
  tokenOverlapCap: 3,
  randomBoost: 2,
  minTokenLength: 4,
} as const;
