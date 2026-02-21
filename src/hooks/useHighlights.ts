import { useCallback, useEffect, useRef, useState } from "react";
import type { Highlight, HighlightColor } from "../types";
import type { SelectionRange } from "../types";
import {
  upsertHighlight,
  deleteHighlight as dbDeleteHighlight,
  getHighlightsByTweetId,
} from "../db";
import { HIGHLIGHT_RETRY_MS } from "../lib/constants";

interface Props {
  tweetId: string;
  contentReady: boolean;
  containerRef: React.RefObject<HTMLElement | null>;
}

function getTextNodesInSection(section: Element): Text[] {
  const nodes: Text[] = [];
  const walker = document.createTreeWalker(section, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    nodes.push(walker.currentNode as Text);
  }
  return nodes;
}

function stripHighlightMarks(container: Element) {
  const marks = container.querySelectorAll("mark.xbt-highlight");
  for (const mark of marks) {
    const parent = mark.parentNode;
    if (!parent) continue;
    while (mark.firstChild) {
      parent.insertBefore(mark.firstChild, mark);
    }
    parent.removeChild(mark);
  }

  const stars = container.querySelectorAll(".xbt-note-star");
  for (const star of stars) {
    star.remove();
  }

  container.normalize();
}

function wrapTextRange(
  section: Element,
  startOffset: number,
  endOffset: number,
  highlightId: string,
  flash: boolean,
  color: string,
): Element[] {
  const textNodes = getTextNodesInSection(section);
  let charCount = 0;
  const wrappedMarks: Element[] = [];

  for (const textNode of textNodes) {
    const nodeLength = textNode.textContent?.length || 0;
    const nodeStart = charCount;
    const nodeEnd = charCount + nodeLength;

    if (nodeEnd <= startOffset || nodeStart >= endOffset) {
      charCount += nodeLength;
      continue;
    }

    const overlapStart = Math.max(startOffset, nodeStart) - nodeStart;
    const overlapEnd = Math.min(endOffset, nodeEnd) - nodeStart;

    if (overlapStart === overlapEnd) {
      charCount += nodeLength;
      continue;
    }

    const parent = textNode.parentNode;
    if (!parent) {
      charCount += nodeLength;
      continue;
    }

    const beforeText = textNode.textContent!.slice(0, overlapStart);
    const highlightText = textNode.textContent!.slice(overlapStart, overlapEnd);
    const afterText = textNode.textContent!.slice(overlapEnd);

    const mark = document.createElement("mark");
    mark.className = flash ? "xbt-highlight xbt-highlight-new" : "xbt-highlight";
    mark.dataset.highlightId = highlightId;
    mark.dataset.color = color;
    mark.textContent = highlightText;

    if (beforeText) {
      parent.insertBefore(document.createTextNode(beforeText), textNode);
    }
    parent.insertBefore(mark, textNode);
    if (afterText) {
      parent.insertBefore(document.createTextNode(afterText), textNode);
    }
    parent.removeChild(textNode);

    wrappedMarks.push(mark);
    charCount += nodeLength;
  }

  return wrappedMarks;
}

function injectNoteStar(
  section: Element,
  firstMark: Element,
  highlightId: string,
  note: string,
) {
  const star = document.createElement("span");
  star.className = "xbt-note-star";
  star.dataset.highlightId = highlightId;
  star.setAttribute("role", "button");
  star.setAttribute("aria-label", "View note");

  star.appendChild(document.createTextNode("\u2605"));

  const tooltip = document.createElement("span");
  tooltip.className = "xbt-note-tooltip";
  tooltip.textContent = note;
  star.appendChild(tooltip);

  const sectionRect = section.getBoundingClientRect();
  const markRect = firstMark.getBoundingClientRect();
  star.style.top = `${markRect.top - sectionRect.top + markRect.height / 2}px`;

  const article = section.closest("article") || section;
  star.addEventListener("mouseenter", () => {
    const marks = article.querySelectorAll(
      `mark.xbt-highlight[data-highlight-id="${highlightId}"]`,
    );
    marks.forEach((m) => m.classList.add("xbt-highlight-hover"));
  });
  star.addEventListener("mouseleave", () => {
    const marks = article.querySelectorAll(
      `mark.xbt-highlight[data-highlight-id="${highlightId}"]`,
    );
    marks.forEach((m) => m.classList.remove("xbt-highlight-hover"));
  });

  section.appendChild(star);
}

