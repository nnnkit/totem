import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Popover } from "@base-ui/react/popover";
import type { Highlight } from "../../types";

interface Props {
  highlight: Highlight;
  anchorEl: HTMLElement;
  onSaveNote: (note: string, highlightId: string) => void;
  onDeleteNote: (highlightId: string) => void;
  onClose: () => void;
}

function formatRelativeTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function NotePopover({ highlight, anchorEl, onSaveNote, onDeleteNote, onClose }: Props) {
  const [editing, setEditing] = useState(!highlight.note);
  const [noteText, setNoteText] = useState(highlight.note || "");

  const virtualAnchor = useMemo(() => ({
    getBoundingClientRect: () => {
      const marks = document.querySelectorAll(
        `mark[data-highlight-id="${highlight.id}"]`,
      );
      const lastMark = marks[marks.length - 1] as HTMLElement | undefined;
      return lastMark?.getBoundingClientRect() ?? anchorEl.getBoundingClientRect();
    },
  }), [highlight.id, anchorEl]);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!editing) return;
    const timer = setTimeout(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(noteText.length, noteText.length);
    }, 50);
    return () => clearTimeout(timer);
  }, [editing]);

  const handleSave = useCallback(() => {
    const trimmed = noteText.trim();
    if (!trimmed) return;
    onSaveNote(trimmed, highlight.id);
    onClose();
  }, [noteText, highlight.id, onSaveNote, onClose]);

  const handleCancel = useCallback(() => {
    if (highlight.note) {
      setEditing(false);
      setNoteText(highlight.note);
    } else {
      onClose();
    }
  }, [highlight.note, onClose]);

  const handleDelete = () => {
    onDeleteNote(highlight.id);
    onClose();
  };

  const handleTextareaKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
    if (e.key === "Escape") {
      e.stopPropagation();
      handleCancel();
    }
  };

  return (
    <Popover.Root open onOpenChange={(open) => { if (!open) onClose(); }}>
      <Popover.Portal>
        <Popover.Positioner
          anchor={virtualAnchor}
          side="bottom"
          sideOffset={8}
          positionMethod="fixed"
        >
        <Popover.Popup className="xbt-popover z-30 w-80 rounded-lg border border-x-border bg-x-card shadow-xl">
          <div className="flex items-center justify-between px-4 pt-3">
            <span className="text-[11px] font-medium uppercase tracking-wide text-x-text-secondary/50">
              Note
            </span>
            <button
              onClick={onClose}
              aria-label="Close notes panel"
              className="-mr-1 rounded-md p-1 text-x-text-secondary/40 transition-colors hover:bg-x-hover hover:text-x-text"
            >
              <svg width="12" height="12" viewBox="0 0 256 256" fill="currentColor">
                <path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z" />
              </svg>
            </button>
          </div>

          <div className="px-4 pb-3">
            {editing ? (
              <>
                <textarea
                  ref={textareaRef}
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  onKeyDown={handleTextareaKeyDown}
                  placeholder="Write a note..."
                  rows={3}
                  className="mt-2 w-full resize-none rounded-lg border border-x-border bg-transparent px-3 py-2 text-sm leading-relaxed text-x-text placeholder:text-x-text-secondary/40 focus:border-accent focus:outline-none"
                />
                <div className="mt-2.5 flex justify-end gap-2">
                  <button
                    onClick={handleCancel}
                    className="rounded-md px-3 py-1.5 text-xs text-x-text-secondary transition-colors hover:bg-x-hover"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={!noteText.trim()}
                    className="rounded-md bg-accent/15 px-3 py-1.5 text-xs font-medium text-accent transition-colors hover:bg-accent/25 disabled:opacity-40"
                  >
                    Save
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-x-text text-pretty">
                  {highlight.note}
                </p>
                {highlight.createdAt && (
                  <p className="mt-1.5 text-[11px] tabular-nums text-x-text-secondary/50">
                    {formatRelativeTime(highlight.createdAt)}
                  </p>
                )}
                <div className="mt-3 flex items-center justify-end gap-1">
                  <button
                    onClick={() => {
                      setEditing(true);
                      setNoteText(highlight.note || "");
                    }}
                    className="rounded-md px-2.5 py-1 text-xs text-x-text-secondary transition-colors hover:bg-x-hover hover:text-x-text"
                  >
                    Edit
                  </button>
                  {confirmingDelete ? (
                    <div className="flex gap-1">
                      <button
                        onClick={() => setConfirmingDelete(false)}
                        className="rounded-md px-2.5 py-1 text-xs text-x-text-secondary transition-colors hover:bg-x-hover"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleDelete}
                        className="rounded-md bg-red-500/15 px-2.5 py-1 text-xs font-medium text-red-500 transition-colors hover:bg-red-500/25"
                      >
                        Delete
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmingDelete(true)}
                      className="rounded-md px-2.5 py-1 text-xs text-red-400/80 transition-colors hover:bg-red-500/10 hover:text-red-400"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
