import { cn } from "../../lib/cn";

interface Props {
  orientation?: "horizontal" | "vertical";
  className?: string;
}

export function Separator({ orientation = "horizontal", className }: Props) {
  return (
    <div
      className={cn(
        "bg-border",
        orientation === "vertical" ? "mx-0.5 h-5 w-px" : "my-0.5 h-px w-full",
        className,
      )}
    />
  );
}
