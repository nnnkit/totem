export interface ArticleHeadingChunk {
  heading?: string;
  text: string;
}

export function splitPlainTextByHeadings(
  plainText: string,
  headings: { index: number; text: string }[],
): ArticleHeadingChunk[] {
  const lines = plainText
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const headingLineIndices = new Set(headings.map((h) => h.index));

  const chunks: ArticleHeadingChunk[] = [];
  let currentLines: string[] = [];
  let currentHeading: string | undefined;

  for (let i = 0; i < lines.length; i++) {
    if (headingLineIndices.has(i)) {
      if (currentLines.length > 0 || currentHeading !== undefined) {
        chunks.push({ heading: currentHeading, text: currentLines.join("\n") });
      }
      const match = headings.find((h) => h.index === i);
      currentHeading = match?.text;
      currentLines = [];
    } else {
      currentLines.push(lines[i]);
    }
  }
  if (currentLines.length > 0 || currentHeading !== undefined) {
    chunks.push({ heading: currentHeading, text: currentLines.join("\n") });
  }

  return chunks;
}
