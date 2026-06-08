import { useState, useRef, useCallback } from "react";
import {
  UploadSimpleIcon,
  WarningCircleIcon,
  CheckCircleIcon,
} from "@phosphor-icons/react";
import { Modal } from "./ui/Modal";
import { Button } from "./ui/Button";
import {
  parseZip,
  validateImport,
  runImport,
  ImportPartialFailure,
  MAX_INPUT_ZIP_BYTES,
  type ImportManifest,
  type ImportResult,
  type ImportStoreOutcome,
  type ImportStoreProgress,
  type RefusedReason,
  type ValidatedImport,
} from "../lib/import/run-import";
import { cn } from "../lib/cn";

interface Props {
  open: boolean;
  onClose: () => void;
  activeAccountUserId: string | null;
  onRefreshAfterImport: () => void | Promise<void>;
}

type ImportState =
  | { phase: "empty" }
  | { phase: "parsing" }
  | { phase: "valid"; manifest: ImportManifest; files: Record<string, Uint8Array>; accountMatch: boolean }
  | { phase: "refused"; reason: RefusedReason }
  | { phase: "importing"; progress: ImportStoreProgress | null }
  | { phase: "done"; result: ImportResult }
  | { phase: "error"; message: string };

const REFUSED_MESSAGES: Record<RefusedReason, { title: string; description: string; action: string }> = {
  not_totem_export: {
    title: "Not a Totem export",
    description: "This file doesn't appear to be a Totem export ZIP. It should contain a manifest.json file.",
    action: "Try another file",
  },
  schema_too_new: {
    title: "Update Totem first",
    description: "This export was created with a newer Totem export format or data schema.",
    action: "Update Totem",
  },
  checksum_mismatch: {
    title: "Damaged file",
    description: "One or more files in the ZIP don't match their expected checksums. The file may be corrupted.",
    action: "Try another file",
  },
  not_logged_in: {
    title: "Not logged in",
    description: "You need to be logged in to X before importing. Log in and try again.",
    action: "Log in to X",
  },
  empty_zip: {
    title: "Empty export",
    description: "This ZIP doesn't contain any data to import.",
    action: "Try another file",
  },
  too_large: {
    title: "File too large",
    description: "This ZIP is larger than Totem can import. Re-export and try again.",
    action: "Try another file",
  },
};

function formatCount(n: number): string {
  return n.toLocaleString("en-US");
}

