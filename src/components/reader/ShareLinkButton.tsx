import { useEffect, useRef, useState } from "react";
import { CheckIcon, ShareNetworkIcon, XIcon } from "@phosphor-icons/react";
import { Button } from "../ui/Button";

export interface ShareLinkResult {
  copied: boolean;
  includesThread: boolean;
}

interface Props {
  onShare: () => Promise<ShareLinkResult>;
  disabled?: boolean;
}

type ShareStatus = "idle" | "copied" | "copied-link-only" | "failed";

const STATUS_LABEL: Record<ShareStatus, string> = {
  idle: "Share",
  copied: "Link copied",
  "copied-link-only": "Link copied",
  failed: "Copy failed",
};

const STATUS_TITLE: Record<ShareStatus, string> = {
  idle: "Copy a link anyone can open — Totem opens it in the reader",
  copied: "Anyone can open this link; Totem users get it in their reader",
  "copied-link-only":
    "This thread was too large to travel in the link, so people without Totem will see the install page",
  failed: "Could not copy the link to the clipboard",
};

export function ShareLinkButton({ onShare, disabled }: Props) {
  const [status, setStatus] = useState<ShareStatus>("idle");
  const resetTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  async function handleShare() {
    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current);
    }
    const result = await onShare();
    setStatus(
      !result.copied
        ? "failed"
        : result.includesThread
          ? "copied"
          : "copied-link-only",
    );
    resetTimerRef.current = window.setTimeout(() => setStatus("idle"), 2000);
  }

  const icon =
    status === "failed" ? (
      <XIcon className="size-3.5 text-red-500" weight="bold" aria-hidden />
    ) : status === "idle" ? (
      <ShareNetworkIcon className="size-3.5" aria-hidden />
    ) : (
      <CheckIcon className="size-3.5 text-success" weight="bold" aria-hidden />
    );

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={disabled}
      onClick={() => void handleShare()}
      title={STATUS_TITLE[status]}
      aria-label={STATUS_LABEL[status]}
    >
      {icon}
      {STATUS_LABEL[status]}
    </Button>
  );
}
