import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Highlight } from "../../types";
import { Button } from "../ui/Button";
import { PopoverContent, Popover } from "../ui/Popover";
import { Textarea } from "../ui/Textarea";

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
          <PopoverContent className="w-80">
          <div className="flex items-center justify-between px-4 pt-3">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted/50">
              Note
            </span>
            <button
              onClick={onClose}
              aria-label="Close notes panel"
              className="-mr-1 rounded-md p-1 text-muted/40 transition-colors hover:bg-surface-hover hover:text-foreground"
            >
              <svg width="12" height="12" viewBox="0 0 256 256" fill="currentColor">
                <path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z" />
              </svg>
            </button>
          </div>

          <div className="px-4 pb-3">
            {editing ? (
              <>
                <Textarea
                  ref={textareaRef}
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  onKeyDown={handleTextareaKeyDown}
                  placeholder="Write a note..."
                  rows={3}
                  className="mt-2"
                />
                <div className="mt-2.5 flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={handleCancel}>
                    Cancel
                  </Button>
                  <Button
                    variant="accent-soft"
                    size="sm"
                    onClick={handleSave}
                    disabled={!noteText.trim()}
                    className="font-medium"
                  >
                    Save
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-foreground text-pretty">
                  {highlight.note}
                </p>
                {highlight.createdAt && (
                  <p className="mt-1.5 text-[11px] tabular-nums text-muted/50">
                    {formatRelativeTime(highlight.createdAt)}
                  </p>
                )}
                <div className="mt-3 flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditing(true);
                      setNoteText(highlight.note || "");
                    }}
                  >
                    Edit
                  </Button>
                  {confirmingDelete ? (
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setConfirmingDelete(false)}>
                        Cancel
                      </Button>
                      <Button variant="destructive" size="sm" className="font-medium" onClick={handleDelete}>
                        Delete
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirmingDelete(true)}
                      className="text-red-400/80 hover:bg-red-500/10 hover:text-red-400"
                    >
                      Delete
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
        </PopoverContent>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