export function useHighlights({ tweetId, contentReady, containerRef }: Props) {
  const highlightsRef = useRef<Map<string, Highlight>>(new Map());
  const [revision, setRevision] = useState(0);
  const flashIdsRef = useRef<Set<string>>(new Set());

  const applyHighlightsToDOM = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    stripHighlightMarks(container);

    const highlights = Array.from(highlightsRef.current.values()).sort((a, b) => {
      if (a.sectionId !== b.sectionId) return a.sectionId.localeCompare(b.sectionId);
      return a.startOffset - b.startOffset;
    });

    for (const h of highlights) {
      const section = container.querySelector(`#${CSS.escape(h.sectionId)}`);
      if (!section) continue;

      const sectionText = section.textContent || "";
      const actualText = sectionText.slice(h.startOffset, h.endOffset);
      if (actualText !== h.selectedText) continue;

      const shouldFlash = flashIdsRef.current.has(h.id) && !h.note;
      const marks = wrapTextRange(section, h.startOffset, h.endOffset, h.id, shouldFlash, h.color || "green");

      if (shouldFlash) {
        flashIdsRef.current.delete(h.id);
      }

      if (h.note && marks.length > 0) {
        for (const mark of marks) {
          (mark as HTMLElement).dataset.hasNote = "true";
        }
        injectNoteStar(section, marks[0], h.id, h.note);
      }
    }
  }, [containerRef]);

  useEffect(() => {
    if (!contentReady || !tweetId) return;

    getHighlightsByTweetId(tweetId).then((stored) => {
      highlightsRef.current.clear();
      for (const h of stored) {
        highlightsRef.current.set(h.id, h);
      }
      requestAnimationFrame(() => {
        applyHighlightsToDOM();
        const container = containerRef.current;
        if (container && !container.querySelector("mark.xbt-highlight") && highlightsRef.current.size > 0) {
          setTimeout(() => applyHighlightsToDOM(), HIGHLIGHT_RETRY_MS);
        }
      });
    });
  }, [tweetId, contentReady, applyHighlightsToDOM]);

  useEffect(() => {
    if (revision > 0) {
      applyHighlightsToDOM();
    }
  }, [revision, applyHighlightsToDOM]);

  const addHighlight = useCallback(
    async (ranges: SelectionRange[], note: string | null = null, color: HighlightColor = "green") => {
      const created: Highlight[] = [];

      for (const range of ranges) {
        const highlight: Highlight = {
          id: crypto.randomUUID(),
          tweetId,
          sectionId: range.sectionId,
          startOffset: range.startOffset,
          endOffset: range.endOffset,
          selectedText: range.selectedText,
          note,
          color,
          createdAt: Date.now(),
        };

        await upsertHighlight(highlight);
        highlightsRef.current.set(highlight.id, highlight);
        flashIdsRef.current.add(highlight.id);
        created.push(highlight);
      }

      window.getSelection()?.removeAllRanges();
      setRevision((r) => r + 1);
      return created;
    },
    [tweetId],
  );

  const removeHighlight = useCallback(async (id: string) => {
    await dbDeleteHighlight(id);
    highlightsRef.current.delete(id);
    setRevision((r) => r + 1);
  }, []);

  const updateHighlightNote = useCallback(
    async (id: string, note: string | null) => {
      const existing = highlightsRef.current.get(id);
      if (!existing) return;

      const updated = { ...existing, note };
      await upsertHighlight(updated);
      highlightsRef.current.set(id, updated);
      setRevision((r) => r + 1);
    },
    [],
  );

  const getHighlight = useCallback((id: string) => {
    return highlightsRef.current.get(id) || null;
  }, []);

  return { addHighlight, removeHighlight, updateHighlightNote, getHighlight };
}
