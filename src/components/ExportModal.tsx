import { useState, useCallback } from "react";
import { ExportIcon, XIcon } from "@phosphor-icons/react";
import { Modal } from "./ui/Modal";
import { Button } from "./ui/Button";
import {
  runQuickExport,
  type ExportAccountInfo,
  type QuickExportResult,
} from "../lib/export/quick-export";
import {
  useHydrationStore,
  type HydrationStatus,
} from "../stores/hydration-store";
import { getHydrationStore } from "../stores/hydration-store";

interface Props {
  open: boolean;
  onClose: () => void;
  bookmarkCount: number;
  detailCount: number;
  account: ExportAccountInfo | null;
  onLogin?: () => void;
}

type ExportMode = "quick" | "full";

type QuickExportState =
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
  onLogin,
}: Props) {
  const [quickState, setQuickState] = useState<QuickExportState>({ phase: "idle" });
  const [mode, setMode] = useState<ExportMode>("quick");

  const hydrationStatus = useHydrationStore((s) => s.status);
  const hydrationTotal = useHydrationStore((s) => s.total);
  const hydrationProcessed = useHydrationStore((s) => s.processed);
  const hydrationUnavailable = useHydrationStore((s) => s.unavailable);
  const hydrationPauseUntil = useHydrationStore((s) => s.pauseUntil);
  const hydrationStartedAt = useHydrationStore((s) => s.startedAt);

  const hydrationCoverage = bookmarkCount > 0 ? detailCount / bookmarkCount : 1;
  const quickRecommended = hydrationCoverage >= 0.9;

  const handleClose = () => {
    if (quickState.phase === "exporting") return;
    setQuickState({ phase: "idle" });
    onClose();
  };

  const handleQuickExport = useCallback(async () => {
    if (!account) return;
    setQuickState({ phase: "exporting" });
    try {
      const result = await runQuickExport(account);
      setQuickState({ phase: "done", result });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setQuickState({ phase: "idle" });
        return;
      }
      setQuickState({
        phase: "error",
        message: error instanceof Error ? error.message : "Export failed",
      });
    }
  }, [account]);

  const handleStartFullExport = useCallback(() => {
    getHydrationStore().getState().start();
  }, []);

  const handleCancelFullExport = useCallback(() => {
    getHydrationStore().getState().stop();
  }, []);

  const handleResetFullExport = useCallback(() => {
    getHydrationStore().getState().reset();
  }, []);

  const handleStart = () => {
    if (mode === "quick") {
      handleQuickExport();
    } else {
      handleStartFullExport();
    }
  };

  const countSummary = `${bookmarkCount.toLocaleString("en-US")} bookmark${bookmarkCount !== 1 ? "s" : ""}`;
  const detailSummary =
    detailCount > 0
      ? `${detailCount.toLocaleString("en-US")} with full thread context`
      : "";

  const isFullExportActive = hydrationStatus !== "idle" && hydrationStatus !== "done";
  const isFullExportDone = hydrationStatus === "done";

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
            disabled={quickState.phase === "exporting"}
            className="-mr-2"
            aria-label="Close"
            title="Close"
          >
            <XIcon className="size-5" />
          </Button>
        </div>

        <div className="px-6 pb-6">
          {quickState.phase === "done" ? (
            <DoneView result={quickState.result} onClose={handleClose} />
          ) : quickState.phase === "error" ? (
            <ErrorView
              message={quickState.message}
              onRetry={handleQuickExport}
              onClose={handleClose}
            />
          ) : isFullExportActive ? (
            <FullExportRunningView
              status={hydrationStatus}
              total={hydrationTotal}
              processed={hydrationProcessed}
              unavailable={hydrationUnavailable}
              pauseUntil={hydrationPauseUntil}
              startedAt={hydrationStartedAt}
              account={account}
              onCancel={handleCancelFullExport}
              onReset={handleResetFullExport}
              onDownloadNow={handleQuickExport}
              onLogin={onLogin}
              quickExporting={quickState.phase === "exporting"}
            />
          ) : isFullExportDone ? (
            <FullExportReadyView
              bookmarkCount={bookmarkCount}
              detailCount={detailCount}
              unavailable={hydrationUnavailable}
              onDownload={handleQuickExport}
              onClose={handleClose}
              downloading={quickState.phase === "exporting"}
            />
          ) : (
            <IdleView
              countSummary={countSummary}
              detailSummary={detailSummary}
              bookmarkCount={bookmarkCount}
              detailCount={detailCount}
              mode={mode}
              onModeChange={setMode}
              quickRecommended={quickRecommended}
              exporting={quickState.phase === "exporting"}
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
  bookmarkCount,
  detailCount,
  mode,
  onModeChange,
  quickRecommended,
  exporting,
  canExport,
  onStart,
  onCancel,
}: {
  countSummary: string;
  detailSummary: string;
  bookmarkCount: number;
  detailCount: number;
  mode: ExportMode;
  onModeChange: (mode: ExportMode) => void;
  quickRecommended: boolean;
  exporting: boolean;
  canExport: boolean;
  onStart: () => void;
  onCancel: () => void;
}) {
  const needingHydration = bookmarkCount - detailCount;
  const estimateMinutes = Math.max(1, Math.ceil(needingHydration * 3 / 60));

  return (
    <>
      <p className="text-sm text-muted mb-4">
        {countSummary}
        {detailSummary && <> &middot; {detailSummary}</>}
      </p>

      <div className="space-y-2 mb-5">
        <label
          className={`flex cursor-pointer rounded border p-4 transition-colors ${
            mode === "quick"
              ? "border-accent/30 bg-accent-surface/50"
              : "border-border bg-surface hover:bg-surface-hover"
          }`}
        >
          <input
            type="radio"
            name="export-mode"
            value="quick"
            checked={mode === "quick"}
            onChange={() => onModeChange("quick")}
            className="sr-only"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">
                Quick export
              </span>
              {quickRecommended && (
                <span className="text-xxs font-medium text-accent bg-accent-surface rounded px-1.5 py-0.5">
                  Recommended
                </span>
              )}
            </div>
            <p className="text-xs text-muted mt-1 leading-snug">
              {countSummary}{detailSummary && `, ${detailSummary}`}.
              Ready in seconds.
            </p>
          </div>
          <div className="flex items-center ml-3">
            <div className={`size-4 rounded-full border-2 flex items-center justify-center ${
              mode === "quick" ? "border-accent" : "border-muted/40"
            }`}>
              {mode === "quick" && <div className="size-2 rounded-full bg-accent" />}
            </div>
          </div>
        </label>

        <label
          className={`flex cursor-pointer rounded border p-4 transition-colors ${
            mode === "full"
              ? "border-accent/30 bg-accent-surface/50"
              : "border-border bg-surface hover:bg-surface-hover"
          }`}
        >
          <input
            type="radio"
            name="export-mode"
            value="full"
            checked={mode === "full"}
            onChange={() => onModeChange("full")}
            className="sr-only"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">
                Full export
              </span>
              {!quickRecommended && (
                <span className="text-xxs font-medium text-accent bg-accent-surface rounded px-1.5 py-0.5">
                  Recommended
                </span>
              )}
            </div>
            <p className="text-xs text-muted mt-1 leading-snug">
              Fetch context for the remaining {needingHydration.toLocaleString("en-US")} bookmarks first.
              {needingHydration > 0 && <> Takes about {estimateMinutes} minutes.</>}
            </p>
          </div>
          <div className="flex items-center ml-3">
            <div className={`size-4 rounded-full border-2 flex items-center justify-center ${
              mode === "full" ? "border-accent" : "border-muted/40"
            }`}>
              {mode === "full" && <div className="size-2 rounded-full bg-accent" />}
            </div>
          </div>
        </label>
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

function formatDurationCompact(ms: number): string {
  const totalMinutes = Math.ceil(ms / 60_000);
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

function formatElapsed(startedAt: number): string {
  const elapsed = Date.now() - startedAt;
  if (elapsed < 0) return "";
  return `Started ${formatDurationCompact(elapsed)} ago`;
}

function FullExportRunningView({
  status,
  total,
  processed,
  unavailable,
  pauseUntil,
  startedAt,
  account,
  onCancel,
  onReset,
  onDownloadNow,
  onLogin,
  quickExporting,
}: {
  status: HydrationStatus;
  total: number;
  processed: number;
  unavailable: number;
  pauseUntil: number;
  startedAt: number;
  account: ExportAccountInfo | null;
  onCancel: () => void;
  onReset: () => void;
  onDownloadNow: () => void;
  onLogin?: () => void;
  quickExporting: boolean;
}) {
  const progressDone = processed;
  const progressTotal = total + processed;
  const pct = progressTotal > 0 ? Math.round((progressDone / progressTotal) * 100) : 0;

  if (status === "paused-auth") {
    return (
      <>
        <p className="text-sm text-foreground mb-2">
          Full export paused
        </p>
        <p className="text-xs text-muted leading-snug mb-4">
          Sign in to X again to continue fetching thread context.
        </p>
        <ProgressBar pct={pct} />
        <p className="text-xs text-muted mt-2 mb-4">
          {progressDone.toLocaleString("en-US")} of {progressTotal.toLocaleString("en-US")}
          {" "}{pct}%
        </p>
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" onClick={onLogin}>
            Sign in &rarr;
          </Button>
        </div>
      </>
    );
  }

  if (status === "paused-storage") {
    return (
      <>
        <p className="text-sm text-foreground mb-2">
          Full export paused
        </p>
        <p className="text-xs text-muted leading-snug mb-4">
          Out of storage. Free up space to continue.
        </p>
        <ProgressBar pct={pct} />
        <p className="text-xs text-muted mt-2 mb-4">
          {progressDone.toLocaleString("en-US")} of {progressTotal.toLocaleString("en-US")}
          {" "}{pct}%
        </p>
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={onDownloadNow}
            disabled={quickExporting || !account}
          >
            {quickExporting ? "Downloading…" : "Download what’s ready now →"}
          </Button>
        </div>
      </>
    );
  }

  const resumeMs = pauseUntil > Date.now() ? pauseUntil - Date.now() : 0;

  return (
    <>
      <p className="text-sm font-medium text-foreground mb-3">
        Preparing full export
      </p>

      <p className="text-sm tabular-nums text-foreground mb-2">
        {progressDone.toLocaleString("en-US")} of {progressTotal.toLocaleString("en-US")}
        {" "}{pct}%
      </p>
      <ProgressBar pct={pct} />

      <div className="mt-3 space-y-1 mb-4">
        {status === "paused-429" && resumeMs > 0 && (
          <p className="text-xs text-muted">
            Resumes in {formatDurationCompact(resumeMs)} (X rate limit)
          </p>
        )}
        {startedAt > 0 && (
          <p className="text-xs text-muted">{formatElapsed(startedAt)}</p>
        )}
        {unavailable > 0 && (
          <p className="text-xs text-muted">
            {unavailable.toLocaleString("en-US")} unavailable (deleted or protected)
          </p>
        )}
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onReset}
          className="text-xxs text-muted/60 underline hover:text-muted"
        >
          Clear progress and start over
        </button>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={onDownloadNow}
            disabled={quickExporting || !account}
          >
            {quickExporting ? "Downloading…" : "Download what’s ready now →"}
          </Button>
        </div>
      </div>
    </>
  );
}

function FullExportReadyView({
  bookmarkCount,
  detailCount,
  unavailable,
  onDownload,
  onClose,
  downloading,
}: {
  bookmarkCount: number;
  detailCount: number;
  unavailable: number;
  onDownload: () => void;
  onClose: () => void;
  downloading: boolean;
}) {
  return (
    <>
      <div className="flex items-center gap-2 mb-3">
        <div className="size-8 rounded-full bg-success/15 flex items-center justify-center">
          <span className="text-success text-lg">&#10003;</span>
        </div>
        <span className="text-sm font-medium text-foreground">
          Full export ready
        </span>
      </div>
      <p className="text-xs text-muted leading-snug mb-1">
        {bookmarkCount.toLocaleString("en-US")} bookmarks &middot;{" "}
        {detailCount.toLocaleString("en-US")} with full thread context
      </p>
      {unavailable > 0 && (
        <p className="text-xs text-muted/60 leading-snug mb-4">
          {unavailable.toLocaleString("en-US")} unavailable (deleted or protected)
        </p>
      )}
      {unavailable === 0 && <div className="mb-4" />}
      <div className="flex gap-2 justify-end">
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
        <Button variant="primary" onClick={onDownload} disabled={downloading}>
          <ExportIcon className="size-4" />
          {downloading ? "Downloading…" : "Download ZIP →"}
        </Button>
      </div>
    </>
  );
}

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-border/50 overflow-hidden">
      <div
        className="h-full rounded-full bg-accent transition-[width] duration-300 ease-out"
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </div>
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
          <span className="text-success text-lg">&#10003;</span>
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
