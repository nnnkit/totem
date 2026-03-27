import type { ReactNode } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { cn } from "../../lib/cn";

interface Props {
  open: boolean;
  onClose: () => void;
  className?: string;
  ariaLabelledBy?: string;
  children: ReactNode;
}

export function Modal({ open, onClose, className, ariaLabelledBy, children }: Props) {
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
          aria-labelledby={ariaLabelledBy}
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          {children}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
