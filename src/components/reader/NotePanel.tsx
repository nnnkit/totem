import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Highlight } from "../../types";
import type { SelectionRange } from "../../types";
import { NOTE_PANEL_EXIT_MS } from "../../lib/constants";

interface Props {
  highlight: Highlight | null;
  ranges: SelectionRange[] | null;
  onSaveNote: (note: string, highlightId?: string, ranges?: SelectionRange[]) => void;
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

export function NotePanel({ highlight, ranges, onSaveNote, onDeleteNote, onClose }: Props) {
  const [editing, setEditing] = useState(!highlight?.note);
  const [noteText, setNoteText] = useState(highlight?.note || "");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [anchorTop, setAnchorTop] = useState(64);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    let top: number | null = null;

    if (highlight) {
      const mark = document.querySelector(
        `mark[data-highlight-id="${highlight.id}"]`,
      );
      if (mark) {
        top = mark.getBoundingClientRect().top;
      } else {
        const el = document.getElementById(highlight.sectionId);
        if (el) top = el.getBoundingClientRect().top;
      }
    } else if (ranges?.[0]) {
      const el = document.getElementById(ranges[0].sectionId);
      if (el) top = el.getBoundingClientRect().top;
    }

    if (top !== null) {
      setAnchorTop(Math.max(64, Math.min(top, window.innerHeight - 320)));
    }
  }, [highlight, ranges]);

  const handleClose = useCallback(() => {
    setExiting(true);
    setTimeout(onClose, NOTE_PANEL_EXIT_MS);
  }, [onClose]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleClose]);

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(noteText.length, noteText.length);
    }
  }, [editing]);

  const handleSave = () => {
    const trimmed = noteText.trim();
    if (!trimmed) return;
    if (highlight) {
      onSaveNote(trimmed, highlight.id);
    } else if (ranges) {
      onSaveNote(trimmed, undefined, ranges);
    }
    handleClose();
  };

  const handleCancel = () => {
    if (highlight?.note) {
      setEditing(false);
      setNoteText(highlight.note);
    } else {
      handleClose();
    }
  };

  const handleDelete = () => {
    if (!highlight) return;
    onDeleteNote(highlight.id);
    handleClose();
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
    <div
      ref={panelRef}
      style={{ top: anchorTop }}
      className={`fixed right-6 z-30 w-80 rounded-xl border border-x-border bg-x-card shadow-xl ${exiting ? "note-panel-exit" : "note-panel-enter"}`}
    >
      <div className="flex items-center justify-between border-b border-x-border px-4 py-3">
        <span className="text-xs font-medium uppercase text-x-text-secondary">
          Notes
        </span>
        <button
          onClick={handleClose}
          aria-label="Close notes panel"
          className="rounded-md p-1 text-x-text-secondary transition-colors hover:bg-x-hover hover:text-x-text"
        >
          <svg width="14" height="14" viewBox="0 0 256 256" fill="currentColor">
            <path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z" />
          </svg>
        </button>
      </div>

      <div className="p-4">
        {editing ? (
          <>
            <textarea
              ref={textareaRef}
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              onKeyDown={handleTextareaKeyDown}
              placeholder="Write a note..."
              rows={4}
              className="w-full resize-none rounded-lg border border-x-border bg-transparent px-3 py-2.5 text-sm text-x-text placeholder:text-x-text-secondary/50 focus:border-accent focus:outline-none"
            />
            <div className="mt-3 flex justify-end gap-2">
              <button
                onClick={handleCancel}
                className="rounded-lg px-3 py-1.5 text-xs text-x-text-secondary transition-colors hover:bg-x-hover"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!noteText.trim()}
                className="rounded-lg bg-accent/15 px-3 py-1.5 text-xs font-medium text-accent transition-colors hover:bg-accent/25 disabled:opacity-40"
              >
                Save
              </button>
            </div>
          </>
        ) : (
          <>
            {highlight?.createdAt && (
              <p className="mb-2 text-xs tabular-nums text-x-text-secondary">
                {formatRelativeTime(highlight.createdAt)}
              </p>
            )}
            <p className="whitespace-pre-wrap text-sm text-x-text text-pretty">
              {highlight?.note}
            </p>
            <div className="mt-4 flex justify-between">
              <button
                onClick={() => {
                  setEditing(true);
                  setNoteText(highlight?.note || "");
                }}
                className="rounded-lg px-3 py-1.5 text-xs text-x-text-secondary transition-colors hover:bg-x-hover hover:text-x-text"
              >
                Edit
              </button>
              {confirmingDelete ? (
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirmingDelete(false)}
                    className="rounded-lg px-3 py-1.5 text-xs text-x-text-secondary transition-colors hover:bg-x-hover"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    className="rounded-lg bg-red-500/15 px-3 py-1.5 text-xs font-medium text-red-500 transition-colors hover:bg-red-500/25"
                  >
                    Delete
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmingDelete(true)}
                  className="rounded-lg px-3 py-1.5 text-xs text-red-500 transition-colors hover:bg-red-500/10"
                >
                  Delete
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
