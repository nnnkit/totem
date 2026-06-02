import { useEffect, useRef, useState } from "react";
import { Menu } from "@base-ui/react/menu";
import {
  CaretDownIcon,
  CheckIcon,
  CopyIcon,
  DownloadSimpleIcon,
  PrinterIcon,
  XIcon,
} from "@phosphor-icons/react";
import { cn } from "../../lib/cn";

interface Props {
  onCopyForAgent: () => Promise<boolean>;
  onCopyMarkdown: () => Promise<boolean>;
  onDownloadMarkdown: () => void;
  onPrintPdf: () => void;
}

type CopyStatus = "idle" | "copied" | "failed";
type ExportActionId =
  | "copy-agent"
  | "copy-markdown"
  | "download-markdown"
  | "print-pdf";

const ACTION_ORDER: ExportActionId[] = [
  "copy-agent",
  "copy-markdown",
  "download-markdown",
  "print-pdf",
];
const ACTIVE_ACTION_STORAGE_KEY = "totem.reader.export.activeAction";

function isExportActionId(value: string | null): value is ExportActionId {
  return ACTION_ORDER.includes(value as ExportActionId);
}

function readActiveActionId(): ExportActionId {
  try {
    const stored = window.localStorage.getItem(ACTIVE_ACTION_STORAGE_KEY);
    return isExportActionId(stored) ? stored : "copy-agent";
  } catch {
    return "copy-agent";
  }
}

function writeActiveActionId(actionId: ExportActionId): void {
  try {
    window.localStorage.setItem(ACTIVE_ACTION_STORAGE_KEY, actionId);
  } catch {
    return;
  }
}

export function ArticleExportMenu({
  onCopyForAgent,
  onCopyMarkdown,
  onDownloadMarkdown,
  onPrintPdf,
}: Props) {
  const [activeActionId, setActiveActionId] =
    useState<ExportActionId>(readActiveActionId);
  const [copyStatus, setCopyStatus] = useState<CopyStatus>("idle");
  const resetTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  const actions: Record<
    ExportActionId,
    {
      label: string;
      run: () => Promise<boolean> | void;
      type: "copy" | "download" | "print";
    }
  > = {
    "copy-agent": {
      label: "Copy for Agent",
      run: onCopyForAgent,
      type: "copy",
    },
    "copy-markdown": {
      label: "Copy Markdown",
      run: onCopyMarkdown,
      type: "copy",
    },
    "download-markdown": {
      label: "Download Markdown",
      run: onDownloadMarkdown,
      type: "download",
    },
    "print-pdf": {
      label: "Print / Save PDF",
      run: onPrintPdf,
      type: "print",
    },
  };

  const orderedActionIds = [
    activeActionId,
    ...ACTION_ORDER.filter((id) => id !== activeActionId),
  ];

  function clearCopyStatus() {
    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
    setCopyStatus("idle");
  }

  async function handleAction(actionId: ExportActionId) {
    const actionChanged = actionId !== activeActionId;
    setActiveActionId(actionId);
    writeActiveActionId(actionId);
    const action = actions[actionId];

    if (actionChanged || action.type !== "copy") {
      clearCopyStatus();
    }

    if (action.type !== "copy") {
      action.run();
      return;
    }

    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current);
    }
    const ok = await action.run();
    setCopyStatus(ok ? "copied" : "failed");
    resetTimerRef.current = window.setTimeout(() => setCopyStatus("idle"), 2000);
  }

  const activeAction = actions[activeActionId];
  const quickButtonLabel =
    activeAction.type === "copy" && copyStatus === "copied"
      ? `${activeAction.label} copied`
      : activeAction.type === "copy" && copyStatus === "failed"
        ? `${activeAction.label} failed`
        : activeAction.label;

  const quickIcon =
    activeAction.type === "copy" && copyStatus === "copied" ? (
      <CheckIcon className="size-3.5 text-success" weight="bold" aria-hidden />
    ) : activeAction.type === "copy" && copyStatus === "failed" ? (
      <XIcon className="size-3.5 text-red-500" weight="bold" aria-hidden />
    ) : activeAction.type === "download" ? (
      <DownloadSimpleIcon className="size-3.5" aria-hidden />
    ) : activeAction.type === "print" ? (
      <PrinterIcon className="size-3.5" aria-hidden />
    ) : (
      <CopyIcon className="size-3.5" aria-hidden />
    );

  return (
    <div className="inline-flex items-center gap-0.5">
      <button
        type="button"
        className={cn(
          "inline-flex h-7 items-center justify-center gap-1.5 rounded px-2.5 text-xs font-medium transition-colors",
          "text-muted hover:text-foreground hover:bg-surface-hover",
          "disabled:opacity-50 disabled:pointer-events-none",
        )}
        aria-label={quickButtonLabel}
        title={quickButtonLabel}
        onClick={() => void handleAction(activeActionId)}
      >
        {quickIcon}
        <span className="whitespace-nowrap">{activeAction.label}</span>
      </button>

      <Menu.Root modal={false}>
        <Menu.Trigger
          className={cn(
            "inline-flex h-7 w-6 items-center justify-center rounded transition-colors",
            "text-muted hover:text-foreground hover:bg-surface-hover",
            "disabled:opacity-50 disabled:pointer-events-none",
          )}
          aria-label="More copy and export options"
          title="More copy and export options"
        >
          <CaretDownIcon className="size-3.5 opacity-80" aria-hidden />
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner sideOffset={6} align="end">
            <Menu.Popup
              className={cn(
                "z-50 min-w-52 rounded border border-border bg-surface-card py-1 shadow-xl",
                "outline-none",
              )}
            >
              {orderedActionIds.map((actionId) => (
                <Menu.Item
                  key={actionId}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-foreground outline-none",
                    "data-highlighted:bg-surface-hover",
                  )}
                  onClick={() => void handleAction(actionId)}
                >
                  <span className="flex size-4 items-center justify-center">
                    {actionId === activeActionId && (
                      <CheckIcon className="size-3.5 text-success" weight="bold" aria-hidden />
                    )}
                  </span>
                  <span>{actions[actionId].label}</span>
                </Menu.Item>
              ))}
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    </div>
  );
}
