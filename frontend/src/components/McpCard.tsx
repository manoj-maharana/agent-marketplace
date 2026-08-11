import { Plug, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/Card";
import { Tag } from "@/components/ui/Tag";
import type { McpServer } from "@/types";

export function McpCard({ server }: { server: McpServer }) {
  return (
    <Link to={`/mcp/${server.id}`}>
      <Card className="flex h-full flex-col gap-3 p-4 hover:border-border-strong hover:shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-raised text-lg">
              {server.icon}
            </div>
            <div>
              <h3 className="text-[15px] font-semibold text-text">{server.name}</h3>
              <p className="text-xs text-text-faint">{server.author}</p>
            </div>
          </div>
          {server.is_functional && (
            <Tag tone="success">
              <Zap className="size-3" />
              Live
            </Tag>
          )}
        </div>

        <p className="line-clamp-2 text-sm leading-relaxed text-text-muted">{server.description}</p>

        <div className="mt-auto flex items-center gap-3 pt-1">
          {server.category && <Tag tone="accent">{server.category.name}</Tag>}
          <span className="flex items-center gap-1 text-xs text-text-faint">
            <Plug className="size-3" />
            {server.transport}
          </span>
        </div>
      </Card>
    </Link>
  );
}
