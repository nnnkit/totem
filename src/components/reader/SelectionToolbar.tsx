import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react";
import {
  CaretDownIcon,
  HighlighterIcon,
  LightningIcon,
  NotePencilIcon,
} from "@phosphor-icons/react";
import type { SelectionRange } from "../../types";
import { type HighlightColor } from "../../lib/highlight-colors";
import { buildGrokUrl } from "./utils";
import { Button } from "../ui/Button";
import { PopoverContent, Popover } from "../ui/Popover";
import { Separator } from "../ui/Separator";
import { ColorDot } from "./ColorDot";
import { HighlightColorPicker } from "./HighlightColorPicker";

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
  // Treat only letters as "word" chars for boundary snapping.
  // This avoids expanding across adjacent numeric metadata (e.g. thread dates like "2018").
  return /[A-Za-z]/.test(ch) || ch.charCodeAt(0) > 127;
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
    if (el instanceof Element && el.tagName === "MARK" && el.classList.contains("totem-highlight")) return true;
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

interface ToolbarState {
  ranges: SelectionRange[];
  anchorRect: DOMRect;
}

interface Props {
  containerRef: React.RefObject<HTMLElement | null>;
  tweetUrl: string;
  defaultColor: HighlightColor;
  onHighlight: (ranges: SelectionRange[], color: HighlightColor) => void;
  onDefaultColorChange: (color: HighlightColor) => void;
  onAddNote: (ranges: SelectionRange[]) => void;
}

export function SelectionToolbar({
  containerRef,
  tweetUrl,
  defaultColor,
  onHighlight,
  onDefaultColorChange,
  onAddNote,
}: Props) {
  const [state, setState] = useState<ToolbarState | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const dismissTimeoutRef = useRef<number>(0);

  const dismiss = useCallback(() => {
    setState(null);
    setPaletteOpen(false);
  }, []);
  const dismissEvent = useEffectEvent(dismiss);

  useEffect(() => {
    const handleMouseUp = () => {
      clearTimeout(dismissTimeoutRef.current);

      dismissTimeoutRef.current = window.setTimeout(() => {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed || !selection.toString().trim()) {
          dismissEvent();
          return;
        }

        if (isInsideHighlight(selection.anchorNode!)) {
          dismissEvent();
          return;
        }

        const container = containerRef.current;
        if (!container) return;

        const range = selection.getRangeAt(0);
        if (!container.contains(range.commonAncestorContainer)) {
          dismissEvent();
          return;
        }

        const ranges = serializeSelection(selection, container);
        if (ranges.length === 0) {
          dismissEvent();
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
    const handleScroll = () => dismissEvent();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [state]);

  const virtualAnchor = state
    ? { getBoundingClientRect: () => state.anchorRect }
    : undefined;

  const handleHighlight = () => {
    if (!state) return;
    onHighlight(state.ranges, defaultColor);
    dismiss();
  };

  const handleHighlightWithColor = (color: HighlightColor) => {
    if (!state) return;
    if (color !== defaultColor) onDefaultColorChange(color);
    onHighlight(state.ranges, color);
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
          <PopoverContent onMouseDown={(e) => e.preventDefault()}>
            <div className="flex items-center gap-1 px-2 py-1.5">
              <Button variant="ghost" size="sm" onClick={handleHighlight} className="gap-1.5">
                <HighlighterIcon weight="bold" className="size-4" />
                <span>Highlight</span>
                <ColorDot color={defaultColor} size="xs" />
              </Button>

              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setPaletteOpen((v) => !v)}
                aria-label="Choose highlight color"
                aria-expanded={paletteOpen}
                aria-haspopup="true"
              >
                <CaretDownIcon weight="bold" className="size-3" />
              </Button>

              <Separator orientation="vertical" />

              <Button variant="ghost" size="sm" onClick={handleNote} className="gap-1.5">
                <NotePencilIcon weight="bold" className="size-4" />
                <span>Add Note</span>
              </Button>

              <Separator orientation="vertical" />

              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  window.open(grokUrl, "_blank", "noopener,noreferrer");
                  dismiss();
                }}
                className="gap-1.5"
              >
                <LightningIcon weight="bold" className="size-4" />
                <span>Ask Grok</span>
              </Button>
            </div>
            {paletteOpen && (
              <div className="border-t border-border px-2 py-1.5">
                <HighlightColorPicker
                  value={defaultColor}
                  onChange={handleHighlightWithColor}
                  groupLabel="Highlight color"
                  optionLabel={(c) => `Highlight in ${c}`}
                />
              </div>
            )}
          </PopoverContent>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
