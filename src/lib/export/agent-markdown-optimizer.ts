interface FrontmatterParseResult {
  metadata: Record<string, string>;
  body: string;
}

const GENERIC_MEDIA_ALT_PATTERNS = [
  /^cover image/i,
  /^media attachment$/i,
  /^image attached to @/i,
  /^video preview/i,
];

function decodeYamlScalar(value: string): string {
  const trimmed = value.trim();
  if (!trimmed.startsWith('"') || !trimmed.endsWith('"')) {
    return trimmed;
  }
  return trimmed
    .slice(1, -1)
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\");
}

function parseGeneratedFrontmatter(markdown: string): FrontmatterParseResult {
  if (!markdown.startsWith("---\n")) {
    return { metadata: {}, body: markdown };
  }

  const end = markdown.indexOf("\n---\n", 4);
  if (end < 0) {
    return { metadata: {}, body: markdown };
  }

  const metadata: Record<string, string> = {};
  const frontmatter = markdown.slice(4, end).split("\n");
  for (const line of frontmatter) {
    const match = /^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/.exec(line);
    if (!match) continue;
    metadata[match[1]] = decodeYamlScalar(match[2]);
  }

  return {
    metadata,
    body: markdown.slice(end + "\n---\n".length),
  };
}

function isGenericMediaAlt(alt: string): boolean {
  const trimmed = alt.trim();
  if (!trimmed) return true;
  return GENERIC_MEDIA_ALT_PATTERNS.some((pattern) => pattern.test(trimmed));
}

function mediaLineToAgentText(line: string): string {
  return line.replace(
    /^(?:#{2,6}\s*)?!\[([^\]]*)\]\(([^)]*)\)\s*$/gm,
    (_match, rawAlt: string) => {
      const alt = rawAlt.replace(/\\]/g, "]").replace(/\\\\/g, "\\").trim();
      return isGenericMediaAlt(alt) ? "" : `Media: ${alt}`;
    },
  );
}

function removeRepeatedSourceLinks(markdown: string, source: string | undefined): string {
  if (!source) return markdown;
  const escapedSource = source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return markdown.replace(
    new RegExp(`^(?:#{2,6}\\s*)?\\[Watch on X\\]\\(${escapedSource}\\)\\s*$`, "gm"),
    "",
  );
}

function simplifySelfLinks(markdown: string): string {
  return markdown.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (match, label, url) => {
    return label === url ? url : match;
  });
}

function compactMetadata(metadata: Record<string, string>): string {
  const lines: string[] = [];
  if (metadata.source) {
    lines.push(`Source: ${metadata.source}`);
  }
  if (metadata.author) {
    lines.push(`Author: ${metadata.author}`);
  }
  return lines.join("\n");
}

function normalizeWhitespace(markdown: string): string {
  return markdown
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function optimizeMarkdownForAgent(markdown: string): string {
  const parsed = parseGeneratedFrontmatter(markdown);
  const metadata = compactMetadata(parsed.metadata);
  const body = normalizeWhitespace(
    simplifySelfLinks(
      removeRepeatedSourceLinks(
        mediaLineToAgentText(parsed.body),
        parsed.metadata.source,
      ),
    ),
  );
  const combined = [metadata, body].filter(Boolean).join("\n\n");
  return combined ? `${combined}\n` : "";
}
