import { Compass } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/cn";
import type { Agent } from "@/types";

interface ChatSidebarProps {
  agents: Agent[];
  activeAgentId: number | undefined;
  isLoading: boolean;
}

export function ChatSidebar({ agents, activeAgentId, isLoading }: ChatSidebarProps) {
  const navigate = useNavigate();

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-border">
      <div className="border-b border-border px-4 py-4">
        <h2 className="text-sm font-semibold text-text">My Agents</h2>
        <p className="mt-0.5 text-xs text-text-faint">Installed and custom agents you can chat with</p>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <div className="space-y-2 p-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-xl bg-surface-raised" />
            ))}
          </div>
        ) : agents.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
            <Compass className="size-6 text-text-faint" />
            <p className="text-sm text-text-muted">
              You haven't added any agents yet. Browse the marketplace to get started.
            </p>
            <Link
              to="/agents"
              className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-hover"
            >
              Browse agents
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {agents.map((agent) => (
              <button
                key={agent.id}
                onClick={() => navigate(`/chat/${agent.id}`)}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors",
                  activeAgentId === agent.id ? "bg-accent-soft" : "hover:bg-surface-hover",
                )}
              >
                <Avatar emoji={agent.avatar_emoji} color={agent.avatar_color} size={34} />
                <div className="min-w-0">
                  <p
                    className={cn(
                      "truncate text-sm font-medium",
                      activeAgentId === agent.id ? "text-accent" : "text-text",
                    )}
                  >
                    {agent.title}
                  </p>
                  <p className="truncate text-xs text-text-faint">
                    {agent.is_custom ? "Custom" : agent.category?.name ?? "Agent"}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
