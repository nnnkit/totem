import { useState, useCallback, useEffect } from "react";
import { ExportIcon } from "@phosphor-icons/react";
import { Modal } from "./ui/Modal";
import { Button } from "./ui/Button";
import {
  runQuickExport,
  runHighlightsExport,
  type ExportAccountInfo,
  type QuickExportResult,
  type HighlightsExportResult,
} from "../lib/export/quick-export";
import { getAllHighlights } from "../db";
import {
  estimateHydrationDurationMs,
  useHydrationStore,
  type HydrationStatus,
} from "../stores/hydration-store";
import { getHydrationStore } from "../stores/hydration-store";
import { getHydrationProgress } from "../lib/hydration/progress";
import { isFullExportReadyForCurrentLibrary } from "../lib/export/full-export-ready-dismissal";

interface Props {
  open: boolean;
  onClose: () => void;
  bookmarkCount: number;
  detailCount: number;
  account: ExportAccountInfo | null;
  onLogin?: () => void;
}

type ExportMode = "quick" | "full" | "highlights";

type QuickExportState =
  | { phase: "idle" }
  | { phase: "exporting" }
  | { phase: "done"; result: QuickExportResult }
  | { phase: "highlights-done"; result: HighlightsExportResult }
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
  const [annotatedCount, setAnnotatedCount] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      try {
        const highlights = await getAllHighlights();
        if (cancelled) return;
        const tweetIds = new Set(highlights.map((h) => h.tweetId));
        setAnnotatedCount(tweetIds.size);
      } catch {
        if (!cancelled) setAnnotatedCount(0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const hydrationStatus = useHydrationStore((s) => s.status);
  const hydrationTotal = useHydrationStore((s) => s.total);
  const hydrationProcessed = useHydrationStore((s) => s.processed);
  const hydrationUnavailable = useHydrationStore((s) => s.unavailable);
  const hydrationPauseUntil = useHydrationStore((s) => s.pauseUntil);
  const hydrationStartedAt = useHydrationStore((s) => s.startedAt);

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

  const handleHighlightsExport = useCallback(async () => {
    if (!account) return;
    setQuickState({ phase: "exporting" });
    try {
      const result = await runHighlightsExport(account);
      setQuickState({ phase: "highlights-done", result });
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

  const handleStart = () => {
    if (mode === "quick") {
      handleQuickExport();
    } else if (mode === "highlights") {
      handleHighlightsExport();
    } else {
      handleStartFullExport();
    }
  };

  const countSummary = formatBookmarkCount(bookmarkCount);
  const detailSummary =
    detailCount > 0
      ? `${detailCount.toLocaleString("en-US")} with full content`
      : "";

  const isFullExportActive = hydrationStatus !== "idle" && hydrationStatus !== "done";
  const isFullExportDone =
    hydrationStatus === "done" &&
    isFullExportReadyForCurrentLibrary({
      bookmarkCount,
      readyCount: detailCount,
    });
  const estimatedHydrationTotal = Math.max(0, bookmarkCount - detailCount);

  return (
    <Modal
      open={open}
      onClose={handleClose}
      className="bg-black/50"
      title="Export your library"
      titleId="export-title"
      closeDisabled={quickState.phase === "exporting"}
    >
      {quickState.phase === "done" ? (
        <DoneView result={quickState.result} onClose={handleClose} />
      ) : quickState.phase === "highlights-done" ? (
        <HighlightsDoneView result={quickState.result} onClose={handleClose} />
      ) : quickState.phase === "error" ? (
        <ErrorView
          message={quickState.message}
          onRetry={handleStart}
          onClose={handleClose}
        />
      ) : isFullExportActive ? (
        <FullExportRunningView
          status={hydrationStatus}
          total={hydrationTotal}
          processed={hydrationProcessed}
          readyCount={detailCount}
          bookmarkCount={bookmarkCount}
          unavailable={hydrationUnavailable}
          estimatedTotal={estimatedHydrationTotal}
          pauseUntil={hydrationPauseUntil}
          startedAt={hydrationStartedAt}
          account={account}
          onHide={handleClose}
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
          annotatedCount={annotatedCount}
          mode={mode}
          onModeChange={setMode}
          exporting={quickState.phase === "exporting"}
          canExport={
            (mode === "highlights"
              ? (annotatedCount ?? 0) > 0
              : bookmarkCount > 0) && account !== null
          }
          onStart={handleStart}
          onCancel={handleClose}
        />
      )}
    </Modal>
  );
}

function IdleView({
  countSummary,
  detailSummary,
  bookmarkCount,
  detailCount,
  annotatedCount,
  mode,
  onModeChange,
  exporting,
  canExport,
  onStart,
  onCancel,
}: {
  countSummary: string;
  detailSummary: string;
  bookmarkCount: number;
  detailCount: number;
  annotatedCount: number | null;
  mode: ExportMode;
  onModeChange: (mode: ExportMode) => void;
  exporting: boolean;
  canExport: boolean;
  onStart: () => void;
  onCancel: () => void;
}) {
  const needingHydration = Math.max(0, bookmarkCount - detailCount);
  const estimateMs = estimateHydrationDurationMs(needingHydration);
  const primaryLabel =
    mode === "quick"
      ? "Download ZIP"
      : mode === "highlights"
        ? "Download highlights"
        : "Start full export";

  return (
    <>
      <p className="text-sm text-muted mb-4">
        {countSummary}
        {detailSummary && <> &middot; {detailSummary}</>}
      </p>

      <div className="space-y-2 mb-5">
        <label
          htmlFor="export-mode-quick"
          aria-label={needingHydration > 0 ? "Basic export" : "Quick export"}
          className={`flex cursor-pointer rounded border p-4 transition-colors ${
            mode === "quick"
              ? "border-accent/30 bg-accent-surface/50"
              : "border-border bg-surface hover:bg-surface-hover"
          }`}
        >
          <input
            type="radio"
            id="export-mode-quick"
            name="export-mode"
            value="quick"
            checked={mode === "quick"}
            onChange={() => onModeChange("quick")}
            className="sr-only"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">
                {needingHydration > 0 ? "Basic export" : "Quick export"}
              </span>
            </div>
            <p className="text-xs text-muted mt-1 leading-snug">
              {needingHydration > 0 ? (
                <>
                  All {countSummary} include tweet summaries.{" "}
                  {detailCount.toLocaleString("en-US")} also include full content.
                </>
              ) : (
                <>Every bookmark already includes full content.</>
              )}
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
          htmlFor="export-mode-full"
          aria-label="Full export"
          className={`flex cursor-pointer rounded border p-4 transition-colors ${
            mode === "full"
              ? "border-accent/30 bg-accent-surface/50"
              : "border-border bg-surface hover:bg-surface-hover"
          }`}
        >
          <input
            type="radio"
            id="export-mode-full"
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
            </div>
            <p className="text-xs text-muted mt-1 leading-snug">
              {needingHydration > 0 ? (
                <>
                  {needingHydration.toLocaleString("en-US")} more bookmarks get full
                  content: tweets, threads, and articles where available. About{" "}
                  {formatDurationCompact(estimateMs)}.
                </>
              ) : (
                <>Full content is already ready for every bookmark.</>
              )}
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

        <label
          htmlFor="export-mode-highlights"
          aria-label="Highlights and notes export"
          className={`flex rounded border p-4 transition-colors ${
            (annotatedCount ?? 0) === 0
              ? "cursor-not-allowed border-border bg-surface opacity-60"
              : mode === "highlights"
                ? "cursor-pointer border-accent/30 bg-accent-surface/50"
                : "cursor-pointer border-border bg-surface hover:bg-surface-hover"
          }`}
        >
          <input
            type="radio"
            id="export-mode-highlights"
            name="export-mode"
            value="highlights"
            checked={mode === "highlights"}
            disabled={(annotatedCount ?? 0) === 0}
            onChange={() => onModeChange("highlights")}
            className="sr-only"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">
                Highlights &amp; notes
              </span>
            </div>
            <p className="text-xs text-muted mt-1 leading-snug">
              {annotatedCount === null ? (
                <>Checking your highlights…</>
              ) : annotatedCount === 0 ? (
                <>No highlights or notes yet. Highlight while reading to use this.</>
              ) : (
                <>
                  Just the {annotatedCount.toLocaleString("en-US")} bookmark
                  {annotatedCount === 1 ? "" : "s"} you highlighted — Obsidian-ready
                  Markdown plus a CSV.
                </>
              )}
            </p>
          </div>
          <div className="flex items-center ml-3">
            <div className={`size-4 rounded-full border-2 flex items-center justify-center ${
              mode === "highlights" ? "border-accent" : "border-muted/40"
            }`}>
              {mode === "highlights" && <div className="size-2 rounded-full bg-accent" />}
            </div>
          </div>
        </label>
      </div>

      <p className="text-xxs text-muted/60 leading-snug mb-4">
        ZIP exports can be imported back into Totem and include CSV and Markdown.
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
          {mode !== "full" && <ExportIcon className="size-4" />}
          {exporting ? "Exporting…" : primaryLabel}
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

function formatBookmarkCount(count: number): string {
  return `${count.toLocaleString("en-US")} bookmark${count !== 1 ? "s" : ""}`;
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
  readyCount,
  bookmarkCount,
  unavailable,
  estimatedTotal,
  pauseUntil,
  startedAt,
  account,
  onHide,
  onDownloadNow,
  onLogin,
  quickExporting,
}: {
  status: HydrationStatus;
  total: number;
  processed: number;
  readyCount: number;
  bookmarkCount: number;
  unavailable: number;
  estimatedTotal: number;
  pauseUntil: number;
  startedAt: number;
  account: ExportAccountInfo | null;
  onHide: () => void;
  onDownloadNow: () => void;
  onLogin?: () => void;
  quickExporting: boolean;
}) {
  const progress = getHydrationProgress({
    bookmarkCount,
    readyCount,
    queueTotal: Math.max(total, estimatedTotal),
    processed,
  });

  if (status === "paused-auth") {
    return (
      <>
        <p className="text-sm text-foreground mb-2">
          Full export paused
        </p>
        <p className="text-xs text-muted leading-snug mb-4">
          Sign in to X again to continue fetching threads.
        </p>
        <ProgressBar pct={progress.pct} />
        <p className="text-xs text-muted mt-2 mb-4">
          {progress.done.toLocaleString("en-US")} of {progress.total.toLocaleString("en-US")}
          {" "}{progress.pct}%
        </p>
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={onHide}>
            Hide
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
        <ProgressBar pct={progress.pct} />
        <p className="text-xs text-muted mt-2 mb-4">
          {progress.done.toLocaleString("en-US")} of {progress.total.toLocaleString("en-US")}
          {" "}{progress.pct}%
        </p>
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={onHide}>
            Hide
          </Button>
          <Button
            variant="primary"
            onClick={onDownloadNow}
            disabled={quickExporting || !account}
          >
            {quickExporting ? "Downloading…" : "Download partial ZIP"}
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
      <p className="text-xs text-muted leading-snug mb-3">
        Totem is fetching missing full content in the background. You can download a
        partial ZIP now without stopping the full export.
      </p>

      <p className="text-sm tabular-nums text-foreground mb-2">
        {progress.done.toLocaleString("en-US")} of {progress.total.toLocaleString("en-US")}
        {" "}{progress.pct}%
      </p>
      <ProgressBar pct={progress.pct} />

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

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onHide}>
          Hide
        </Button>
        <Button
          variant="primary"
          onClick={onDownloadNow}
          disabled={quickExporting || !account}
        >
          {quickExporting ? "Downloading…" : "Download partial ZIP"}
        </Button>
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
        {detailCount.toLocaleString("en-US")} with full content
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
          {downloading ? "Downloading…" : "Download full ZIP →"}
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
          ? ` · ${result.detailCount.toLocaleString("en-US")} with full content`
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
          Close export summary
        </Button>
      </div>
    </>
  );
}

function HighlightsDoneView({
  result,
  onClose,
}: {
  result: HighlightsExportResult;
  onClose: () => void;
}) {
  return (
    <>
      <div className="flex items-center gap-2 mb-3">
        <div className="size-8 rounded-full bg-success/15 flex items-center justify-center">
          <span className="text-success text-lg">&#10003;</span>
        </div>
        <span className="text-sm font-medium text-foreground">
          Highlights exported
        </span>
      </div>
      <p className="text-xs text-muted leading-snug mb-4">
        {result.annotatedBookmarkCount.toLocaleString("en-US")} bookmark
        {result.annotatedBookmarkCount === 1 ? "" : "s"}
        {result.highlightCount > 0
          ? ` · ${result.highlightCount.toLocaleString("en-US")} highlight${result.highlightCount === 1 ? "" : "s"}`
          : ""}
        {result.noteCount > 0
          ? ` · ${result.noteCount.toLocaleString("en-US")} note${result.noteCount === 1 ? "" : "s"}`
          : ""}
      </p>
      <div className="flex justify-end">
        <Button variant="primary" onClick={onClose}>
          Close export summary
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
