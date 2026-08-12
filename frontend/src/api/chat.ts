import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, BASE_URL } from "./client";
import type { Conversation, Message, StreamEvent } from "@/types";

export function useConversations(agentId: number | undefined) {
  return useQuery({
    queryKey: ["conversations", agentId],
    queryFn: () => api.get<Conversation[]>(`/chat/conversations?agent_id=${agentId}`),
    enabled: agentId !== undefined,
  });
}

/** All conversations across every agent, most recently updated first. */
export function useAllConversations() {
  return useQuery({
    queryKey: ["conversations", "all"],
    queryFn: () => api.get<Conversation[]>("/chat/conversations"),
  });
}

export function useMessages(conversationId: number | undefined) {
  return useQuery({
    queryKey: ["messages", conversationId],
    queryFn: () => api.get<Message[]>(`/chat/conversations/${conversationId}/messages`),
    enabled: conversationId !== undefined,
  });
}

export function useCreateConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (agentId: number) =>
      api.post<Conversation>("/chat/conversations", { agent_id: agentId }),
    onSuccess: (conv) => {
      qc.invalidateQueries({ queryKey: ["conversations", conv.agent_id] });
    },
  });
}

export function useDeleteConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: number) => api.del<void>(`/chat/conversations/${conversationId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}

/** Streams a chat response via SSE, invoking onEvent for each parsed event. */
export async function streamMessage(
  conversationId: number,
  content: string,
  onEvent: (event: StreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(`${BASE_URL}/chat/conversations/${conversationId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
    signal,
  });

  if (!res.ok || !res.body) {
    onEvent({ type: "error", message: `Request failed (${res.status})` });
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";

    for (const frame of frames) {
      const line = frame.trim();
      if (!line.startsWith("data:")) continue;
      const jsonStr = line.slice(5).trim();
      if (!jsonStr) continue;
      try {
        onEvent(JSON.parse(jsonStr) as StreamEvent);
      } catch {
        // ignore malformed frame
      }
    }
  }
}
