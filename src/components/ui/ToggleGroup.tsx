import { type ReactNode } from "react";
import { cn } from "../../lib/cn";

interface Props<T extends string> {
  items: readonly { value: T; label: string; icon?: ReactNode }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export function ToggleGroup<T extends string>({ items, value, onChange, className }: Props<T>) {
  return (
    <div className={cn("flex gap-1 rounded-lg bg-surface p-1", className)}>
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          onClick={() => onChange(item.value)}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-md transition-colors",
            value === item.value
              ? "bg-accent/15 text-accent"
              : "text-foreground hover:bg-surface-hover",
          )}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </div>
  );
}
