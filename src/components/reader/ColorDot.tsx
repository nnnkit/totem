import type { HighlightColor } from "../../lib/highlight-colors";
import { cn } from "../../lib/cn";

interface Props {
  color: HighlightColor;
  size?: "xs" | "sm" | "md";
  selected?: boolean;
  className?: string;
}

const sizeClass = {
  xs: "h-2.5 w-2.5",
  sm: "h-3 w-3",
  md: "h-4 w-4",
} as const;

export function ColorDot({ color, size = "sm", selected, className }: Props) {
  return (
    <span
      className={cn(
        "totem-color-dot",
        sizeClass[size],
        selected && "ring-2 ring-foreground ring-offset-1 ring-offset-surface-card",
        className,
      )}
      data-color={color}
      aria-hidden="true"
    />
  );
}
