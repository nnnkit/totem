import { Popover } from "@base-ui/react/popover";
import { cn } from "../../lib/cn";

interface PopoverContentProps extends React.ComponentProps<typeof Popover.Popup> {
  className?: string;
}

export function PopoverContent({ className, ...props }: PopoverContentProps) {
  return (
    <Popover.Popup
      className={cn(
        "totem-popover z-30 rounded border border-border bg-surface-card shadow-xl",
        className,
      )}
      {...props}
    />
  );
}

export { Popover };
