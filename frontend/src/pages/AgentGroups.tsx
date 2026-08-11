import { Plus, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { useAgentGroups } from "@/api/agentGroups";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { Tag } from "@/components/ui/Tag";

const MODE_LABEL: Record<string, string> = {
  sequential: "Sequential",
  parallel: "Parallel",
  iterative: "Iterative",
  debate: "Debate",
};

export function AgentGroups() {
  const groupsQuery = useAgentGroups();

  return (
    <div className="mx-auto h-full max-w-6xl overflow-y-auto px-8 py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Agent Groups</h1>
          <p className="mt-1 text-sm text-text-muted">
            Teams of your agents that collaborate on a task, with a built-in Orchestrator that
            synthesizes their work into one answer.
          </p>
        </div>
        <Link to="/groups/new">
          <Button icon={<Plus className="size-4" />}>New Group</Button>
        </Link>
      </div>

      {groupsQuery.isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Spinner />
        </div>
      ) : groupsQuery.data && groupsQuery.data.items.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {groupsQuery.data.items.map((group) => (
            <Link key={group.id} to={`/groups/${group.id}`}>
              <Card className="flex h-full flex-col gap-3 p-4 hover:border-border-strong hover:shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-raised text-accent">
                      <Users className="size-4" />
                    </div>
                    <div>
                      <h3 className="text-[15px] font-semibold text-text">{group.name}</h3>
                      <p className="text-xs text-text-faint">
                        {group.members.length} member{group.members.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                  <Tag tone="accent">{MODE_LABEL[group.mode] ?? group.mode}</Tag>
                </div>

                {group.description && (
                  <p className="line-clamp-2 text-sm leading-relaxed text-text-muted">
                    {group.description}
                  </p>
                )}

                <div className="mt-auto flex -space-x-2 pt-1">
                  {group.members.slice(0, 5).map((m) => (
                    <Avatar
                      key={m.id}
                      emoji={m.agent.avatar_emoji}
                      color={m.agent.avatar_color}
                      size={28}
                      className="ring-2 ring-surface"
                    />
                  ))}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <div className="flex h-64 flex-col items-center justify-center text-center text-text-muted">
          <p className="font-medium text-text">No agent groups yet</p>
          <p className="mt-1 text-sm">Create one to have a few agents work on a task together.</p>
          <Link to="/groups/new" className="mt-4">
            <Button icon={<Plus className="size-4" />}>New Group</Button>
          </Link>
        </div>
      )}
    </div>
  );
}
