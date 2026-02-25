import { forwardRef, type SelectHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        "rounded border border-border bg-surface-card px-2.5 py-1.5 text-sm text-foreground focus:border-accent focus:outline-none transition-colors",
        className,
      )}
      {...props}
    />
  ),
);
