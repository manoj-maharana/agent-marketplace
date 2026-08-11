import { Moon, Sun } from "lucide-react";
import { useThemeStore } from "@/store/themeStore";

export function ThemeToggle() {
  const { theme, toggle } = useThemeStore();

  return (
    <button
      onClick={toggle}
      aria-label="Toggle theme"
      className="relative flex h-8 w-14 shrink-0 items-center rounded-full border border-border bg-surface-raised px-1 transition-colors hover:border-border-strong"
    >
      <span
        className="flex size-6 items-center justify-center rounded-full bg-accent text-white shadow-sm transition-transform duration-200"
        style={{ transform: theme === "dark" ? "translateX(22px)" : "translateX(0px)" }}
      >
        {theme === "dark" ? <Moon className="size-3.5" /> : <Sun className="size-3.5" />}
      </span>
    </button>
  );
}
