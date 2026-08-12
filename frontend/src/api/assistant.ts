import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, BASE_URL } from "./client";
import type { AssistantMessage, AssistantStreamEvent, AssistantThread } from "@/types";

export function useAssistantThreads() {
  return useQuery({
    queryKey: ["assistant-threads"],
    queryFn: () => api.get<AssistantThread[]>("/assistant/threads"),
  });
}

export function useAssistantMessages(threadId: number | undefined) {
  return useQuery({
    queryKey: ["assistant-messages", threadId],
    queryFn: () => api.get<AssistantMessage[]>(`/assistant/threads/${threadId}/messages`),
    enabled: threadId !== undefined,
  });
}

export function useCreateAssistantThread() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<AssistantThread>("/assistant/threads", {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["assistant-threads"] }),
  });
}

export function useDeleteAssistantThread() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (threadId: number) => api.del<void>(`/assistant/threads/${threadId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["assistant-threads"] }),
  });
}

/** Streams an Assistant router turn via SSE, invoking onEvent for each parsed event. */
export async function streamAssistantMessage(
  threadId: number,
  content: string,
  onEvent: (event: AssistantStreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(`${BASE_URL}/assistant/threads/${threadId}/messages`, {
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
        onEvent(JSON.parse(jsonStr) as AssistantStreamEvent);
      } catch {
        // ignore malformed frame
      }
    }
  }
}
