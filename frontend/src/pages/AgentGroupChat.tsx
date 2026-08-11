import { ArrowLeft, Sparkles, Users } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAgentGroup, useRunAgentGroup } from "@/api/agentGroups";
import { ApiError } from "@/api/client";
import { Composer } from "@/components/Composer";
import { Avatar } from "@/components/ui/Avatar";
import { Spinner } from "@/components/ui/Spinner";
import { Tag } from "@/components/ui/Tag";
import type { GroupRunResponse } from "@/types";

const MODE_LABEL: Record<string, string> = {
  sequential: "Sequential",
  parallel: "Parallel",
  iterative: "Iterative",
  debate: "Debate",
};

interface Turn {
  message: string;
  result?: GroupRunResponse;
  error?: string;
}

export function AgentGroupChat() {
  const { groupId } = useParams<{ groupId: string }>();
  const groupIdNum = groupId ? Number(groupId) : undefined;

  const groupQuery = useAgentGroup(groupIdNum);
  const runGroup = useRunAgentGroup(groupIdNum);

  const [turns, setTurns] = useState<Turn[]>([]);

  function handleSend(message: string) {
    setTurns((prev) => [...prev, { message }]);
    runGroup.mutate(message, {
      onSuccess: (result) => {
        setTurns((prev) => prev.map((t, i) => (i === prev.length - 1 ? { ...t, result } : t)));
      },
      onError: (err) => {
        const detail = err instanceof ApiError ? err.message : "Something went wrong running the group.";
        setTurns((prev) => prev.map((t, i) => (i === prev.length - 1 ? { ...t, error: detail } : t)));
      },
    });
  }

  if (!groupIdNum) return null;

  if (groupQuery.isLoading || !groupQuery.data) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    );
  }

  const group = groupQuery.data;

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-border px-6 py-4">
        <Link
          to="/groups"
          className="flex size-9 shrink-0 items-center justify-center rounded-xl text-text-faint transition-colors hover:bg-surface-hover hover:text-text"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface-raised text-accent">
          <Users className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-text">{group.name}</h2>
          <p className="text-xs text-text-faint">
            {group.members.map((m) => m.agent.title).join(" -> ")}
          </p>
        </div>
        <Tag tone="accent">{MODE_LABEL[group.mode] ?? group.mode}</Tag>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        {turns.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <div className="flex -space-x-2">
              {group.members.map((m) => (
                <Avatar
                  key={m.id}
                  emoji={m.agent.avatar_emoji}
                  color={m.agent.avatar_color}
                  size={40}
                  className="ring-2 ring-surface"
                />
              ))}
            </div>
            <p className="max-w-sm text-sm text-text-muted">
              {group.description || "Give this team a task and see how each member contributes."}
            </p>
          </div>
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col gap-6">
            {turns.map((turn, i) => (
              <TurnView key={i} turn={turn} running={runGroup.isPending && i === turns.length - 1} />
            ))}
          </div>
        )}
      </div>

      <Composer
        onSend={handleSend}
        onStop={() => {}}
        isStreaming={runGroup.isPending}
        placeholder={`Give ${group.name} a task...`}
      />
    </div>
  );
}

function TurnView({ turn, running }: { turn: Turn; running: boolean }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="ml-auto max-w-[80%] rounded-2xl bg-accent px-4 py-2.5 text-sm text-white">
        {turn.message}
      </div>

      {running && (
        <div className="flex items-center gap-2 text-sm text-text-faint">
          <Spinner className="size-4" />
          Team is working on it...
        </div>
      )}

      {turn.error && (
        <div className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {turn.error}
        </div>
      )}

      {turn.result && (
        <div className="flex flex-col gap-3">
          {turn.result.contributions.map((c, i) => (
            <div key={i} className="rounded-2xl border border-border bg-surface-raised px-4 py-3">
              <div className="mb-1.5 flex items-center gap-2 text-xs font-medium text-text-faint">
                <span className="text-text">{c.agent_name}</span>
                {c.role_label && <Tag tone="default">{c.role_label}</Tag>}
                {c.round > 1 && <span>round {c.round}</span>}
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-text">{c.content}</p>
            </div>
          ))}

          <div className="rounded-2xl border border-accent/30 bg-accent-soft px-4 py-3">
            <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-accent">
              <Sparkles className="size-3.5" />
              Orchestrator summary
            </div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-text">{turn.result.summary}</p>
          </div>
        </div>
      )}
    </div>
  );
}
