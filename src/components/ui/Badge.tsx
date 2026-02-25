import { cn } from "../../lib/cn";

const variants = {
  accent: "bg-accent px-2 py-0.5 text-xs font-medium text-white",
  muted: "bg-border/50 px-1.5 py-0.5 text-xs uppercase",
} as const;

interface Props {
  variant?: keyof typeof variants;
  className?: string;
  children: React.ReactNode;
}

export function Badge({ variant = "muted", className, children }: Props) {
  return (
    <span className={cn("shrink-0 rounded", variants[variant], className)}>
      {children}
    </span>
  );
}
