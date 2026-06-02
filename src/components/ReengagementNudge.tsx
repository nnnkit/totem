import { XIcon } from "@phosphor-icons/react";
import { Button } from "./ui/Button";

interface Props {
  unreadCount: number;
  onOpenReading: () => void;
  onDismiss: () => void;
}

export function ReengagementNudge({
  unreadCount,
  onOpenReading,
  onDismiss,
}: Props) {
  const countLabel = unreadCount.toLocaleString("en-US");

  return (
    <div className="fixed inset-x-0 bottom-5 z-40 px-4">
      <div className="mx-auto flex max-w-xl items-center gap-3 rounded border border-overlay-edge bg-overlay px-4 py-3 text-sm text-on-bg shadow-xl backdrop-blur-md">
        <p className="min-w-0 flex-1 text-pretty">
          You have {countLabel} unread Twitter bookmark{unreadCount === 1 ? "" : "s"} waiting.
        </p>
        <Button
          variant="secondary"
          size="sm"
          onClick={onOpenReading}
          className="shrink-0 bg-home-secondary-bg text-home-secondary-text hover:bg-main-bg-hover"
        >
          Open
        </Button>
        <button
          type="button"
          onClick={onDismiss}
          className="-mr-1 flex size-9 shrink-0 items-center justify-center rounded text-on-bg-ghost transition-colors hover:bg-white/10 hover:text-on-bg"
          aria-label="Dismiss unread bookmark nudge"
          title="Dismiss"
        >
          <XIcon className="size-4" />
        </button>
      </div>
    </div>
  );
}
