import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

const variants = {
  primary: "bg-accent text-white hover:opacity-90",
  secondary:
    "border border-border bg-surface-card text-muted hover:bg-surface-hover hover:text-foreground",
  ghost: "text-muted hover:text-foreground hover:bg-surface-hover",
  destructive: "bg-red-500/15 text-red-500 hover:bg-red-500/25",
  "accent-soft": "bg-accent-surface text-accent hover:bg-accent-surface-hover",
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
  href?: string;
}

const base =
  "inline-flex items-center justify-center gap-1.5 rounded font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none";

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "default", href, ...props }, ref) => {
    const classes = cn(base, variants[variant], sizes[size], className);

    if (href) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={classes}
          // forward only aria/data attrs that make sense on <a>
          aria-label={props["aria-label"]}
          title={props.title}
        >
          {props.children}
        </a>
      );
    }

    return <button ref={ref} className={classes} {...props} />;
  },
);
