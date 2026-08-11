import { Clock, Plug, Users } from "lucide-react";
import { useParams } from "react-router-dom";
import { useMcpServer } from "@/api/mcp";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { Tag } from "@/components/ui/Tag";
import { timeAgo } from "@/lib/format";

export function McpDetail() {
  const { mcpId } = useParams<{ mcpId: string }>();
  const id = mcpId ? Number(mcpId) : undefined;
  const serverQuery = useMcpServer(id);

  if (serverQuery.isLoading || !serverQuery.data) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    );
  }

  const server = serverQuery.data;

  return (
    <div className="mx-auto h-full max-w-3xl overflow-y-auto px-8 py-10">
      <div className="flex items-start gap-5">
        <div className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-surface-raised text-2xl">
          {server.icon}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight text-text">{server.name}</h1>
          <p className="mt-1 text-sm text-text-muted">by {server.author}</p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-4 text-sm text-text-faint">
        {server.category && <Tag tone="accent">{server.category.name}</Tag>}
        {server.is_functional && <Tag tone="success">Live</Tag>}
        <span className="flex items-center gap-1.5">
          <Clock className="size-3.5" />
          Added {timeAgo(server.created_at)}
        </span>
        <span className="flex items-center gap-1.5">
          <Plug className="size-3.5" />
          {server.transport} transport
        </span>
        <span className="flex items-center gap-1.5">
          <Users className="size-3.5" />
          {server.install_count} installs
        </span>
      </div>

      <Card className="mt-6 p-5">
        <h2 className="mb-2 text-sm font-semibold text-text">About this server</h2>
        <p className="text-[15px] leading-relaxed text-text-muted">{server.description}</p>
      </Card>

      <Card className="mt-4 p-5">
        <h2 className="mb-2 text-sm font-semibold text-text">Connection</h2>
        <p className="text-sm leading-relaxed text-text-muted">
          This is a <strong className="text-text">{server.transport}</strong> MCP server. Local
          servers run on your machine; remote servers connect over the network; hybrid servers can do
          either depending on configuration.
        </p>
      </Card>
    </div>
  );
}
