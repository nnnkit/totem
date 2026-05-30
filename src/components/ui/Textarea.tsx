import { type Ref, type TextareaHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  ref?: Ref<HTMLTextAreaElement>;
}

export function Textarea({ className, ref, ...props }: TextareaProps) {
  return (
    <textarea
      ref={ref}
      className={cn(
        "w-full resize-none rounded-lg border border-border bg-transparent px-3 py-2 text-sm leading-relaxed text-foreground placeholder:text-muted/40 focus:border-accent focus:outline-none",
        className,
      )}
      {...props}
    />
  );
}
