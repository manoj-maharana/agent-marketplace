import { cn } from "@/lib/cn";
import type { Category } from "@/types";

interface CategoryRailProps {
  categories: Category[];
  active: string | undefined;
  onSelect: (slug: string | undefined) => void;
  counts?: Record<string, number>;
}

export function CategoryRail({ categories, active, onSelect }: CategoryRailProps) {
  return (
    <div className="flex w-52 shrink-0 flex-col gap-0.5">
      <RailButton label="All" active={active === undefined} onClick={() => onSelect(undefined)} />
      {categories.map((c) => (
        <RailButton
          key={c.slug}
          label={c.name}
          active={active === c.slug}
          onClick={() => onSelect(c.slug)}
        />
      ))}
    </div>
  );
}

function RailButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors",
        active ? "bg-accent-soft text-accent" : "text-text-muted hover:bg-surface-hover hover:text-text",
      )}
    >
      {label}
    </button>
  );
}
