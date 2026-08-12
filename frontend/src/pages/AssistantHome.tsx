import { ArrowUp, MessagesSquare, Plus, RefreshCw, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  streamAssistantMessage,
  useAssistantMessages,
  useAssistantThreads,
  useCreateAssistantThread,
  useDeleteAssistantThread,
} from "@/api/assistant";
import { AssistantSidebar } from "@/components/AssistantSidebar";
import { DelegationTrace, type DelegationAgentState } from "@/components/chat/DelegationTrace";
import { LoadingIndicator } from "@/components/chat/LoadingIndicator";
import { StreamingMessage } from "@/components/chat/StreamingMessage";
import { MarkdownContent } from "@/components/MarkdownContent";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Spinner } from "@/components/ui/Spinner";
import { timeAgo } from "@/lib/format";
import type { AssistantRouting } from "@/types";

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
 * page's "Open Assistant" card. Freeform messages are routed by an LLM to
 * one or more of the user's library agents (see backend
 * app/framework/assistant_router.py) rather than requiring a manual agent
 * pick first.
 */
export function AssistantHome() {
  const [activeThreadId, setActiveThreadId] = useState<number | null>(null);
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [suggestionSeed, setSuggestionSeed] = useState(0);

  const [optimisticUser, setOptimisticUser] = useState<string | null>(null);
  const [routeInfo, setRouteInfo] = useState<{
    mode: "single" | "parallel" | "sequential";
    reason: string;
  } | null>(null);
  const [agentStates, setAgentStates] = useState<Record<number, DelegationAgentState>>({});
  const [finalText, setFinalText] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const threadsQuery = useAssistantThreads();
  const messagesQuery = useAssistantMessages(activeThreadId ?? undefined);
  const createThread = useCreateAssistantThread();
  const deleteThread = useDeleteAssistantThread();

  const isStreaming = submitting;
  const singleAgentState = routeInfo?.mode === "single" ? Object.values(agentStates)[0] : undefined;
  const liveAnswer = finalText ?? singleAgentState?.content ?? "";

  const shuffledSuggestions = useMemo(() => {
    const arr = [...SUGGESTIONS];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = (i + suggestionSeed) % (i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, [suggestionSeed]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messagesQuery.data, optimisticUser, liveAnswer, agentStates]);

  async function handleStart(content: string) {
    const trimmed = content.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    setOptimisticUser(trimmed);
    setRouteInfo(null);
    setAgentStates({});
    setFinalText("");
    setValue("");

    let threadId = activeThreadId;
    if (!threadId) {
      const thread = await createThread.mutateAsync();
      threadId = thread.id;
      setActiveThreadId(threadId);
    }

    const controller = new AbortController();
    abortRef.current = controller;

    await streamAssistantMessage(
      threadId,
      trimmed,
      (event) => {
        if (event.type === "route") {
          setRouteInfo({ mode: event.mode, reason: event.reason });
          setAgentStates(
            Object.fromEntries(
              event.agents.map((a) => [a.id, { agentId: a.id, title: a.title, content: "", done: false }]),
            ),
          );
        } else if (event.type === "agent_token") {
          setAgentStates((prev) => ({
            ...prev,
            [event.agent_id]: {
              ...prev[event.agent_id],
              content: (prev[event.agent_id]?.content ?? "") + event.content,
            },
          }));
        } else if (event.type === "agent_done") {
          setAgentStates((prev) => ({
            ...prev,
            [event.agent_id]: { ...prev[event.agent_id], content: event.content, done: true },
          }));
        } else if (event.type === "token") {
          setFinalText((prev) => (prev ?? "") + event.content);
        } else if (event.type === "done") {
          setFinalText(event.content);
        } else if (event.type === "error") {
          setFinalText((prev) => (prev ? `${prev}\n\n⚠️ ${event.message}` : `⚠️ ${event.message}`));
        }
      },
      controller.signal,
    );

    setSubmitting(false);
    setOptimisticUser(null);
    setRouteInfo(null);
    setAgentStates({});
    setFinalText(null);
    messagesQuery.refetch();
    threadsQuery.refetch();
  }

  function handleNewThread() {
    setActiveThreadId(null);
    setOptimisticUser(null);
    setRouteInfo(null);
    setAgentStates({});
    setFinalText(null);
  }

  function handleDeleteThread(id: number) {
    deleteThread.mutate(id, {
      onSuccess: () => {
        if (id === activeThreadId) handleNewThread();
      },
    });
  }

  const threads = threadsQuery.data ?? [];
  const hasActiveThread = activeThreadId !== null;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg text-text">
      <AssistantSidebar />
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4">
          {hasActiveThread ? (
            <button
              onClick={handleNewThread}
              className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
            >
              <Plus className="size-4" />
              New
            </button>
          ) : (
            <span />
          )}
          <ThemeToggle />
        </div>

        {!hasActiveThread ? (
          <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col overflow-y-auto px-6 pb-12">
            <h1 className="text-2xl font-semibold tracking-tight">{getGreeting()}.</h1>
            <p className="mt-1 text-sm text-text-muted">
              Ask anything — I'll figure out which of your agents should handle it.
            </p>

            <div className="mt-6 flex flex-col gap-6 lg:flex-row">
              <div className="min-w-0 flex-1">
                <ComposerBox value={value} setValue={setValue} onSubmit={handleStart} submitting={submitting} />

                {threads.length > 0 && (
                  <div className="mt-8">
                    <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-text-faint">
                      Recent · {threads.length}
                    </h2>
                    <div className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-surface">
                      {threads.slice(0, 6).map((t) => (
                        <button
                          key={t.id}
                          onClick={() => setActiveThreadId(t.id)}
                          className="group flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-hover"
                        >
                          <MessagesSquare className="size-4 shrink-0 text-text-faint" />
                          <span className="min-w-0 flex-1 truncate text-sm text-text">{t.title}</span>
                          <span className="shrink-0 text-xs text-text-faint">{timeAgo(t.updated_at)}</span>
                          <span
                            role="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteThread(t.id);
                            }}
                            className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                          >
                            <X className="size-3.5 text-text-faint hover:text-danger" />
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
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
                        disabled={submitting}
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
        ) : (
          <>
            <div ref={scrollRef} className="flex-1 overflow-y-auto">
              <div className="mx-auto max-w-3xl pb-4">
                {messagesQuery.isLoading ? (
                  <div className="flex justify-center py-10">
                    <Spinner />
                  </div>
                ) : (
                  <div className="divide-y divide-border/60">
                    {messagesQuery.data?.map((m) => (
                      <AssistantMessageBubble key={m.id} role={m.role} content={m.content} routing={m.routing} />
                    ))}
                  </div>
                )}

                {optimisticUser && <AssistantMessageBubble role="user" content={optimisticUser} routing={null} />}

                {isStreaming && (
                  <div>
                    {!routeInfo && <LoadingIndicator label="Routing your request" />}
                    {routeInfo && (
                      <DelegationTrace
                        mode={routeInfo.mode}
                        reason={routeInfo.reason}
                        agents={Object.values(agentStates)}
                      />
                    )}
                    {routeInfo && (finalText || singleAgentState) && (
                      <div className="px-6 py-4">
                        <p className="mb-1 text-xs font-medium text-text-faint">Assistant</p>
                        <StreamingMessage content={liveAnswer} streaming={isStreaming} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="mx-auto w-full max-w-3xl px-6 pb-6">
              <ComposerBox value={value} setValue={setValue} onSubmit={handleStart} submitting={submitting} compact />
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function ComposerBox({
  value,
  setValue,
  onSubmit,
  submitting,
  compact,
}: {
  value: string;
  setValue: (v: string) => void;
  onSubmit: (content: string) => void;
  submitting: boolean;
  compact?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface-raised p-3 focus-within:border-accent">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSubmit(value);
          }
        }}
        rows={compact ? 1 : 2}
        placeholder="Ask, create, or start a task..."
        className="max-h-40 min-h-10 w-full resize-none border-none bg-transparent px-2 py-1.5 text-sm text-text placeholder:text-text-faint outline-none"
      />
      <div className="mt-1 flex items-center justify-end px-1">
        <button
          onClick={() => onSubmit(value)}
          disabled={!value.trim() || submitting}
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
  );
}

function AssistantMessageBubble({
  role,
  content,
  routing,
}: {
  role: "user" | "assistant";
  content: string;
  routing: AssistantRouting | null;
}) {
  const isUser = role === "user";
  return (
    <div className="px-6 py-4">
      <p className="mb-1 text-xs font-medium text-text-faint">{isUser ? "You" : "Assistant"}</p>
      {!isUser && routing && routing.contributions.length > 1 && (
        <p className="mb-1.5 text-xs text-text-faint">
          Delegated to {routing.contributions.map((c) => c.agent_title).join(", ")} ({routing.mode})
        </p>
      )}
      <MarkdownContent content={content} />
    </div>
  );
}
