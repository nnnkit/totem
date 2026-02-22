import { useCallback, useEffect, useState } from "react";
import { Popover } from "@base-ui/react/popover";
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
  const [confirming, setConfirming] = useState(false);

  const dismiss = useCallback(() => {
    setState(null);
    setConfirming(false);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      const mark = target.closest("mark.xbt-highlight") as HTMLElement | null;
      const star = target.closest(".xbt-note-star") as HTMLElement | null;

      const el = star || mark;
      if (!el) return;

      const highlightId = el.dataset.highlightId;
      if (!highlightId) return;

      const highlight = getHighlight(highlightId);
      if (!highlight) return;

      if (star && highlight.note) {
        onOpenNote(highlight, el);
        return;
      }

      setState({ highlight, anchorEl: el });
      setConfirming(false);
    };

    container.addEventListener("click", handleClick);
    return () => container.removeEventListener("click", handleClick);
  }, [containerRef, getHighlight, onOpenNote]);

  if (!state) return null;

  const { highlight } = state;

  const handleUnhighlight = () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
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
            className="xbt-popover z-30 rounded-lg bg-neutral-900/95 shadow-xl backdrop-blur-sm"
            onMouseDown={(e) => e.preventDefault()}
          >
            <div className="px-3 py-2 text-xs text-neutral-400">
              You highlighted
            </div>

            <div className="h-px bg-neutral-700" />

            {confirming ? (
              <div className="flex items-center">
                <button
                  onClick={() => setConfirming(false)}
                  className="flex items-center gap-1.5 rounded-b-lg px-3 py-2 text-sm text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-neutral-200"
                >
                  Cancel
                </button>
                <div className="w-px self-stretch bg-neutral-700" />
                <button
                  onClick={handleUnhighlight}
                  className="flex items-center gap-1.5 rounded-br-lg px-3 py-2 text-sm text-red-400 transition-colors hover:bg-red-500/10"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div className="flex items-center">
                <button
                  onClick={handleUnhighlight}
                  className="flex items-center gap-1.5 rounded-bl-lg px-3 py-2 text-sm text-neutral-300 transition-colors hover:bg-neutral-800 hover:text-neutral-100"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                  Unhighlight
                </button>
                <div className="w-px self-stretch bg-neutral-700" />
                <button
                  onClick={() => {
                    onAddNote(highlight, state.anchorEl);
                    dismiss();
                  }}
                  className="flex items-center gap-1.5 rounded-br-lg px-3 py-2 text-sm text-neutral-300 transition-colors hover:bg-neutral-800 hover:text-neutral-100"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                  </svg>
                  Note
                  {highlight.note && (
                    <span className="text-amber-400">
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                      </svg>
                    </span>
                  )}
                </button>
              </div>
            )}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
