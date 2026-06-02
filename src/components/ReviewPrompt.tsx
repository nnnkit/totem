import { XIcon } from "@phosphor-icons/react";
import { CHROME_WEB_STORE_REVIEW_URL } from "../lib/constants/growth";

interface Props {
  onDismiss: () => void;
  onReview: () => void;
}

export function ReviewPrompt({ onDismiss, onReview }: Props) {
  return (
    <div className="fixed inset-x-0 bottom-5 z-40 px-4">
      <div className="mx-auto flex max-w-xl items-center gap-3 rounded border border-border bg-surface-card px-4 py-3 text-sm text-foreground shadow-xl">
        <p className="min-w-0 flex-1 text-pretty">
          Enjoying Totem? A quick review helps others find it.
        </p>
        <a
          href={CHROME_WEB_STORE_REVIEW_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onReview}
          className="shrink-0 rounded bg-accent px-3 py-2 text-xs font-medium text-white transition-opacity hover:opacity-90"
        >
          Review
        </a>
        <button
          type="button"
          onClick={onDismiss}
          className="-mr-1 flex size-9 shrink-0 items-center justify-center rounded text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
          aria-label="Dismiss review prompt"
          title="Dismiss"
        >
          <XIcon className="size-4" />
        </button>
      </div>
    </div>
  );
}
