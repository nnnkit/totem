import { TotemLogo } from "../TotemLogo";
import { cn } from "../../lib/cn";

interface Props {
  label: string;
  size?: "sm" | "md";
  className?: string;
}

const LOGO_SIZE: Record<NonNullable<Props["size"]>, string> = {
  sm: "size-5",
  md: "size-8",
};

export function TotemLoading({ label, size = "sm", className }: Props) {
  return (
    <div
      className={cn("flex items-center gap-3 text-sm text-muted", className)}
      role="status"
      aria-live="polite"
    >
      <TotemLogo loading className={LOGO_SIZE[size]} />
      <span>{label}</span>
    </div>
  );
}
