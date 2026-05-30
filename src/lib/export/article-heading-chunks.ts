export interface ArticleHeadingChunk {
  heading?: string;
  text: string;
}

export function splitPlainTextByHeadings(
  plainText: string,
  headings: { index: number; text: string }[],
): ArticleHeadingChunk[] {
  const lines: string[] = [];
  for (const line of plainText.split(/\n/)) {
    const trimmed = line.trim();
    if (trimmed) lines.push(trimmed);
  }
  const headingByLineIndex = new Map(
    headings.map((heading) => [heading.index, heading.text]),
  );

  const chunks: ArticleHeadingChunk[] = [];
  let currentLines: string[] = [];
  let currentHeading: string | undefined;

  for (let i = 0; i < lines.length; i++) {
    const heading = headingByLineIndex.get(i);
    if (heading) {
      if (currentLines.length > 0 || currentHeading !== undefined) {
        chunks.push({ heading: currentHeading, text: currentLines.join("\n") });
      }
      currentHeading = heading;
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
