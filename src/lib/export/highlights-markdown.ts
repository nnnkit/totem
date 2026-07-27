import type { Highlight } from "../../types";

export interface HighlightCountSummary {
  highlights: number;
  notes: number;
}

export interface HighlightsDigestSource {
  title: string;
  sourceUrl: string;
  authorName?: string;
  authorHandle?: string;
  highlights: Highlight[];
}

// Obsidian block reference ids allow only [A-Za-z0-9-]. Highlight ids may be
// uuids/nanoids with other characters, so strip anything unsupported.
function blockRefId(id: string): string {
  const safe = id.replace(/[^A-Za-z0-9-]/g, "").slice(0, 40);
  return safe ? `h-${safe}` : "";
}

// Obsidian wikilink text cannot contain [ ] # ^ | — strip them so `[[name]]`
// stays parseable and the graph node label is clean.
export function sanitizeWikiLinkText(value: string): string {
  return value
    .replace(/[[\]#^|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function hasText(value: string | null | undefined): value is string {
  return Boolean(value && value.trim());
}

function isStandaloneNote(highlight: Highlight): boolean {
  return !hasText(highlight.selectedText) && (highlight.type === "note" || hasText(highlight.note));
}

// Group by section, then by position within the section, so highlights read in
// document order rather than the order they were created. sectionId is compared
// numerically when possible ("2" before "10") and lexically otherwise.
function compareHighlights(a: Highlight, b: Highlight): number {
  const section = a.sectionId.localeCompare(b.sectionId, undefined, {
    numeric: true,
    sensitivity: "base",
  });
  if (section !== 0) return section;
  if (a.startOffset !== b.startOffset) return a.startOffset - b.startOffset;
  return a.createdAt - b.createdAt;
}

function formatDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function blockquote(text: string): string {
  return text
    .trim()
    .split("\n")
    .map((line) => `> ${line}`.trimEnd())
    .join("\n");
}

export function countHighlightsAndNotes(
  highlights: Highlight[],
): HighlightCountSummary {
  let highlightCount = 0;
  let noteCount = 0;
  for (const highlight of highlights) {
    if (hasText(highlight.selectedText)) {
      highlightCount++;
      if (hasText(highlight.note)) noteCount++;
    } else if (isStandaloneNote(highlight)) {
      noteCount++;
    }
  }
  return { highlights: highlightCount, notes: noteCount };
}

function renderHighlight(highlight: Highlight): string {
  const parts: string[] = [];
  const ref = blockRefId(highlight.id);
  const meta = ref
    ? `> — ${formatDate(highlight.createdAt)} ^${ref}`
    : `> — ${formatDate(highlight.createdAt)}`;
  parts.push(`${blockquote(highlight.selectedText)}\n${meta}`);
  if (hasText(highlight.note)) {
    parts.push(`**Note:** ${highlight.note.trim()}`);
  }
  return parts.join("\n\n");
}

function renderStandaloneNote(highlight: Highlight): string {
  const ref = blockRefId(highlight.id);
  const text = (highlight.note ?? highlight.selectedText ?? "").trim();
  const line = text.replace(/\n+/g, " ");
  return ref ? `- ${line} ^${ref}` : `- ${line}`;
}

/**
 * Renders a bookmark's highlights and notes as an Obsidian-friendly Markdown
 * block: a `## Highlights` section of blockquotes (each with an optional
 * `**Note:**` and a `^h-<id>` block reference) followed by a `## Notes` section
 * for standalone notes. Returns "" when there is nothing to render so callers
 * can append unconditionally.
 */
export function buildHighlightsSection(highlights: Highlight[]): string {
  if (highlights.length === 0) return "";

  const sorted = [...highlights].sort(compareHighlights);
  const passages = sorted.filter((h) => hasText(h.selectedText));
  const notes = sorted.filter(isStandaloneNote);

  const sections: string[] = [];
  if (passages.length > 0) {
    sections.push(
      ["## Highlights", ...passages.map(renderHighlight)].join("\n\n"),
    );
  }
  if (notes.length > 0) {
    sections.push(["## Notes", notes.map(renderStandaloneNote).join("\n")].join("\n\n"));
  }
  return sections.join("\n\n");
}

function digestAuthorLabel(source: HighlightsDigestSource): string {
  const name = source.authorName?.trim();
  const handle = source.authorHandle?.replace(/^@/, "").trim();
  if (name && handle) return `${name} (@${handle})`;
  if (name) return name;
  return handle ? `@${handle}` : "";
}

/**
 * Builds a single `highlights.md` digest grouping every highlight and note
 * under its source, newest source first. Sources with no renderable highlights
 * are skipped.
 */
export function buildHighlightsDigest(
  sources: HighlightsDigestSource[],
  generatedDate: string,
): string {
  const blocks: string[] = [`# Highlights & notes`, `Exported ${generatedDate} from Totem.`];

  let rendered = 0;
  for (const source of sources) {
    const section = buildHighlightsSection(source.highlights);
    if (!section) continue;
    rendered++;
    const author = digestAuthorLabel(source);
    const heading = `## ${source.title || "Untitled"}`;
    const byline = author ? `by ${author} · ` : "";
    const link = `${byline}[Open on X](${source.sourceUrl})`;
    // Demote the per-source section headings (## -> ###) so the digest keeps a
    // single top-level title.
    const demoted = section.replace(/^## /gm, "### ");
    blocks.push([heading, link, demoted].join("\n\n"));
  }

  if (rendered === 0) {
    blocks.push("No highlights or notes yet.");
  }

  return blocks.join("\n\n") + "\n";
}
