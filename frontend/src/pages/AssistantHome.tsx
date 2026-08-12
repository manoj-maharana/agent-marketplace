import { ArrowUp, RefreshCw, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAgents } from "@/api/agents";
import { useAllConversations, useCreateConversation } from "@/api/chat";
import { AssistantSidebar } from "@/components/AssistantSidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { timeAgo } from "@/lib/format";

const SUGGESTIONS = [
  "Summarize a long article into key points",
  "Draft a polite follow-up email",
  "Explain a tricky concept simply",
  "Brainstorm names for a new project",
];

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/**
 * Standalone, chat-first home page (own sidebar, not wrapped by the
 * marketplace app shell) - the freeform entry point linked from the landing
 * page's "Open Assistant" card.
 */
export function AssistantHome() {
  const navigate = useNavigate();
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [suggestionSeed, setSuggestionSeed] = useState(0);
  const [selectedAgentId, setSelectedAgentId] = useState<number | "">("");

  const agentsQuery = useAgents({ scope: "library", page_size: 20 });
  const agents = agentsQuery.data?.items ?? [];

  const activeAgent = useMemo(() => {
    if (selectedAgentId !== "") return agents.find((a) => a.id === selectedAgentId);
    return agents.find((a) => a.title === "General Assistant") ?? agents[0];
  }, [agents, selectedAgentId]);

  const createConversation = useCreateConversation();
  const conversationsQuery = useAllConversations();
  const recent = (conversationsQuery.data ?? []).slice(0, 6);

  const shuffledSuggestions = useMemo(() => {
    const arr = [...SUGGESTIONS];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = (i + suggestionSeed) % (i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, [suggestionSeed]);

  function handleStart(content: string) {
    const trimmed = content.trim();
    if (!activeAgent || !trimmed || submitting) return;
    setSubmitting(true);
    createConversation.mutate(activeAgent.id, {
      onSuccess: (conv) => {
        navigate(`/chat/${activeAgent.id}/${conv.id}`, { state: { initialMessage: trimmed } });
      },
      onSettled: () => setSubmitting(false),
    });
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg text-text">
      <AssistantSidebar />
      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <div className="flex justify-end px-6 py-4">
          <ThemeToggle />
        </div>

        <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-6 pb-12">
          <h1 className="text-2xl font-semibold tracking-tight">{getGreeting()}.</h1>
          <p className="mt-1 text-sm text-text-muted">What would you like to work on?</p>

          <div className="mt-6 flex flex-col gap-6 lg:flex-row">
            <div className="min-w-0 flex-1">
              <div className="rounded-2xl border border-border bg-surface-raised p-3 focus-within:border-accent">
                <textarea
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleStart(value);
                    }
                  }}
                  rows={2}
                  placeholder="Ask, create, or start a task..."
                  className="max-h-40 min-h-12 w-full resize-none border-none bg-transparent px-2 py-1.5 text-sm text-text placeholder:text-text-faint outline-none"
                />
                <div className="mt-2 flex items-center justify-between gap-2 border-t border-border px-1 pt-2">
                  <select
                    value={activeAgent?.id ?? ""}
                    onChange={(e) => setSelectedAgentId(e.target.value ? Number(e.target.value) : "")}
                    className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-text-muted outline-none"
                  >
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.avatar_emoji} {a.title}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => handleStart(value)}
                    disabled={!value.trim() || submitting || !activeAgent}
                    className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
                  >
                    {submitting ? (
                      <span className="size-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    ) : (
                      <ArrowUp className="size-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="mt-8">
                <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-text-faint">
                  Recent topics{recent.length > 0 ? ` · ${recent.length}` : ""}
                </h2>
                {recent.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-border px-4 py-6 text-center text-sm text-text-faint">
                    No conversations yet — start one above.
                  </p>
                ) : (
                  <div className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-surface">
                    {recent.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => navigate(`/chat/${c.agent_id}/${c.id}`)}
                        className="flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-hover"
                      >
                        <span
                          className="flex size-7 shrink-0 items-center justify-center rounded-lg text-sm"
                          style={{ background: `${c.agent.avatar_color}26` }}
                        >
                          {c.agent.avatar_emoji}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm text-text">{c.title}</span>
                        <span className="shrink-0 text-xs text-text-faint">{timeAgo(c.updated_at)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="w-full shrink-0 lg:w-64">
              <div className="rounded-2xl border border-border bg-surface p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-text-faint">
                    <Sparkles className="size-3.5 text-accent" />
                    Suggestions
                  </div>
                  <button
                    onClick={() => setSuggestionSeed((s) => s + 1)}
                    aria-label="Shuffle suggestions"
                    className="text-text-faint transition-colors hover:text-text"
                  >
                    <RefreshCw className="size-3.5" />
                  </button>
                </div>
                <div className="flex flex-col gap-1">
                  {shuffledSuggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => handleStart(s)}
                      disabled={submitting || !activeAgent}
                      className="rounded-lg px-2.5 py-2 text-left text-xs text-text-muted transition-colors hover:bg-surface-hover hover:text-text disabled:opacity-50"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
