import { Check, Clock, Plus, Puzzle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Tag } from "@/components/ui/Tag";
import { timeAgo } from "@/lib/format";
import type { Agent } from "@/types";

interface AgentCardProps {
  agent: Agent;
  onInstall: (id: number) => void;
  installing?: boolean;
}

export function AgentCard({ agent, onInstall, installing }: AgentCardProps) {
  const navigate = useNavigate();

  return (
    <Card
      className="group flex cursor-pointer flex-col overflow-hidden hover:border-border-strong hover:shadow-sm"
      onClick={() => navigate(`/agents/${agent.id}`)}
    >
      <div className="flex items-start justify-between gap-3 p-4 pb-0">
        <div className="flex min-w-0 items-start gap-3">
          <Avatar emoji={agent.avatar_emoji} color={agent.avatar_color} size={40} />
          <div className="min-w-0">
            <h3 className="truncate text-[15px] font-semibold text-text group-hover:text-accent">
              {agent.title}
            </h3>
            <p className="truncate text-xs text-text-faint">{agent.author}</p>
          </div>
        </div>
      </div>

      <p className="line-clamp-3 px-4 pb-3 pt-3 text-sm leading-relaxed text-text-muted">
        {agent.description}
      </p>

      {agent.skills.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-4 pb-3">
          {agent.skills.slice(0, 3).map((s) => (
            <Tag key={s.id} tone="muted">
              <Puzzle className="size-3" />
              {s.name}
            </Tag>
          ))}
          {agent.skills.length > 3 && <Tag tone="muted">+{agent.skills.length - 3}</Tag>}
        </div>
      )}

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-border px-4 py-3">
        <div className="flex items-center gap-3 overflow-hidden text-xs text-text-faint">
          {agent.category && <Tag tone="accent">{agent.category.name}</Tag>}
          <span className="flex shrink-0 items-center gap-1">
            <Clock className="size-3" />
            {timeAgo(agent.updated_at)}
          </span>
        </div>
        <Button
          variant={agent.is_installed ? "secondary" : "primary"}
          size="sm"
          loading={installing}
          icon={agent.is_installed ? <Check className="size-3.5" /> : <Plus className="size-3.5" />}
          onClick={(e) => {
            e.stopPropagation();
            if (agent.is_installed) navigate(`/chat/${agent.id}`);
            else onInstall(agent.id);
          }}
        >
          {agent.is_installed ? "Open" : "Add"}
        </Button>
      </div>
    </Card>
  );
}
