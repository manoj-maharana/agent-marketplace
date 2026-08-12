import { Home, LayoutGrid, Plug, Plus, Puzzle, Sparkles, Users } from "lucide-react";
import { NavLink } from "react-router-dom";
import { ThemeToggle } from "@/components/ThemeToggle";
import { cn } from "@/lib/cn";

const NAV_ITEMS = [
  { to: "/home", label: "Home", icon: Home },
  { to: "/agents", label: "Agents", icon: LayoutGrid },
  { to: "/skills", label: "Skills", icon: Puzzle },
  { to: "/mcp", label: "MCP", icon: Plug },
];

export function Sidebar() {
  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-border bg-surface px-3 py-4">
      <div className="flex items-center justify-between gap-2 px-2 pb-6">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-accent text-white">
            <Sparkles className="size-4" />
          </div>
          <span className="text-[15px] font-semibold tracking-tight">Agent Marketplace</span>
        </div>
      </div>
      <div className="mb-4 flex items-center justify-between px-2">
        <span className="text-xs font-medium uppercase tracking-wide text-text-faint">Theme</span>
        <ThemeToggle />
      </div>

      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-accent-soft text-accent"
                  : "text-text-muted hover:bg-surface-hover hover:text-text",
              )
            }
          >
            <Icon className="size-4" />
            {label}
          </NavLink>
        ))}

        <NavLink
          to="/groups"
          className={({ isActive }) =>
            cn(
              "ml-6 flex items-center gap-2 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors",
              isActive
                ? "bg-accent-soft text-accent"
                : "text-text-faint hover:bg-surface-hover hover:text-text",
            )
          }
        >
          <Users className="size-3.5" />
          Groups
        </NavLink>
      </nav>

      <div className="mt-auto flex flex-col gap-2 px-1">
        <NavLink
          to="/agents/new"
          className="flex items-center justify-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
        >
          <Plus className="size-4" />
          New Agent
        </NavLink>
        <NavLink
          to="/groups/new"
          className="flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-text transition-colors hover:bg-surface-hover"
        >
          <Users className="size-4" />
          New Group
        </NavLink>
        <p className="px-1 text-center text-xs text-text-faint">Created and developed with ❤️ by Manoj Maharana</p>
      </div>
    </aside>
  );
}
