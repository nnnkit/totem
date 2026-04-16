import { useState } from "react";
import { Menu } from "@base-ui/react/menu";
import {
  CaretDownIcon,
  CheckIcon,
  ExportIcon,
  XIcon,
} from "@phosphor-icons/react";
import { cn } from "../../lib/cn";

interface Props {
  onCopyMarkdown: () => Promise<boolean>;
  onDownloadMarkdown: () => void;
  onPrintPdf: () => void;
}

type CopyStatus = "idle" | "copied" | "failed";

export function ArticleExportMenu({
  onCopyMarkdown,
  onDownloadMarkdown,
  onPrintPdf,
}: Props) {
  const [copyStatus, setCopyStatus] = useState<CopyStatus>("idle");

  async function handleCopyMarkdown() {
    const ok = await onCopyMarkdown();
    setCopyStatus(ok ? "copied" : "failed");
    window.setTimeout(() => setCopyStatus("idle"), 2000);
  }

  return (
    <Menu.Root modal={false}>
      <Menu.Trigger
        className={cn(
          "inline-flex items-center justify-center gap-0.5 rounded px-2.5 py-1 text-xs font-medium transition-colors",
          "text-muted hover:text-foreground hover:bg-surface-hover",
          "disabled:opacity-50 disabled:pointer-events-none",
        )}
        aria-label="Export post"
        title="Copy, download, or print this post"
      >
        {copyStatus === "copied" ? (
          <CheckIcon className="size-3.5 text-success" weight="bold" aria-hidden />
        ) : copyStatus === "failed" ? (
          <XIcon className="size-3.5 text-red-500" weight="bold" aria-hidden />
        ) : (
          <ExportIcon className="size-3.5" aria-hidden />
        )}
        <span className="max-sm:hidden">
          {copyStatus === "copied"
            ? "Copied"
            : copyStatus === "failed"
              ? "Copy failed"
              : "Export"}
        </span>
        <CaretDownIcon className="size-3 opacity-70 max-sm:hidden" aria-hidden />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner sideOffset={6} align="end">
          <Menu.Popup
            className={cn(
              "z-50 min-w-52 rounded border border-border bg-surface-card py-1 shadow-xl",
              "outline-none",
            )}
          >
            <Menu.Item
              className={cn(
                "cursor-pointer px-3 py-2 text-sm text-foreground outline-none",
                "data-highlighted:bg-surface-hover",
              )}
              onClick={handleCopyMarkdown}
            >
              Copy Markdown
            </Menu.Item>
            <Menu.Item
              className={cn(
                "cursor-pointer px-3 py-2 text-sm text-foreground outline-none",
                "data-highlighted:bg-surface-hover",
              )}
              onClick={onDownloadMarkdown}
            >
              Download Markdown
            </Menu.Item>
            <Menu.Item
              className={cn(
                "cursor-pointer px-3 py-2 text-sm text-foreground outline-none",
                "data-highlighted:bg-surface-hover",
              )}
              onClick={onPrintPdf}
            >
              Print / Save as PDF
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
