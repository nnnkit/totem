import { cn } from "../../lib/cn";

interface Props {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  "aria-labelledby"?: string;
  className?: string;
}

export function Switch({ checked, onCheckedChange, className, ...props }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={props["aria-labelledby"]}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
        checked ? "bg-accent" : "bg-border",
        className,
      )}
    >
      <span
        className={cn(
          "inline-block size-4 rounded-full bg-white transition-transform",
          checked ? "translate-x-6" : "translate-x-1",
        )}
      />
    </button>
  );
}
