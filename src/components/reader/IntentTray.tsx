import { useCallback, useEffect, useRef, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import type { BookmarkIntent } from "../../types";

const CHIPS: { intent: BookmarkIntent; label: string; key: string }[] = [
  { intent: "read_soon", label: "Read soon", key: "r" },
  { intent: "reference", label: "Reference", key: "f" },
  { intent: "act_on", label: "Act on", key: "a" },
];

const AUTO_DISMISS_MS = 8000;

interface IntentTrayProps {
  onSelect: (intent: BookmarkIntent) => void;
  onDismiss: () => void;
}

export function IntentTray({ onSelect, onDismiss }: IntentTrayProps) {
  const [exiting, setExiting] = useState(false);
  const trayRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

  const dismiss = useCallback(() => {
    setExiting(true);
  }, []);

  const handleSelect = useCallback(
    (intent: BookmarkIntent) => {
      onSelect(intent);
      setExiting(true);
    },
    [onSelect],
  );

  useEffect(() => {
    timerRef.current = setTimeout(dismiss, AUTO_DISMISS_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [dismiss]);

  useHotkeys("r", () => handleSelect("read_soon"), { preventDefault: true }, [handleSelect]);
  useHotkeys("f", () => handleSelect("reference"), { preventDefault: true }, [handleSelect]);
  useHotkeys("a", () => handleSelect("act_on"), { preventDefault: true }, [handleSelect]);
  useHotkeys("escape", dismiss, { preventDefault: true }, [dismiss]);

  return (
    <div
      ref={trayRef}
      role="toolbar"
      aria-label="File as"
      className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2"
      style={{
        animation: exiting
          ? "intent-tray-out 150ms ease-in forwards"
          : "intent-tray-in 200ms cubic-bezier(0.23, 1, 0.32, 1) forwards",
      }}
      onAnimationEnd={() => {
        if (exiting) onDismiss();
      }}
    >
      <div className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-card px-3 py-2 shadow-[0_4px_24px_rgba(0,0,0,0.12),0_1px_4px_rgba(0,0,0,0.08)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.4),0_1px_4px_rgba(0,0,0,0.2)]">
        <span className="mr-1 text-xs text-muted">File as</span>
        {CHIPS.map(({ intent, label, key }) => (
          <button
            key={intent}
            type="button"
            onClick={() => handleSelect(intent)}
            className="rounded-md bg-accent-surface px-2.5 py-1 text-xs font-medium text-accent transition-colors hover:bg-accent-surface-hover"
          >
            {label}
            <kbd className="ml-1.5 text-[0.625rem] uppercase opacity-50">{key}</kbd>
          </button>
        ))}
        <button
          type="button"
          onClick={dismiss}
          className="rounded-md px-2.5 py-1 text-xs font-medium text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
        >
          done
        </button>
      </div>
    </div>
  );
}
