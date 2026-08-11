import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Tone = "default" | "accent" | "success" | "muted";

const toneClasses: Record<Tone, string> = {
  default: "bg-surface-raised text-text-muted border-border",
  accent: "bg-accent-soft text-accent border-accent/30",
  success: "bg-success/10 text-success border-success/30",
  muted: "bg-transparent text-text-faint border-border",
};

interface TagProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

export function Tag({ tone = "default", className, ...props }: TagProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        toneClasses[tone],
        className,
      )}
      {...props}
    />
  );
}
