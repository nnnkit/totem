import { useCallback, useEffect, useRef, useState } from "react";
import { HighlighterIcon, NotePencilIcon } from "@phosphor-icons/react";
import type { HighlightColor, SelectionRange } from "../../types";
import { HIGHLIGHT_COLORS, COLOR_VALUES } from "../../lib/constants";
import { LS_HIGHLIGHT_COLOR } from "../../lib/storage-keys";

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

  return Array.from(sectionMap.entries()).map(([sectionId, data]) => ({
    sectionId,
    startOffset: data.startOffset,
    endOffset: data.endOffset,
    selectedText: data.text,
  }));
}

// --- Color utilities ---

function getStoredColor(): HighlightColor {
  const stored = localStorage.getItem(LS_HIGHLIGHT_COLOR);
  if (stored && HIGHLIGHT_COLORS.includes(stored as HighlightColor)) return stored as HighlightColor;
  return "green";
}

// --- Component ---

interface ToolbarState {
  ranges: SelectionRange[];
  position: { x: number; y: number };
}

interface Props {
  containerRef: React.RefObject<HTMLElement | null>;
  onHighlight: (ranges: SelectionRange[], color: HighlightColor) => void;
  onAddNote: (ranges: SelectionRange[]) => void;
}

export function SelectionToolbar({ containerRef, onHighlight, onAddNote }: Props) {
  const [state, setState] = useState<ToolbarState | null>(null);
  const [activeColor, setActiveColor] = useState<HighlightColor>(getStoredColor);
  const toolbarRef = useRef<HTMLDivElement>(null);
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

        const rect = range.getBoundingClientRect();
        setState({
          ranges,
          position: {
            x: rect.left + rect.width / 2,
            y: rect.top,
          },
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

    const handleMouseDown = (e: MouseEvent) => {
      if (toolbarRef.current?.contains(e.target as Node)) return;
      dismiss();
    };

    const handleScroll = () => dismiss();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };

    document.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("scroll", handleScroll, { passive: true });
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("scroll", handleScroll);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [state, dismiss]);

  if (!state) return null;

  const handleHighlight = (color: HighlightColor) => {
    localStorage.setItem(LS_HIGHLIGHT_COLOR, color);
    onHighlight(state.ranges, color);
    dismiss();
  };

  const handleNote = () => {
    onAddNote(state.ranges);
    dismiss();
  };

  return (
    <div
      ref={toolbarRef}
      style={{
        position: "fixed",
        left: state.position.x,
        top: state.position.y - 8,
        transform: "translate(-50%, -100%)",
        zIndex: 30,
      }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="flex animate-toolbar-in items-center gap-1 rounded-lg bg-neutral-900/95 px-2 py-1.5 shadow-lg backdrop-blur-sm">
        <button
          onClick={() => handleHighlight(activeColor)}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-neutral-200 transition-colors hover:bg-neutral-700/60"
        >
          <HighlighterIcon weight="bold" className="size-4" />
          <span>Highlight</span>
        </button>

        <div className="mx-0.5 h-5 w-px bg-neutral-700" />

        <button
          onClick={handleNote}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-neutral-200 transition-colors hover:bg-neutral-700/60"
        >
          <NotePencilIcon weight="bold" className="size-4" />
          <span>Note</span>
        </button>

        <div className="mx-0.5 h-5 w-px bg-neutral-700" />

        <div className="flex items-center gap-1.5 px-1">
          {HIGHLIGHT_COLORS.map((color) => (
            <button
              key={color}
              aria-label={`Highlight ${color}`}
              onClick={() => {
                setActiveColor(color);
                localStorage.setItem(LS_HIGHLIGHT_COLOR, color);
                handleHighlight(color);
              }}
              className={`size-4 rounded-full transition-opacity hover:opacity-80 ${
                color === activeColor
                  ? "ring-2 ring-white ring-offset-1 ring-offset-neutral-900"
                  : ""
              }`}
              style={{ backgroundColor: COLOR_VALUES[color] }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
