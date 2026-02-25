import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

const variants = {
  primary: "bg-accent text-white hover:opacity-90",
  secondary: "border border-border bg-surface-card text-muted hover:bg-surface-hover",
  ghost: "text-muted hover:text-foreground hover:bg-surface-hover",
  destructive: "bg-red-500/15 text-red-500 hover:bg-red-500/25",
  "accent-soft": "bg-accent-surface text-accent hover:bg-accent-surface-hover",
  outline: "border border-border bg-surface-card text-muted hover:bg-surface-hover hover:text-foreground",
} as const;

const sizes = {
  default: "px-3 py-2 text-sm",
  sm: "px-2.5 py-1 text-xs",
  icon: "p-2",
} as const;

type Variant = keyof typeof variants;
type Size = keyof typeof sizes;

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "default", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  ),
);
