import { cn } from "@/lib/cn";

interface AvatarProps {
  emoji: string;
  color: string;
  size?: number;
  className?: string;
  square?: boolean;
}

export function Avatar({ emoji, color, size = 40, className, square = true }: AvatarProps) {
  return (
    <div
      className={cn("flex shrink-0 items-center justify-center", square ? "rounded-xl" : "rounded-full", className)}
      style={{ width: size, height: size, background: `${color}26`, fontSize: size * 0.5 }}
    >
      {emoji}
    </div>
  );
}
