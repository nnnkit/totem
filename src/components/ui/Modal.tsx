import { useId, type ReactNode } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { XIcon } from "@phosphor-icons/react";
import { cn } from "../../lib/cn";
import { Button } from "./Button";

interface Props {
  open: boolean;
  onClose: () => void;
  className?: string;
  ariaLabelledBy?: string;
  title?: ReactNode;
  titleId?: string;
  closeLabel?: string;
  closeDisabled?: boolean;
  panelClassName?: string;
  bodyClassName?: string;
  children: ReactNode;
}

export function Modal({
  open,
  onClose,
  className,
  ariaLabelledBy,
  title,
  titleId,
  closeLabel = "Close",
  closeDisabled = false,
  panelClassName,
  bodyClassName,
  children,
}: Props) {
  const generatedTitleId = useId();
  const resolvedTitleId = title ? (titleId ?? ariaLabelledBy ?? generatedTitleId) : ariaLabelledBy;

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop
          className={cn(
            "fixed inset-0 z-50 transition-opacity",
            "data-[starting-style]:opacity-0 data-[ending-style]:opacity-0",
            className,
          )}
        />
        <Dialog.Popup
          className="fixed inset-0 z-50 transition-[opacity,transform] duration-200 data-[starting-style]:scale-95 data-[starting-style]:opacity-0 data-[ending-style]:scale-[0.97] data-[ending-style]:opacity-0"
          aria-labelledby={resolvedTitleId}
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          {title ? (
            <div
              className={cn(
                "max-w-md mx-auto mt-[10vh] max-h-[80vh] flex flex-col rounded border border-border bg-surface-card shadow-xl",
                panelClassName,
              )}
            >
              <div className="flex shrink-0 items-center justify-between px-6 pt-5 pb-3">
                <h2
                  id={resolvedTitleId}
                  className="text-lg font-semibold text-foreground text-balance"
                >
                  {title}
                </h2>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  disabled={closeDisabled}
                  className="-mr-2"
                  aria-label={closeLabel}
                  title={closeLabel}
                >
                  <XIcon className="size-5" />
                </Button>
              </div>
              <div className={cn("px-6 pb-6", bodyClassName)}>{children}</div>
            </div>
          ) : (
            children
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
