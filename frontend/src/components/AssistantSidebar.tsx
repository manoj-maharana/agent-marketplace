import { Bell, LayoutGrid, Plug, Plus, Puzzle, Search, Sparkles, Users } from "lucide-react";
import { Link, NavLink } from "react-router-dom";
import { useAgents } from "@/api/agents";
import { cn } from "@/lib/cn";

const TOP_NAV = [
  { to: "/assistant", label: "Home", icon: Sparkles },
  { to: "/home", label: "Marketplace", icon: LayoutGrid },
  { to: "/skills", label: "Skills", icon: Puzzle },
  { to: "/mcp", label: "MCP", icon: Plug },
];

/**
 * Sidebar for the standalone chat-first assistant home page. Deliberately
 * separate from components/Sidebar.tsx (the marketplace app shell's nav) -
 * this page has its own layout and isn't wrapped by App.tsx's shell.
 */
export function AssistantSidebar() {
  const agentsQuery = useAgents({ scope: "library", page_size: 6 });
  const agents = agentsQuery.data?.items ?? [];

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col overflow-y-auto border-r border-border bg-surface px-3 py-4">
      <div className="flex items-center justify-between gap-2 px-2 pb-4">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-accent text-white">
            <Sparkles className="size-4" />
          </div>
          <span className="text-[15px] font-semibold tracking-tight">Assistant</span>
        </Link>
        <button
          aria-label="Notifications"
          className="flex size-8 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
        >
          <Bell className="size-4" />
        </button>
      </div>

      <button className="mb-4 flex items-center gap-2 rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-text-faint transition-colors hover:border-border-strong">
        <Search className="size-4" />
        Search
      </button>

      <nav className="flex flex-col gap-1">
        {TOP_NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end
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
      </nav>

      <div className="mt-5 px-2">
        <span className="text-xs font-medium uppercase tracking-wide text-text-faint">Agents</span>
      </div>
      <div className="mt-1 flex flex-col gap-0.5">
        {agents.map((agent) => (
          <Link
            key={agent.id}
            to={`/chat/${agent.id}`}
            className="flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-[13px] text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
          >
            <span
              className="flex size-5 shrink-0 items-center justify-center rounded-md text-xs"
              style={{ background: `${agent.avatar_color}26` }}
            >
              {agent.avatar_emoji}
            </span>
            <span className="truncate">{agent.title}</span>
          </Link>
        ))}
        <Link
          to="/agents/new"
          className="flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-[13px] text-text-faint transition-colors hover:bg-surface-hover hover:text-text"
        >
          <Plus className="size-3.5" />
          Add Agent
        </Link>
      </div>

      <div className="mt-5 flex flex-col gap-1 border-t border-border pt-4">
        <NavLink
          to="/groups"
          className={({ isActive }) =>
            cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-accent-soft text-accent"
                : "text-text-muted hover:bg-surface-hover hover:text-text",
            )
          }
        >
          <Users className="size-4" />
          Agent Groups
        </NavLink>
      </div>

      <div className="mt-auto flex flex-col gap-2 px-1 pt-4">
        <Link
          to="/"
          className="rounded-lg border border-border px-3 py-2 text-center text-xs font-medium text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
        >
          ← Back to landing
        </Link>
        <p className="px-1 text-center text-xs text-text-faint">Created and developed with ❤️ by Manoj Maharana</p>
      </div>
    </aside>
  );
}