export function ImportModal({
  open,
  onClose,
  activeAccountUserId,
  onRefreshAfterImport,
}: Props) {
  const [state, setState] = useState<ImportState>({ phase: "empty" });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleClose = () => {
    if (state.phase === "importing") return;
    setState({ phase: "empty" });
    onClose();
  };

  const processFile = useCallback(async (file: File) => {
    setState({ phase: "parsing" });
    if (file.size > MAX_INPUT_ZIP_BYTES) {
      setState({ phase: "refused", reason: "too_large" });
      return;
    }
    try {
      const buffer = await file.arrayBuffer();
      const zipBytes = new Uint8Array(buffer);

      const parsed = parseZip(zipBytes);
      if (!parsed.ok) {
        setState({ phase: "refused", reason: parsed.reason });
        return;
      }

      const validated = await validateImport(parsed, activeAccountUserId);
      if (!validated.ok) {
        setState({ phase: "refused", reason: validated.reason });
        return;
      }

      setState({
        phase: "valid",
        manifest: validated.manifest,
        files: validated.files,
        accountMatch: validated.accountMatch,
      });
    } catch (error) {
      setState({
        phase: "error",
        message: error instanceof Error ? error.message : "Failed to read file",
      });
    }
  }, [activeAccountUserId]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [processFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleStartImport = useCallback(async () => {
    if (state.phase !== "valid") return;
    const validated: Extract<ValidatedImport, { ok: true }> = {
      ok: true,
      manifest: state.manifest,
      files: state.files,
      accountMatch: state.accountMatch,
    };

    setState({ phase: "importing", progress: null });
    try {
      const result = await runImport(validated, (progress) => {
        setState({ phase: "importing", progress });
      });
      setState({ phase: "done", result });
      await Promise.resolve(onRefreshAfterImport()).catch((error: unknown) => {
        console.warn("Import succeeded, but post-import refresh failed.", error);
      });
    } catch (error) {
      if (error instanceof ImportPartialFailure) {
        setState({ phase: "done", result: error.result });
        await Promise.resolve(onRefreshAfterImport()).catch((refreshError: unknown) => {
          console.warn("Import partially succeeded, but post-import refresh failed.", refreshError);
        });
        return;
      }
      setState({
        phase: "error",
        message: error instanceof Error ? error.message : "Import failed",
      });
    }
  }, [onRefreshAfterImport, state]);

  const handleReset = useCallback(() => {
    setState({ phase: "empty" });
  }, []);

  return (
    <Modal
      open={open}
      onClose={handleClose}
      className="bg-black/50"
      title="Import a Totem export"
      titleId="import-title"
      closeDisabled={state.phase === "importing"}
    >
      {state.phase === "empty" && (
        <EmptyView
          dropZoneRef={dropZoneRef}
          fileInputRef={fileInputRef}
          dragOver={dragOver}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onCancel={handleClose}
        />
      )}
      {state.phase === "parsing" && <ParsingView />}
      {state.phase === "valid" && (
        <ValidView
          manifest={state.manifest}
          accountMatch={state.accountMatch}
          onImport={handleStartImport}
          onCancel={handleClose}
        />
      )}
      {state.phase === "refused" && (
        <RefusedView
          reason={state.reason}
          onReset={handleReset}
          onClose={handleClose}
        />
      )}
      {state.phase === "importing" && (
        <ImportingView progress={state.progress} />
      )}
      {state.phase === "done" && (
        <DoneView
          result={state.result}
          onClose={handleClose}
        />
      )}
      {state.phase === "error" && (
        <ErrorView
          message={state.message}
          onReset={handleReset}
          onClose={handleClose}
        />
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".zip,application/zip"
        className="hidden"
        onChange={handleFileSelect}
      />
    </Modal>
  );
}

function EmptyView({
  dropZoneRef,
  fileInputRef,
  dragOver,
  onDrop,
  onDragOver,
  onDragLeave,
  onCancel,
}: {
  dropZoneRef: React.RefObject<HTMLDivElement | null>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  dragOver: boolean;
  onDrop: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onCancel: () => void;
}) {
  return (
    <>
      <div
        ref={dropZoneRef}
        role="button"
        tabIndex={0}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        className={cn(
          "flex flex-col items-center justify-center gap-3 rounded border-2 border-dashed p-8 cursor-pointer transition-colors",
          dragOver
            ? "border-accent bg-accent-surface/50"
            : "border-border/60 hover:border-accent/40 hover:bg-accent-surface/20",
        )}
      >
        <UploadSimpleIcon className="size-8 text-muted" />
        <div className="text-center">
          <p className="text-sm text-foreground/80">
            Drop a Totem export ZIP here
          </p>
          <p className="text-xxs text-muted/60 mt-1">
            or click to browse
          </p>
        </div>
      </div>

      <p className="text-xxs text-muted/60 leading-snug mt-3 mb-4">
        The importer reads <code className="text-xxs">data/*.jsonl</code> files
        only. CSV and Markdown are ignored.
      </p>

      <div className="flex justify-end">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </>
  );
}

function ParsingView() {
  return (
    <div className="flex flex-col items-center gap-3 py-6">
      <div className="size-8 rounded-full border-2 border-accent/30 border-t-accent animate-spin" />
      <p className="text-sm text-muted">Reading and verifying…</p>
    </div>
  );
}

function ValidView({
  manifest,
  accountMatch,
  onImport,
  onCancel,
}: {
  manifest: ImportManifest;
  accountMatch: boolean;
  onImport: () => void;
  onCancel: () => void;
}) {
  const counts = manifest.counts;

  return (
    <>
      {accountMatch ? (
        <div className="flex items-start gap-3 mb-4">
          <CheckCircleIcon weight="fill" className="size-5 text-success shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-foreground/90">
              Valid Totem export from {manifest.account.handle_redacted}
            </p>
            <p className="text-xxs text-muted/60 mt-1 leading-snug">
              {formatCount(counts.bookmarks)} bookmarks
              {counts.details > 0 ? ` · ${formatCount(counts.details)} details` : ""}
              {counts.highlights > 0 ? ` · ${formatCount(counts.highlights)} highlights` : ""}
              {counts.reading_progress > 0 ? ` · ${formatCount(counts.reading_progress)} reading progress` : ""}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3 rounded border border-accent/40 bg-accent-surface/30 p-3 mb-4">
          <WarningCircleIcon weight="fill" className="size-5 text-accent shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-foreground/90">
              Account mismatch
            </p>
            <p className="text-xxs text-muted/70 mt-1 leading-snug">
              This export is from {manifest.account.handle_redacted}, which
              doesn't match your current account. Importing will add these
              bookmarks to your current library.
            </p>
            <p className="text-xxs text-muted/60 mt-1.5 leading-snug">
              {formatCount(counts.bookmarks)} bookmarks
              {counts.details > 0 ? ` · ${formatCount(counts.details)} details` : ""}
              {counts.highlights > 0 ? ` · ${formatCount(counts.highlights)} highlights` : ""}
              {counts.reading_progress > 0 ? ` · ${formatCount(counts.reading_progress)} reading progress` : ""}
            </p>
          </div>
        </div>
      )}

      <div className="flex gap-2 justify-end">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="primary" onClick={onImport}>
          {accountMatch ? "Import" : "Import anyway"}
        </Button>
      </div>
    </>
  );
}

function RefusedView({
  reason,
  onReset,
  onClose,
}: {
  reason: RefusedReason;
  onReset: () => void;
  onClose: () => void;
}) {
  const info = REFUSED_MESSAGES[reason];

  return (
    <>
      <div className="flex items-start gap-3 mb-4">
        <WarningCircleIcon weight="fill" className="size-5 text-red-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-foreground">{info.title}</p>
          <p className="text-xs text-muted mt-1 leading-snug">{info.description}</p>
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
        {(
          reason === "not_totem_export" ||
          reason === "checksum_mismatch" ||
          reason === "empty_zip" ||
          reason === "too_large"
        ) && (
          <Button variant="primary" onClick={onReset}>
            {info.action}
          </Button>
        )}
      </div>
    </>
  );
}

const STORE_LABELS: Record<string, string> = {
  bookmarks: "Bookmarks",
  details: "Thread details",
  highlights: "Highlights",
  reading_progress: "Reading progress",
  today_queue_snapshots: "Today's queues",
  bookmark_queue_metadata: "Queue feedback",
  today_queue_exposures: "Queue activity",
};

const STORE_ORDER = [
  "bookmarks",
  "details",
  "highlights",
  "reading_progress",
  "today_queue_snapshots",
  "bookmark_queue_metadata",
  "today_queue_exposures",
] as const;

function ImportingView({ progress }: { progress: ImportStoreProgress | null }) {
  const currentStore = progress?.store;
  const currentIndex = currentStore ? STORE_ORDER.indexOf(currentStore) : -1;

  return (
    <div className="py-2">
      <div className="space-y-2.5">
        {STORE_ORDER.map((store, i) => {
          const isDone = currentIndex > i;
          const isCurrent = currentIndex === i;
          return (
            <div key={store} className="flex items-center gap-3">
              <div className={cn(
                "size-5 rounded-full flex items-center justify-center shrink-0",
                isDone && "bg-success/15",
                isCurrent && "border-2 border-accent/30 border-t-accent animate-spin",
                !isDone && !isCurrent && "border border-border/40",
              )}>
                {isDone && <CheckCircleIcon weight="fill" className="size-5 text-success" />}
              </div>
              <span className={cn(
                "text-sm",
                isCurrent ? "text-foreground" : isDone ? "text-muted" : "text-muted/50",
              )}>
                {STORE_LABELS[store]}
                {isCurrent && progress
                  ? ` — ${formatCount(progress.added + progress.alreadyHad)} of ${formatCount(progress.total)}`
                  : ""}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DoneView({
  result,
  onClose,
}: {
  result: ImportResult;
  onClose: () => void;
}) {
  const stores: Array<{ label: string; counts: ImportStoreOutcome }> = [
    { label: "Bookmarks", counts: result.bookmarks },
    { label: "Thread details", counts: result.details },
    { label: "Highlights", counts: result.highlights },
    { label: "Reading progress", counts: result.readingProgress },
    { label: "Today's queues", counts: result.todayQueueSnapshots },
    { label: "Queue feedback", counts: result.queueMetadata },
    { label: "Queue activity", counts: result.todayQueueExposures },
  ].filter((s) =>
    s.counts.status === "failed" ||
    s.counts.added > 0 ||
    s.counts.alreadyHad > 0 ||
    s.counts.total > 0
  );
  const isPartial = result.status === "partial";

  return (
    <>
      <div className="flex items-center gap-2 mb-3">
        <div className={cn(
          "size-8 rounded-full flex items-center justify-center",
          isPartial ? "bg-accent-surface/60" : "bg-success/15",
        )}>
          {isPartial ? (
            <WarningCircleIcon weight="fill" className="size-5 text-accent" />
          ) : (
            <CheckCircleIcon weight="fill" className="size-5 text-success" />
          )}
        </div>
        <span className="text-sm font-medium text-foreground">
          {isPartial ? "Import completed with issues" : "Import complete"}
        </span>
      </div>

      <div className="rounded border border-border/60 divide-y divide-border/40 mb-4">
        <div className="grid grid-cols-[1fr_auto_auto] gap-3 px-3 py-1.5 text-xxs text-muted/70 font-medium">
          <span>Store</span>
          <span className="text-right">Added</span>
          <span className="text-right">Already had</span>
        </div>
        {stores.map((s) => (
          <div key={s.label} className="px-3 py-1.5 text-xs">
            <div className="grid grid-cols-[1fr_auto_auto] gap-3">
              <span className={cn(
                "text-foreground/80",
                s.counts.status === "failed" && "text-red-400",
              )}>
                {s.label}
              </span>
              <span className="text-right text-success">{formatCount(s.counts.added)}</span>
              <span className="text-right text-muted">{formatCount(s.counts.alreadyHad)}</span>
            </div>
            {s.counts.status === "failed" && (
              <p className="mt-1 text-xxs leading-snug text-red-400">
                {s.counts.message}
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-2 justify-end">
        <Button variant="primary" onClick={onClose}>
          Close import summary
        </Button>
      </div>
    </>
  );
}

function ErrorView({
  message,
  onReset,
  onClose,
}: {
  message: string;
  onReset: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <p className="text-sm text-foreground mb-2">Import failed</p>
      <p className="text-xs text-muted leading-snug mb-4">{message}</p>
      <div className="flex gap-2 justify-end">
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
        <Button variant="primary" onClick={onReset}>
          Try again
        </Button>
      </div>
    </>
  );
}
