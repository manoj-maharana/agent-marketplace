import { useQueryClient } from "@tanstack/react-query";
import { BookOpen, MessageSquareDashed, Plus, Wrench, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useAgent, useAgents } from "@/api/agents";
import {
  streamMessage,
  useConversations,
  useCreateConversation,
  useDeleteConversation,
  useMessages,
} from "@/api/chat";
import { ChatMessage } from "@/components/ChatMessage";
import { ChatSidebar } from "@/components/ChatSidebar";
import { Composer } from "@/components/Composer";
import { KnowledgeModal } from "@/components/KnowledgeModal";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { Tag } from "@/components/ui/Tag";
import { cn } from "@/lib/cn";

interface ToolEvent {
  name: string;
  status: "calling" | "done";
}

export function Chat() {
  const { agentId, conversationId: conversationIdParam } = useParams<{
    agentId: string;
    conversationId?: string;
  }>();
  const agentIdNum = agentId ? Number(agentId) : undefined;
  const conversationId = conversationIdParam ? Number(conversationIdParam) : undefined;
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  const libraryQuery = useAgents({ scope: "library", page_size: 60 });
  const agentQuery = useAgent(agentIdNum);
  const conversationsQuery = useConversations(agentIdNum);
  const createConversation = useCreateConversation();
  const deleteConversation = useDeleteConversation();

  const [optimisticUser, setOptimisticUser] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const [toolEvents, setToolEvents] = useState<ToolEvent[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [knowledgeOpen, setKnowledgeOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const creatingRef = useRef(false);
  const initialMessageSentRef = useRef(false);

  const messagesQuery = useMessages(conversationId);

  // Reset streaming/composer state whenever the active conversation changes.
  useEffect(() => {
    setOptimisticUser(null);
    setStreamingText(null);
    setToolEvents([]);
    setIsStreaming(false);
  }, [conversationId]);

  useEffect(() => {
    creatingRef.current = false;
  }, [agentIdNum]);

  // No conversation selected in the URL yet — redirect to the most recent one,
  // or create the agent's first conversation.
  useEffect(() => {
    if (!agentIdNum || conversationId || !conversationsQuery.isSuccess) return;
    if (conversationsQuery.data.length > 0) {
      navigate(`/chat/${agentIdNum}/${conversationsQuery.data[0].id}`, { replace: true });
    } else if (!creatingRef.current) {
      creatingRef.current = true;
      createConversation.mutate(agentIdNum, {
        onSuccess: (conv) => navigate(`/chat/${agentIdNum}/${conv.id}`, { replace: true }),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentIdNum, conversationId, conversationsQuery.isSuccess, conversationsQuery.data]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messagesQuery.data, streamingText, optimisticUser]);

  // A page that already created this conversation (e.g. the General Chat hero) can hand
  // off the first message via navigation state instead of the user retyping it here.
  useEffect(() => {
    const initial = (location.state as { initialMessage?: string } | null)?.initialMessage;
    if (!initial || !conversationId || initialMessageSentRef.current) return;
    initialMessageSentRef.current = true;
    handleSend(initial);
    navigate(location.pathname, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, location.state]);

  async function handleSend(content: string) {
    if (!conversationId) return;
    setOptimisticUser(content);
    setStreamingText("");
    setToolEvents([]);
    setIsStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    await streamMessage(
      conversationId,
      content,
      (event) => {
        if (event.type === "token") {
          setStreamingText((prev) => (prev ?? "") + event.content);
        } else if (event.type === "tool_call") {
          setToolEvents((prev) => [...prev, { name: event.name, status: "calling" }]);
        } else if (event.type === "tool_result") {
          setToolEvents((prev) =>
            prev.map((t) => (t.name === event.name && t.status === "calling" ? { ...t, status: "done" } : t)),
          );
        } else if (event.type === "done") {
          setStreamingText(event.content);
        } else if (event.type === "error") {
          setStreamingText((prev) => (prev ? `${prev}\n\n⚠️ ${event.message}` : `⚠️ ${event.message}`));
        }
      },
      controller.signal,
    );

    setIsStreaming(false);
    setOptimisticUser(null);
    setStreamingText(null);
    setToolEvents([]);
    queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
    queryClient.invalidateQueries({ queryKey: ["conversations", agentIdNum] });
  }

  function handleStop() {
    abortRef.current?.abort();
    setIsStreaming(false);
  }

  function handleNewChat() {
    if (!agentIdNum) return;
    createConversation.mutate(agentIdNum, {
      onSuccess: (conv) => navigate(`/chat/${agentIdNum}/${conv.id}`),
    });
  }

  function handleDeleteConversation(id: number) {
    if (!agentIdNum) return;
    deleteConversation.mutate(id, {
      onSuccess: () => {
        if (id === conversationId) navigate(`/chat/${agentIdNum}`, { replace: true });
      },
    });
  }

  const libraryAgents = libraryQuery.data?.items ?? [];
  const agent = agentQuery.data;
  const conversations = conversationsQuery.data ?? [];

  return (
    <div className="flex h-full">
      <ChatSidebar agents={libraryAgents} activeAgentId={agentIdNum} isLoading={libraryQuery.isLoading} />

      <div className="flex min-w-0 flex-1 flex-col">
        {!agentIdNum ? (
          <EmptyState />
        ) : agentQuery.isLoading || !agent ? (
          <div className="flex flex-1 items-center justify-center">
            <Spinner />
          </div>
        ) : (
          <>
            <header className="flex items-center gap-3 border-b border-border px-6 py-4">
              <Avatar emoji={agent.avatar_emoji} color={agent.avatar_color} size={36} />
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold text-text">{agent.title}</h2>
                <p className="text-xs text-text-faint">
                  {agent.skills.length > 0
                    ? `${agent.skills.length} skill${agent.skills.length > 1 ? "s" : ""} enabled`
                    : "No skills enabled"}
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                icon={<Wrench className="size-3.5" />}
                onClick={() => navigate(`/agents/${agentIdNum}?tab=${encodeURIComponent("Agent Capabilities")}`)}
              >
                Skills
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon={<BookOpen className="size-3.5" />}
                onClick={() => setKnowledgeOpen(true)}
              >
                Knowledge
              </Button>
            </header>

            {conversations.length > 0 && (
              <div className="flex items-center gap-2 overflow-x-auto border-b border-border px-4 py-2">
                {conversations.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => navigate(`/chat/${agentIdNum}/${c.id}`)}
                    className={cn(
                      "group flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors",
                      c.id === conversationId
                        ? "border-accent bg-accent-soft text-accent"
                        : "border-border text-text-muted hover:bg-surface-hover",
                    )}
                  >
                    <span className="max-w-[140px] truncate">{c.title}</span>
                    <span
                      role="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteConversation(c.id);
                      }}
                      className="opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      <X className="size-3" />
                    </span>
                  </button>
                ))}
                <button
                  onClick={handleNewChat}
                  className="flex shrink-0 items-center gap-1 rounded-full border border-dashed border-border px-3 py-1 text-xs text-text-faint transition-colors hover:border-accent hover:text-accent"
                >
                  <Plus className="size-3" />
                  New
                </button>
              </div>
            )}

            <div ref={scrollRef} className="flex-1 overflow-y-auto">
              {(messagesQuery.data?.length ?? 0) === 0 && !optimisticUser ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                  <Avatar emoji={agent.avatar_emoji} color={agent.avatar_color} size={48} />
                  <p className="max-w-sm text-sm text-text-muted">{agent.description}</p>
                </div>
              ) : (
                <div className="divide-y divide-border/60 pb-4">
                  {messagesQuery.data?.map((m) => (
                    <ChatMessage key={m.id} role={m.role as "user" | "assistant"} content={m.content} agent={agent} />
                  ))}
                  {optimisticUser && <ChatMessage role="user" content={optimisticUser} agent={agent} />}
                  {isStreaming && (
                    <div>
                      {toolEvents.length > 0 && (
                        <div className="flex flex-wrap gap-2 px-6 pt-3">
                          {toolEvents.map((t, i) => (
                            <Tag key={i} tone={t.status === "done" ? "success" : "accent"}>
                              <Wrench className="size-3" />
                              {t.name}
                              {t.status === "calling" ? "…" : " done"}
                            </Tag>
                          ))}
                        </div>
                      )}
                      <ChatMessage role="assistant" content={streamingText ?? ""} agent={agent} />
                    </div>
                  )}
                </div>
              )}
            </div>

            <Composer
              onSend={handleSend}
              onStop={handleStop}
              isStreaming={isStreaming}
              placeholder={`Message ${agent.title}...`}
            />

            <KnowledgeModal agentId={agent.id} open={knowledgeOpen} onClose={() => setKnowledgeOpen(false)} />
          </>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
      <MessageSquareDashed className="size-8 text-text-faint" />
      <p className="text-sm text-text-muted">Select an agent on the left to start chatting.</p>
    </div>
  );
}
