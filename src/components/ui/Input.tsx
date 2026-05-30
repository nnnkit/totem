import { type InputHTMLAttributes, type Ref } from "react";
import { cn } from "../../lib/cn";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  ref?: Ref<HTMLInputElement>;
}

export function Input({ className, ref, ...props }: InputProps) {
  return (
    <input
      ref={ref}
      className={cn(
        "w-full rounded border border-border bg-surface-card py-1.5 px-3 text-sm text-foreground placeholder:text-muted/60 focus:border-accent focus:outline-none transition-colors",
        className,
      )}
      {...props}
    />
  );
}
