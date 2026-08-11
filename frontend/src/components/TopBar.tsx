import { User } from "lucide-react";

export function TopBar() {
  return (
    <header className="flex h-14 shrink-0 items-center justify-end border-b border-border bg-surface px-5">
      <button
        aria-label="Account"
        className="flex size-9 items-center justify-center rounded-full bg-surface-raised text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
      >
        <User className="size-4" />
      </button>
    </header>
  );
}
