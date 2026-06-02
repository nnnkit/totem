import { Button } from "./ui/Button";
import { Modal } from "./ui/Modal";
import {
  PRIVACY_POLICY_URL,
  X_BOOKMARKS_URL,
} from "../lib/constants/growth";

interface Props {
  open: boolean;
  bookmarkCount: number;
  onClose: () => void;
  onSync: () => void;
}

export function OnboardingModal({
  open,
  bookmarkCount,
  onClose,
  onSync,
}: Props) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Set up Totem"
      panelClassName="max-w-lg"
      bodyClassName="space-y-5"
    >
      <div className="space-y-3 text-sm leading-6 text-muted">
        <p>
          Totem reads from the X account already signed in to this browser and
          stores your bookmark library on this device.
        </p>
        <div className="rounded border border-border bg-surface px-4 py-3">
          <p className="font-medium text-foreground">First sync</p>
          <p className="mt-1">
            Visit x.com/bookmarks once, then sync here. Totem will build a local
            reading queue from the bookmarks X returns.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded border border-border bg-surface px-4 py-3">
            <p className="font-medium text-foreground">cookies</p>
            <p className="mt-1 text-xs leading-5">
              Used only to identify the active X account and keep the local
              cache scoped to it.
            </p>
          </div>
          <div className="rounded border border-border bg-surface px-4 py-3">
            <p className="font-medium text-foreground">webRequest</p>
            <p className="mt-1 text-xs leading-5">
              Used only to read your own X request headers so bookmark sync can
              run from your browser session.
            </p>
          </div>
        </div>
        <p className="text-xs leading-5">
          {bookmarkCount > 0
            ? `${bookmarkCount.toLocaleString("en-US")} bookmarks are already in your local library.`
            : "No Totem account or server is involved."}{" "}
          <a
            href={PRIVACY_POLICY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-accent hover:underline"
          >
            Privacy policy
          </a>
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-3">
        <Button variant="ghost" onClick={onClose}>
          Done
        </Button>
        <Button variant="secondary" onClick={onSync}>
          Sync bookmarks
        </Button>
        <Button href={X_BOOKMARKS_URL}>
          Open X bookmarks
        </Button>
      </div>
    </Modal>
  );
}
