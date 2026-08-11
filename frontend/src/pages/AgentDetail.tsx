import {
  Check,
  Clock,
  GitFork,
  MessageCircle,
  Pencil,
  Plus,
  Puzzle,
  Users,
} from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAgent, useAgents, useForkAgent, useInstallAgent } from "@/api/agents";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { Tag } from "@/components/ui/Tag";
import { cn } from "@/lib/cn";
import { timeAgo } from "@/lib/format";

const STARTER_PROMPTS = ["What can you help me with?", "Give me an example of how you'd help."];

const TABS = ["Overview", "Agent Profile", "Agent Capabilities", "Version History", "Similar Agents"] as const;
type Tab = (typeof TABS)[number];

export function AgentDetail() {
  const { agentId } = useParams<{ agentId: string }>();
  const id = agentId ? Number(agentId) : undefined;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tabFromUrl = searchParams.get("tab");
  const initialTab: Tab = (TABS as readonly string[]).includes(tabFromUrl ?? "")
    ? (tabFromUrl as Tab)
    : "Overview";
  const [tab, setTab] = useState<Tab>(initialTab);

  const agentQuery = useAgent(id);
  const install = useInstallAgent();
  const fork = useForkAgent();

  const relatedQuery = useAgents({
    category: agentQuery.data?.category?.slug,
    page_size: 5,
  });

  if (agentQuery.isLoading || !agentQuery.data) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    );
  }

  const agent = agentQuery.data;
  const related = (relatedQuery.data?.items ?? []).filter((a) => a.id !== agent.id).slice(0, 4);

  function goToChat() {
    navigate(`/chat/${agent.id}`);
  }

  function handlePrimaryAction() {
    if (agent.is_installed) goToChat();
    else install.mutate(agent.id, { onSuccess: goToChat });
  }

  return (
    <div className="mx-auto h-full max-w-3xl overflow-y-auto px-8 py-10">
      <div className="flex items-start gap-5">
        <Avatar emoji={agent.avatar_emoji} color={agent.avatar_color} size={64} />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight text-text">{agent.title}</h1>
          <p className="mt-1 text-sm text-text-muted">by {agent.author}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {agent.is_custom ? (
            <Button
              variant="secondary"
              icon={<Pencil className="size-3.5" />}
              onClick={() => navigate(`/agents/${agent.id}/edit`)}
            >
              Edit
            </Button>
          ) : (
            <Button
              variant="secondary"
              icon={<GitFork className="size-3.5" />}
              loading={fork.isPending}
              onClick={() =>
                fork.mutate(agent.id, {
                  onSuccess: (forked) => navigate(`/agents/${forked.id}/edit`),
                })
              }
            >
              Fork
            </Button>
          )}
          <Button
            variant={agent.is_installed ? "secondary" : "primary"}
            icon={agent.is_installed ? <Check className="size-4" /> : <Plus className="size-4" />}
            loading={install.isPending}
            onClick={handlePrimaryAction}
          >
            {agent.is_installed ? "Open Chat" : "Fork & Chat"}
          </Button>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-4 text-sm text-text-faint">
        {agent.category && <Tag tone="accent">{agent.category.name}</Tag>}
        <span className="flex items-center gap-1.5">
          <Clock className="size-3.5" />
          Updated {timeAgo(agent.updated_at)}
        </span>
        <span className="flex items-center gap-1.5">
          <Users className="size-3.5" />
          {agent.install_count} added
        </span>
      </div>

      <div className="mt-6 flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
              tab === t
                ? "border-accent text-accent"
                : "border-transparent text-text-muted hover:text-text",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="pt-5 pb-10">
        {tab === "Overview" && (
          <div className="flex flex-col gap-4">
            <Card className="p-5">
              <h2 className="mb-2 text-sm font-semibold text-text">About this agent</h2>
              <p className="text-[15px] leading-relaxed text-text-muted">{agent.description}</p>
            </Card>
            <Card className="p-5">
              <h2 className="mb-3 text-sm font-semibold text-text">Try asking</h2>
              <div className="flex flex-col gap-2">
                {STARTER_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={handlePrimaryAction}
                    className="flex items-center gap-2 rounded-lg border border-border px-3 py-2.5 text-left text-sm text-text-muted transition-colors hover:border-accent hover:text-text"
                  >
                    <MessageCircle className="size-3.5 shrink-0 text-text-faint" />
                    {prompt}
                  </button>
                ))}
              </div>
            </Card>
          </div>
        )}

        {tab === "Agent Profile" && (
          <Card className="divide-y divide-border p-0">
            <ProfileRow label="Author" value={agent.author} />
            <ProfileRow label="Category" value={agent.category?.name ?? "Uncategorized"} />
            <ProfileRow label="Type" value={agent.is_custom ? "Custom agent" : "Marketplace agent"} />
            <ProfileRow label="Temperature" value={agent.temperature.toFixed(1)} />
            <ProfileRow label="Times added" value={String(agent.install_count)} />
            <ProfileRow label="Created" value={new Date(agent.created_at).toLocaleDateString()} />
            <ProfileRow label="Last updated" value={new Date(agent.updated_at).toLocaleDateString()} />
          </Card>
        )}

        {tab === "Agent Capabilities" && (
          <Card className="p-5">
            <h2 className="mb-3 text-sm font-semibold text-text">Skills it can use</h2>
            {agent.skills.length > 0 ? (
              <div className="flex flex-col gap-2">
                {agent.skills.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5"
                  >
                    <span className="text-lg">{s.icon}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-text">{s.name}</p>
                      <p className="truncate text-xs text-text-faint">{s.description}</p>
                    </div>
                    {s.is_functional && <Tag tone="success">Live</Tag>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="flex items-center gap-2 text-sm text-text-faint">
                <Puzzle className="size-4" />
                This agent doesn't use any skills — it relies on the model alone.
              </p>
            )}
          </Card>
        )}

        {tab === "Version History" && (
          <Card className="p-5">
            <h2 className="mb-3 text-sm font-semibold text-text">Version history</h2>
            <div className="flex flex-col gap-4">
              {agent.updated_at !== agent.created_at && (
                <TimelineEntry
                  title="Latest update"
                  date={new Date(agent.updated_at).toLocaleString()}
                  description="Persona, skills, or settings were last changed here."
                />
              )}
              <TimelineEntry
                title="v1.0 — Initial release"
                date={new Date(agent.created_at).toLocaleString()}
                description={agent.is_custom ? "You created this agent." : "Published to the marketplace."}
              />
            </div>
          </Card>
        )}

        {tab === "Similar Agents" && (
          <>
            {related.length > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                {related.map((r) => (
                  <Card
                    key={r.id}
                    className="cursor-pointer p-3 hover:border-border-strong"
                    onClick={() => navigate(`/agents/${r.id}`)}
                  >
                    <div className="flex items-center gap-2.5">
                      <Avatar emoji={r.avatar_emoji} color={r.avatar_color} size={32} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-text">{r.title}</p>
                        <p className="line-clamp-1 text-xs text-text-faint">{r.description}</p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <p className="text-sm text-text-faint">No similar agents found in this category.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-5 py-3 text-sm">
      <span className="text-text-faint">{label}</span>
      <span className="font-medium text-text">{value}</span>
    </div>
  );
}

function TimelineEntry({
  title,
  date,
  description,
}: {
  title: string;
  date: string;
  description: string;
}) {
  return (
    <div className="flex gap-3">
      <div className="mt-1.5 size-2 shrink-0 rounded-full bg-accent" />
      <div>
        <p className="text-sm font-medium text-text">{title}</p>
        <p className="text-xs text-text-faint">{date}</p>
        <p className="mt-1 text-sm text-text-muted">{description}</p>
      </div>
    </div>
  );
}
