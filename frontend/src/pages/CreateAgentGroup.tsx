import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAgents } from "@/api/agents";
import { useCreateAgentGroup } from "@/api/agentGroups";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Input, TextArea } from "@/components/ui/Input";
import { cn } from "@/lib/cn";
import type { AgentGroupMode } from "@/types";

const MODES: { value: AgentGroupMode; label: string; blurb: string }[] = [
  {
    value: "sequential",
    label: "Sequential",
    blurb: "Each member works in turn, building on the previous member's output.",
  },
  {
    value: "parallel",
    label: "Parallel",
    blurb: "All members tackle the same task independently, at the same time.",
  },
  {
    value: "iterative",
    label: "Iterative",
    blurb: "The first two members go back and forth for several rounds, refining the result.",
  },
  {
    value: "debate",
    label: "Debate",
    blurb: "Members argue different positions (advocate, critic, analyst); the Orchestrator mediates.",
  },
];

interface DraftMember {
  agentId: number;
  roleLabel: string;
}

export function CreateAgentGroup() {
  const navigate = useNavigate();
  const libraryQuery = useAgents({ scope: "library", page_size: 60 });
  const createGroup = useCreateAgentGroup();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [mode, setMode] = useState<AgentGroupMode>("sequential");
  const [iterations, setIterations] = useState(2);
  const [orchestratorPrompt, setOrchestratorPrompt] = useState("");
  const [members, setMembers] = useState<DraftMember[]>([]);

  const canSubmit = name.trim().length > 0 && members.length > 0 && !createGroup.isPending;

  function toggleMember(agentId: number) {
    setMembers((prev) =>
      prev.some((m) => m.agentId === agentId)
        ? prev.filter((m) => m.agentId !== agentId)
        : [...prev, { agentId, roleLabel: "" }],
    );
  }

  function setRoleLabel(agentId: number, roleLabel: string) {
    setMembers((prev) => prev.map((m) => (m.agentId === agentId ? { ...m, roleLabel } : m)));
  }

  function handleSubmit() {
    if (!canSubmit) return;
    createGroup.mutate(
      {
        name: name.trim(),
        description: description.trim(),
        mode,
        orchestrator_prompt: orchestratorPrompt.trim(),
        iterations,
        members: members.map((m) => ({
          agent_id: m.agentId,
          role_label: m.roleLabel.trim() || null,
        })),
      },
      { onSuccess: (group) => navigate(`/groups/${group.id}`) },
    );
  }

  return (
    <div className="mx-auto h-full max-w-3xl overflow-y-auto px-8 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">New Agent Group</h1>
      <p className="mt-1 text-sm text-text-muted">
        Bring a few of your agents together to work on the same task as a team.
      </p>

      <div className="mt-6 flex flex-col gap-6">
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Content Team" />
        </Field>

        <Field label="Description">
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is this team for?"
          />
        </Field>

        <Field label="Collaboration mode">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {MODES.map((m) => (
              <button
                key={m.value}
                onClick={() => setMode(m.value)}
                className={cn(
                  "rounded-xl border p-3 text-left transition-colors",
                  mode === m.value
                    ? "border-accent bg-accent-soft"
                    : "border-border hover:bg-surface-hover",
                )}
              >
                <div
                  className={cn(
                    "text-sm font-semibold",
                    mode === m.value ? "text-accent" : "text-text",
                  )}
                >
                  {m.label}
                </div>
                <div className="mt-0.5 text-xs text-text-muted">{m.blurb}</div>
              </button>
            ))}
          </div>
        </Field>

        {mode === "iterative" && (
          <Field label={`Rounds: ${iterations}`}>
            <input
              type="range"
              min={1}
              max={5}
              step={1}
              value={iterations}
              onChange={(e) => setIterations(Number(e.target.value))}
              className="w-full accent-accent"
            />
          </Field>
        )}

        <Field label="Orchestrator instructions (optional)">
          <TextArea
            value={orchestratorPrompt}
            onChange={(e) => setOrchestratorPrompt(e.target.value)}
            rows={3}
            placeholder="Leave blank to use the default: synthesize the team's contributions into one final answer."
          />
        </Field>

        <Field label="Members">
          {libraryQuery.data && libraryQuery.data.items.length === 0 ? (
            <p className="text-sm text-text-faint">
              Add or install some agents in your library first.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {(libraryQuery.data?.items ?? []).map((agent) => {
                const member = members.find((m) => m.agentId === agent.id);
                const checked = !!member;
                return (
                  <div key={agent.id} className="flex flex-col gap-2">
                    <label
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                        checked ? "border-accent bg-accent-soft" : "border-border hover:bg-surface-hover",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleMember(agent.id)}
                        className="accent-accent"
                      />
                      <Avatar emoji={agent.avatar_emoji} color={agent.avatar_color} size={24} />
                      <span className="truncate">{agent.title}</span>
                    </label>
                    {checked && (
                      <input
                        value={member.roleLabel}
                        onChange={(e) => setRoleLabel(agent.id, e.target.value)}
                        placeholder={
                          mode === "debate" ? "Role, e.g. advocate / critic / analyst" : "Role label (optional)"
                        }
                        className="ml-1 rounded-lg border border-border bg-transparent px-2.5 py-1.5 text-xs text-text placeholder:text-text-faint focus:border-accent focus:outline-none"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {members.length > 0 && (
            <p className="mt-2 text-xs text-text-faint">
              {members.length} member{members.length > 1 ? "s" : ""} selected, in the order you added them.
            </p>
          )}
        </Field>

        <div className="flex justify-end gap-3 pb-8">
          <Button variant="secondary" onClick={() => navigate("/groups")}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={createGroup.isPending} disabled={!canSubmit}>
            Create Group
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-text">{label}</label>
      {children}
    </div>
  );
}
