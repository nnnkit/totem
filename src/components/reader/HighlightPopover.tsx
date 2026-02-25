import { useCallback, useEffect, useState } from "react";
import { Popover } from "@base-ui/react/popover";
import { XIcon, NotePencilIcon } from "@phosphor-icons/react";
import type { Highlight } from "../../types";

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
          <Popover.Popup
            className="totem-popover z-30 rounded-lg border border-x-border bg-x-card shadow-xl"
            onMouseDown={(e) => e.preventDefault()}
          >
            {confirmingRemove ? (
              <div className="flex items-center gap-2 px-3 py-2">
                <span className="text-xs text-x-text-secondary">Remove?</span>
                <button
                  onClick={() => setConfirmingRemove(false)}
                  className="rounded-md px-2.5 py-1 text-xs text-x-text-secondary transition-colors hover:bg-x-hover"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUnhighlight}
                  className="rounded-md bg-red-500/15 px-2.5 py-1 text-xs font-medium text-red-500 transition-colors hover:bg-red-500/25"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1 px-2 py-1.5">
                <button
                  onClick={() => setConfirmingRemove(true)}
                  className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-x-text-secondary transition-colors hover:bg-x-hover hover:text-x-text"
                >
                  <XIcon weight="bold" className="size-4" />
                  <span>Remove</span>
                </button>
                <div className="mx-0.5 h-5 w-px bg-x-border" />
                <button
                  onClick={() => {
                    onAddNote(highlight, state.anchorEl);
                    dismiss();
                  }}
                  className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-x-text-secondary transition-colors hover:bg-x-hover hover:text-x-text"
                >
                  <NotePencilIcon weight="bold" className="size-4" />
                  <span>Note</span>
                </button>
              </div>
            )}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
