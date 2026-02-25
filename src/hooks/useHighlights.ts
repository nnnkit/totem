import { useCallback, useEffect, useRef, useState } from "react";
import type { Highlight } from "../types";
import type { SelectionRange } from "../types";
import {
  upsertHighlight,
  deleteHighlight as dbDeleteHighlight,
  getHighlightsByTweetId,
} from "../db";

const DOM_MUTATION_OBSERVER_OPTIONS: MutationObserverInit = {
  childList: true,
  subtree: true,
  characterData: true,
};

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
  const marks = container.querySelectorAll("mark.totem-highlight");
  for (const mark of marks) {
    const parent = mark.parentNode;
    if (!parent) continue;
    while (mark.firstChild) {
      parent.insertBefore(mark.firstChild, mark);
    }
    parent.removeChild(mark);
  }

  container.normalize();
}

function wrapTextRange(
  section: Element,
  startOffset: number,
  endOffset: number,
  highlightId: string,
  flash: boolean,
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
    mark.className = flash ? "totem-highlight totem-highlight-new" : "totem-highlight";
    mark.dataset.highlightId = highlightId;
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

function findMatchingSection(container: Element, highlight: Highlight): Element | null {
  const selector = `#${CSS.escape(highlight.sectionId)}`;
  const sections = Array.from(container.querySelectorAll(selector));
  if (sections.length === 0) return null;

  if (sections.length === 1) {
    return sections[0];
  }

  for (const section of sections) {
    const text = section.textContent || "";
    const actualText = text.slice(highlight.startOffset, highlight.endOffset);
    if (actualText === highlight.selectedText) {
      return section;
    }
  }

  return sections[0];
}

export function useHighlights({ tweetId, contentReady, containerRef }: Props) {
  const highlightsRef = useRef<Map<string, Highlight>>(new Map());
  const [revision, setRevision] = useState(0);
  const flashIdsRef = useRef<Set<string>>(new Set());
  const pendingNoteIdRef = useRef<string | null>(null);
  const observerRef = useRef<MutationObserver | null>(null);
  const applyFrameRef = useRef(0);

  const applyHighlightsToDOM = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    stripHighlightMarks(container);

    const highlights = Array.from(highlightsRef.current.values()).sort((a, b) => {
      if (a.sectionId !== b.sectionId) return a.sectionId.localeCompare(b.sectionId);
      return a.startOffset - b.startOffset;
    });

    for (const h of highlights) {
      const section = findMatchingSection(container, h);
      if (!section) continue;

      const sectionText = section.textContent || "";
      const actualText = sectionText.slice(h.startOffset, h.endOffset);
      if (actualText !== h.selectedText) continue;

      const shouldFlash = flashIdsRef.current.has(h.id) && !h.note;
      const marks = wrapTextRange(section, h.startOffset, h.endOffset, h.id, shouldFlash);

      if (shouldFlash) {
        flashIdsRef.current.delete(h.id);
      }

      if (h.note && marks.length > 0) {
        for (const mark of marks) {
          (mark as HTMLElement).dataset.hasNote = "true";
        }
      }
    }
  }, [containerRef]);

  const stopObservingContainer = useCallback(() => {
    observerRef.current?.disconnect();
  }, []);

  const observeContainer = useCallback(() => {
    const observer = observerRef.current;
    const container = containerRef.current;
    if (!observer || !container) return;
    observer.observe(container, DOM_MUTATION_OBSERVER_OPTIONS);
  }, [containerRef]);

  const runApplyNow = useCallback(() => {
    stopObservingContainer();
    applyHighlightsToDOM();
    observeContainer();
  }, [applyHighlightsToDOM, observeContainer, stopObservingContainer]);

  const scheduleApply = useCallback(() => {
    if (applyFrameRef.current) return;
    applyFrameRef.current = requestAnimationFrame(() => {
      applyFrameRef.current = 0;
      runApplyNow();
    });
  }, [runApplyNow]);

  useEffect(() => {
    if (!contentReady) return;

    const container = containerRef.current;
    if (!container) return;

    const observer = new MutationObserver((mutations) => {
      if (highlightsRef.current.size === 0) return;

      const hasContentMutation = mutations.some((mutation) => {
        if (mutation.type === "characterData") return true;
        if (mutation.type !== "childList") return false;

        const changedNodes = [...mutation.addedNodes, ...mutation.removedNodes];
        return changedNodes.some((node) => {
          if (!(node instanceof Element)) {
            return true;
          }
          return !node.matches("mark.totem-highlight");
        });
      });

      if (hasContentMutation) {
        scheduleApply();
      }
    });

    observerRef.current = observer;
    observeContainer();

    return () => {
      stopObservingContainer();
      observerRef.current = null;
    };
  }, [
    contentReady,
    containerRef,
    observeContainer,
    scheduleApply,
    stopObservingContainer,
    tweetId,
  ]);

  useEffect(() => {
    if (!contentReady || !tweetId) return;

    let cancelled = false;
    let retryTimer = 0;
    flashIdsRef.current.clear();

    getHighlightsByTweetId(tweetId).then((stored) => {
      if (cancelled) return;
      highlightsRef.current.clear();
      for (const h of stored) {
        highlightsRef.current.set(h.id, h);
      }
      if (stored.length === 0) return;

      let attempts = 0;
      const tryApply = () => {
        if (cancelled) return;
        runApplyNow();
        const container = containerRef.current;
        if (
          container &&
          !container.querySelector("mark.totem-highlight") &&
          attempts < 10
        ) {
          attempts++;
          retryTimer = window.setTimeout(tryApply, 60);
        }
      };

      requestAnimationFrame(() => {
        if (!cancelled) tryApply();
      });
    });

    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
      if (applyFrameRef.current) {
        cancelAnimationFrame(applyFrameRef.current);
        applyFrameRef.current = 0;
      }
    };
  }, [tweetId, contentReady, runApplyNow, containerRef]);

  useEffect(() => {
    scheduleApply();
  }, [revision, scheduleApply]);

  useEffect(
    () => () => {
      stopObservingContainer();
      if (applyFrameRef.current) {
        cancelAnimationFrame(applyFrameRef.current);
        applyFrameRef.current = 0;
      }
    },
    [stopObservingContainer],
  );

  const addHighlight = useCallback(
    async (ranges: SelectionRange[], options?: { note?: string | null; type?: "highlight" | "note" }) => {
      const created: Highlight[] = [];
      const note = options?.note ?? null;
      const type = options?.type ?? "highlight";

      for (const range of ranges) {
        const highlight: Highlight = {
          id: crypto.randomUUID(),
          tweetId,
          sectionId: range.sectionId,
          startOffset: range.startOffset,
          endOffset: range.endOffset,
          selectedText: range.selectedText,
          note,
          color: "green",
          createdAt: Date.now(),
          type,
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
      highlightsRef.current.set(id, updated);
      await upsertHighlight(updated);
      setRevision((r) => r + 1);
    },
    [],
  );

  const getHighlight = useCallback((id: string) => {
    return highlightsRef.current.get(id) || null;
  }, []);

  const setPendingNoteId = useCallback((id: string | null) => {
    pendingNoteIdRef.current = id;
  }, []);

  return { addHighlight, removeHighlight, updateHighlightNote, getHighlight, applyNow: runApplyNow, setPendingNoteId };
}
