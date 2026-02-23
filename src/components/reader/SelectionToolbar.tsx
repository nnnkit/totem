import { useCallback, useEffect, useRef, useState } from "react";
import { Popover } from "@base-ui/react/popover";
import { HighlighterIcon, LightningIcon, NotePencilIcon } from "@phosphor-icons/react";
import type { SelectionRange } from "../../types";
import { buildGrokUrl } from "./utils";

// --- Selection detection utilities ---

function getTextOffsetInSection(section: Element, node: Node, offset: number): number {
  const walker = document.createTreeWalker(section, NodeFilter.SHOW_TEXT);
  let charCount = 0;

  while (walker.nextNode()) {
    if (walker.currentNode === node) return charCount + offset;
    charCount += (walker.currentNode.textContent?.length || 0);
  }

  return charCount + offset;
}

function findSectionForNode(node: Node): Element | null {
  let el: Node | null = node;
  while (el) {
    if (el instanceof Element && el.id?.startsWith("section-")) return el;
    el = el.parentNode;
  }
  return null;
}

function isWordChar(ch: string): boolean {
  return /\w/.test(ch) || ch.charCodeAt(0) > 127;
}

function snapToWordBoundaries(
  text: string,
  start: number,
  end: number,
): { start: number; end: number } {
  let s = start;
  while (s > 0 && isWordChar(text[s - 1])) s--;

  let e = end;
  while (e < text.length && isWordChar(text[e])) e++;

  return { start: s, end: e };
}

function isInsideHighlight(node: Node): boolean {
  let el: Node | null = node;
  while (el) {
    if (el instanceof Element && el.tagName === "MARK" && el.classList.contains("xbt-highlight")) return true;
    el = el.parentNode;
  }
  return false;
}

function serializeSelection(selection: Selection, container: HTMLElement): SelectionRange[] {
  if (selection.rangeCount === 0) return [];

  const range = selection.getRangeAt(0);
  if (!container.contains(range.commonAncestorContainer)) return [];

  const sectionMap = new Map<string, { startOffset: number; endOffset: number; text: string }>();
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);

  while (walker.nextNode()) {
    const textNode = walker.currentNode as Text;
    if (!range.intersectsNode(textNode)) continue;

    const section = findSectionForNode(textNode);
    if (!section) continue;

    const isStartNode = textNode === range.startContainer;
    const isEndNode = textNode === range.endContainer;
    const startInNode = isStartNode ? range.startOffset : 0;
    const endInNode = isEndNode ? range.endOffset : (textNode.textContent?.length || 0);

    if (startInNode === endInNode) continue;

    const sectionId = section.id;
    const startOffset = getTextOffsetInSection(section, textNode, startInNode);
    const endOffset = getTextOffsetInSection(section, textNode, endInNode);
    const text = (textNode.textContent || "").slice(startInNode, endInNode);

    const existing = sectionMap.get(sectionId);
    if (existing) {
      existing.startOffset = Math.min(existing.startOffset, startOffset);
      existing.endOffset = Math.max(existing.endOffset, endOffset);
      existing.text += text;
    } else {
      sectionMap.set(sectionId, { startOffset, endOffset, text });
    }
  }

  return Array.from(sectionMap.entries()).map(([sectionId, data]) => {
    const section = container.querySelector(`#${CSS.escape(sectionId)}`);
    const sectionText = section?.textContent || "";
    const snapped = snapToWordBoundaries(sectionText, data.startOffset, data.endOffset);

    return {
      sectionId,
      startOffset: snapped.start,
      endOffset: snapped.end,
      selectedText: sectionText.slice(snapped.start, snapped.end),
    };
  });
}

// --- Component ---

interface ToolbarState {
  ranges: SelectionRange[];
  anchorRect: DOMRect;
}

interface Props {
  containerRef: React.RefObject<HTMLElement | null>;
  tweetUrl: string;
  onHighlight: (ranges: SelectionRange[]) => void;
  onAddNote: (ranges: SelectionRange[]) => void;
}

export function SelectionToolbar({ containerRef, tweetUrl, onHighlight, onAddNote }: Props) {
  const [state, setState] = useState<ToolbarState | null>(null);
  const dismissTimeoutRef = useRef<number>(0);

  const dismiss = useCallback(() => setState(null), []);

  useEffect(() => {
    const handleMouseUp = () => {
      clearTimeout(dismissTimeoutRef.current);

      dismissTimeoutRef.current = window.setTimeout(() => {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed || !selection.toString().trim()) {
          setState(null);
          return;
        }

        if (isInsideHighlight(selection.anchorNode!)) {
          setState(null);
          return;
        }

        const container = containerRef.current;
        if (!container) return;

        const range = selection.getRangeAt(0);
        if (!container.contains(range.commonAncestorContainer)) {
          setState(null);
          return;
        }

        const ranges = serializeSelection(selection, container);
        if (ranges.length === 0) {
          setState(null);
          return;
        }

        setState({
          ranges,
          anchorRect: range.getBoundingClientRect(),
        });
      }, 10);
    };

    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mouseup", handleMouseUp);
      clearTimeout(dismissTimeoutRef.current);
    };
  }, [containerRef]);

  useEffect(() => {
    if (!state) return;
    const handleScroll = () => dismiss();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [state, dismiss]);

  const virtualAnchor = state
    ? { getBoundingClientRect: () => state.anchorRect }
    : undefined;

  const handleHighlight = () => {
    if (!state) return;
    onHighlight(state.ranges);
    dismiss();
  };

  const handleNote = () => {
    if (!state) return;
    onAddNote(state.ranges);
    dismiss();
  };

  const grokUrl = state
    ? buildGrokUrl(tweetUrl, state.ranges.map((r) => r.selectedText).join(" "))
    : "";

  return (
    <Popover.Root open={!!state} onOpenChange={(open) => { if (!open) dismiss(); }}>
      <Popover.Portal>
        <Popover.Positioner
          anchor={virtualAnchor}
          side="top"
          sideOffset={8}
          positionMethod="fixed"
        >
          <Popover.Popup
            className="xbt-popover z-30 rounded-lg border border-x-border bg-x-card shadow-xl"
            onMouseDown={(e) => e.preventDefault()}
          >
            <div className="flex items-center gap-1 px-2 py-1.5">
              <button
                onClick={handleHighlight}
                className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-x-text-secondary transition-colors hover:bg-x-hover hover:text-x-text"
              >
                <HighlighterIcon weight="bold" className="size-4" />
                <span>Highlight</span>
              </button>

              <div className="mx-0.5 h-5 w-px bg-x-border" />

              <button
                onClick={handleNote}
                className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-x-text-secondary transition-colors hover:bg-x-hover hover:text-x-text"
              >
                <NotePencilIcon weight="bold" className="size-4" />
                <span>Add Note</span>
              </button>

              <div className="mx-0.5 h-5 w-px bg-x-border" />

              <button
                onClick={() => {
                  window.open(grokUrl, "_blank", "noopener,noreferrer");
                  dismiss();
                }}
                className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-x-text-secondary transition-colors hover:bg-x-hover hover:text-x-text"
              >
                <LightningIcon weight="bold" className="size-4" />
                <span>Ask Grok</span>
              </button>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
