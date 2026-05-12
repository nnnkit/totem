import { useState } from "react";
import { ExportIcon, XIcon } from "@phosphor-icons/react";
import { Modal } from "./ui/Modal";
import { Button } from "./ui/Button";
import {
  runQuickExport,
  type ExportAccountInfo,
  type QuickExportResult,
} from "../lib/export/quick-export";

interface Props {
  open: boolean;
  onClose: () => void;
  bookmarkCount: number;
  detailCount: number;
  account: ExportAccountInfo | null;
}

type ExportState =
  | { phase: "idle" }
  | { phase: "exporting" }
  | { phase: "done"; result: QuickExportResult }
  | { phase: "error"; message: string };

export function ExportModal({
  open,
  onClose,
  bookmarkCount,
  detailCount,
  account,
}: Props) {
  const [state, setState] = useState<ExportState>({ phase: "idle" });

  const handleClose = () => {
    if (state.phase === "exporting") return;
    setState({ phase: "idle" });
    onClose();
  };

  const handleStart = async () => {
    if (!account) return;
    setState({ phase: "exporting" });
    try {
      const result = await runQuickExport(account);
      setState({ phase: "done", result });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setState({ phase: "idle" });
        return;
      }
      setState({
        phase: "error",
        message:
          error instanceof Error ? error.message : "Export failed",
      });
    }
  };

  const countSummary = `${bookmarkCount.toLocaleString("en-US")} bookmark${bookmarkCount !== 1 ? "s" : ""}`;
  const detailSummary =
    detailCount > 0
      ? ` · ${detailCount.toLocaleString("en-US")} with full thread context`
      : "";

  return (
    <Modal
      open={open}
      onClose={handleClose}
      className="bg-black/50"
      ariaLabelledBy="export-title"
    >
      <div className="max-w-md mx-auto mt-[10vh] max-h-[80vh] flex flex-col rounded border border-border bg-surface-card shadow-xl">
        <div className="flex shrink-0 items-center justify-between px-6 pt-5 pb-3">
          <h2
            id="export-title"
            className="text-lg font-semibold text-foreground"
          >
            Export your library
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            disabled={state.phase === "exporting"}
            className="-mr-2"
            aria-label="Close"
            title="Close"
          >
            <XIcon className="size-5" />
          </Button>
        </div>

        <div className="px-6 pb-6">
          {state.phase === "done" ? (
            <DoneView result={state.result} onClose={handleClose} />
          ) : state.phase === "error" ? (
            <ErrorView
              message={state.message}
              onRetry={handleStart}
              onClose={handleClose}
            />
          ) : (
            <IdleView
              countSummary={countSummary}
              detailSummary={detailSummary}
              exporting={state.phase === "exporting"}
              canExport={bookmarkCount > 0 && account !== null}
              onStart={handleStart}
              onCancel={handleClose}
            />
          )}
        </div>
      </div>
    </Modal>
  );
}

function IdleView({
  countSummary,
  detailSummary,
  exporting,
  canExport,
  onStart,
  onCancel,
}: {
  countSummary: string;
  detailSummary: string;
  exporting: boolean;
  canExport: boolean;
  onStart: () => void;
  onCancel: () => void;
}) {
  return (
    <>
      <p className="text-sm text-muted mb-4">
        {countSummary}
        {detailSummary}
      </p>

      <div className="rounded border border-accent/30 bg-accent-surface/50 p-4 mb-5">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">
                Quick export
              </span>
              <span className="text-xxs font-medium text-accent bg-accent-surface rounded px-1.5 py-0.5">
                Recommended
              </span>
            </div>
            <p className="text-xs text-muted mt-1 leading-snug">
              {countSummary}. Ready in seconds.
            </p>
          </div>
        </div>
      </div>

      <p className="text-xxs text-muted/60 leading-snug mb-4">
        Exports CSV, Markdown, and JSONL in a single ZIP file. The ZIP can
        be re-imported into Totem on any Chrome install.
      </p>

      <div className="flex gap-2 justify-end">
        <Button variant="secondary" onClick={onCancel} disabled={exporting}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={onStart}
          disabled={!canExport || exporting}
        >
          <ExportIcon className="size-4" />
          {exporting ? "Exporting…" : "Start"}
        </Button>
      </div>
    </>
  );
}

function DoneView({
  result,
  onClose,
}: {
  result: QuickExportResult;
  onClose: () => void;
}) {
  return (
    <>
      <div className="flex items-center gap-2 mb-3">
        <div className="size-8 rounded-full bg-success/15 flex items-center justify-center">
          <span className="text-success text-lg">✓</span>
        </div>
        <span className="text-sm font-medium text-foreground">
          Export complete
        </span>
      </div>
      <p className="text-xs text-muted leading-snug mb-4">
        {result.bookmarkCount.toLocaleString("en-US")} bookmarks
        {result.detailCount > 0
          ? ` · ${result.detailCount.toLocaleString("en-US")} details`
          : ""}
        {result.highlightCount > 0
          ? ` · ${result.highlightCount.toLocaleString("en-US")} highlights`
          : ""}
        {result.readingProgressCount > 0
          ? ` · ${result.readingProgressCount.toLocaleString("en-US")} reading progress`
          : ""}
      </p>
      <div className="flex justify-end">
        <Button variant="primary" onClick={onClose}>
          Done
        </Button>
      </div>
    </>
  );
}

function ErrorView({
  message,
  onRetry,
  onClose,
}: {
  message: string;
  onRetry: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <p className="text-sm text-foreground mb-2">Export failed</p>
      <p className="text-xs text-muted leading-snug mb-4">{message}</p>
      <div className="flex gap-2 justify-end">
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
        <Button variant="primary" onClick={onRetry}>
          Retry
        </Button>
      </div>
    </>
  );
}
