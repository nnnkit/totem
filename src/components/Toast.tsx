import { useEffect, useState } from "react";
import { X as XIcon } from "@phosphor-icons/react";

interface Props {
  message: string;
  linkUrl?: string;
  linkLabel?: string;
  duration?: number;
  onDismiss: () => void;
}

export function Toast({
  message,
  linkUrl,
  linkLabel,
  duration = 6000,
  onDismiss,
}: Props) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setExiting(true), duration);
    return () => clearTimeout(timer);
  }, [duration]);

  const handleDismiss = () => setExiting(true);

  return (
    <div
      className="fixed bottom-6 right-6 z-50"
      style={{
        animation: exiting
          ? "toast-out 150ms ease-in forwards"
          : "toast-in 200ms cubic-bezier(0.23, 1, 0.32, 1) forwards",
      }}
      onAnimationEnd={() => {
        if (exiting) onDismiss();
      }}
    >
      <div className="flex items-center gap-3 rounded-lg bg-x-card px-4 py-3 text-sm text-x-text shadow-lg border border-x-border">
        <p className="text-pretty">{message}</p>
        {linkUrl && (
          <a
            href={linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 font-medium text-accent hover:underline"
          >
            {linkLabel || "Open"}
          </a>
        )}
        <button
          onClick={handleDismiss}
          className="shrink-0 rounded-md p-1 text-x-text-secondary transition-colors hover:text-x-text"
          aria-label="Dismiss"
        >
          <XIcon className="size-4" />
        </button>
      </div>
    </div>
  );
}
