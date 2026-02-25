import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "w-full rounded border border-border bg-surface-card py-1.5 px-3 text-sm text-foreground placeholder:text-muted/60 focus:border-accent focus:outline-none transition-colors",
        className,
      )}
      {...props}
    />
  ),
);
