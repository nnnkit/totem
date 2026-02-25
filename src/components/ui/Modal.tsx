import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { cn } from "../../lib/cn";

interface Props {
  open: boolean;
  onClose: () => void;
  className?: string;
  ariaLabelledBy?: string;
  children: ReactNode | ((closing: boolean) => ReactNode);
}

const FOCUSABLE = 'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

export function Modal({ open, onClose, className, ariaLabelledBy, children }: Props) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement as HTMLElement | null;
      setVisible(true);
      setIsClosing(false);
    } else if (visible) {
      setIsClosing(true);
    }
  }, [open]);

  useEffect(() => {
    if (!visible || isClosing) return;
    const container = backdropRef.current;
    if (!container) return;

    const firstFocusable = container.querySelector<HTMLElement>(FOCUSABLE);
    firstFocusable?.focus();
  }, [visible, isClosing]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== "Tab") return;
    const container = backdropRef.current;
    if (!container) return;

    const focusableEls = container.querySelectorAll<HTMLElement>(FOCUSABLE);
    if (focusableEls.length === 0) return;

    const first = focusableEls[0];
    const last = focusableEls[focusableEls.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }, []);

  useHotkeys("escape", () => onClose(), {
    enabled: open,
    enableOnFormTags: true,
  }, [onClose]);

  if (!visible) return null;

  return (
    <div
      ref={backdropRef}
      className={cn(
        "fixed inset-0 z-50",
        isClosing ? "animate-overlay-out" : "animate-overlay-in",
        className,
      )}
      role="dialog"
      aria-modal="true"
      aria-labelledby={ariaLabelledBy}
      onKeyDown={handleKeyDown}
      onAnimationEnd={() => {
        if (isClosing) {
          setVisible(false);
          setIsClosing(false);
          previousFocusRef.current?.focus();
        }
      }}
      onClick={(e) => {
        if (e.target === backdropRef.current) onClose();
      }}
    >
      {typeof children === "function" ? children(isClosing) : children}
    </div>
  );
}
