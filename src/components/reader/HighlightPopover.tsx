import { useCallback, useEffect, useState } from "react";
import { XIcon, NotePencilIcon } from "@phosphor-icons/react";
import type { Highlight } from "../../types";
import { Button } from "../ui/Button";
import { PopoverContent, Popover } from "../ui/Popover";
import { Separator } from "../ui/Separator";

interface PopoverState {
  highlight: Highlight;
  anchorEl: HTMLElement;
}

interface Props {
  containerRef: React.RefObject<HTMLElement | null>;
  getHighlight: (id: string) => Highlight | null;
  onDelete: (id: string) => void;
  onAddNote: (highlight: Highlight, anchorEl: HTMLElement) => void;
  onOpenNote: (highlight: Highlight, anchorEl: HTMLElement) => void;
}

export function HighlightPopover({
  containerRef,
  getHighlight,
  onDelete,
  onAddNote,
  onOpenNote,
}: Props) {
  const [state, setState] = useState<PopoverState | null>(null);
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  const dismiss = useCallback(() => {
    setState(null);
    setConfirmingRemove(false);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      const mark = target.closest("mark.totem-highlight") as HTMLElement | null;
      if (!mark) return;

      const highlightId = mark.dataset.highlightId;
      if (!highlightId) return;

      const highlight = getHighlight(highlightId);
      if (!highlight) return;

      if (highlight.note) {
        onOpenNote(highlight, mark);
        return;
      }

      setState({ highlight, anchorEl: mark });
    };

    container.addEventListener("click", handleClick);
    return () => container.removeEventListener("click", handleClick);
  }, [containerRef, getHighlight, onOpenNote]);

  if (!state) return null;

  const { highlight } = state;

  const handleUnhighlight = () => {
    onDelete(highlight.id);
    dismiss();
  };

  return (
    <Popover.Root open onOpenChange={(open) => { if (!open) dismiss(); }}>
      <Popover.Portal>
        <Popover.Positioner
          anchor={state.anchorEl}
          side="top"
          sideOffset={8}
          positionMethod="fixed"
        >
          <PopoverContent onMouseDown={(e) => e.preventDefault()}>
            {confirmingRemove ? (
              <div className="flex items-center gap-2 px-3 py-2">
                <span className="text-xs text-muted">Remove?</span>
                <Button variant="ghost" size="sm" onClick={() => setConfirmingRemove(false)}>
                  Cancel
                </Button>
                <Button variant="destructive" size="sm" className="font-medium" onClick={handleUnhighlight}>
                  Remove
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-1 px-2 py-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmingRemove(true)}
                  className="gap-1.5"
                >
                  <XIcon weight="bold" className="size-4" />
                  <span>Remove</span>
                </Button>
                <Separator orientation="vertical" />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    onAddNote(highlight, state.anchorEl);
                    dismiss();
                  }}
                  className="gap-1.5"
                >
                  <NotePencilIcon weight="bold" className="size-4" />
                  <span>Note</span>
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
