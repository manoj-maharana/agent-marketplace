import { ArrowUp, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAgents } from "@/api/agents";
import { useConversations, useCreateConversation } from "@/api/chat";
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
 * A freeform entry point into chat that doesn't require picking an agent
 * first - backed by the "General Assistant" agent under the hood. Starting a
 * message here creates a conversation and hands off to the normal Chat page
 * (see the `initialMessage` navigation-state handoff in pages/Chat.tsx).
 */
export function GeneralChatHero() {
  const navigate = useNavigate();
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const agentsQuery = useAgents({ q: "General Assistant", page_size: 5 });
  const agent = useMemo(
    () =>
      agentsQuery.data?.items.find((a) => a.title === "General Assistant") ??
      agentsQuery.data?.items[0],
    [agentsQuery.data],
  );

  const conversationsQuery = useConversations(agent?.id);
  const createConversation = useCreateConversation();
  const recent = (conversationsQuery.data ?? []).slice(0, 4);

  function handleStart(content: string) {
    const trimmed = content.trim();
    if (!agent || !trimmed || submitting) return;
    setSubmitting(true);
    createConversation.mutate(agent.id, {
      onSuccess: (conv) => {
        navigate(`/chat/${agent.id}/${conv.id}`, { state: { initialMessage: trimmed } });
      },
      onSettled: () => setSubmitting(false),
    });
  }

  return (
    <section className="mb-10">
      <h1 className="text-2xl font-semibold tracking-tight">{getGreeting()}.</h1>
      <p className="mt-1 text-sm text-text-muted">Ask anything — no need to pick an agent first.</p>

      <div className="mt-5 flex flex-col gap-6 lg:flex-row">
        <div className="min-w-0 flex-1">
          <div className="flex items-end gap-3 rounded-2xl border border-border bg-surface-raised p-3 focus-within:border-accent">
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
              placeholder="Ask, summarize, brainstorm, or just say hi..."
              className="max-h-40 min-h-12 flex-1 resize-none border-none bg-transparent px-2 py-1.5 text-sm text-text placeholder:text-text-faint outline-none"
            />
            <button
              onClick={() => handleStart(value)}
              disabled={!value.trim() || submitting || !agent}
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
            >
              {submitting ? (
                <span className="size-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              ) : (
                <ArrowUp className="size-4" />
              )}
            </button>
          </div>

          {recent.length > 0 && (
            <div className="mt-6">
              <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-text-faint">
                Recent
              </h2>
              <div className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-surface">
                {recent.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => navigate(`/chat/${agent?.id}/${c.id}`)}
                    className="flex items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-hover"
                  >
                    <span className="truncate text-sm text-text">{c.title}</span>
                    <span className="shrink-0 text-xs text-text-faint">{timeAgo(c.updated_at)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="w-full shrink-0 lg:w-64">
          <div className="rounded-2xl border border-border bg-surface p-4">
            <div className="mb-3 flex items-center gap-1.5 text-xs font-medium text-text-faint">
              <Sparkles className="size-3.5 text-accent" />
              Try asking
            </div>
            <div className="flex flex-col gap-1">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => handleStart(s)}
                  disabled={submitting || !agent}
                  className="rounded-lg px-2.5 py-2 text-left text-xs text-text-muted transition-colors hover:bg-surface-hover hover:text-text disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
