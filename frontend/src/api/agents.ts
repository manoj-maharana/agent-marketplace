import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, buildQuery } from "./client";
import type { Agent, AgentCreatePayload, AgentListResponse, AgentUpdatePayload } from "@/types";

export interface AgentQueryParams {
  category?: string;
  q?: string;
  scope?: "marketplace" | "library";
  page?: number;
  page_size?: number;
}

export function useAgents(params: AgentQueryParams) {
  const qs = buildQuery(params as Record<string, string | number | undefined | null>);
  return useQuery({
    queryKey: ["agents", params],
    queryFn: () => api.get<AgentListResponse>(`/agents${qs}`),
    placeholderData: (prev) => prev,
  });
}

export function useAgent(id: number | undefined) {
  return useQuery({
    queryKey: ["agent", id],
    queryFn: () => api.get<Agent>(`/agents/${id}`),
    enabled: id !== undefined,
  });
}

export function useInstallAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (agentId: number) => api.post<Agent>(`/agents/${agentId}/install`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agents"] });
    },
  });
}

export function useUninstallAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (agentId: number) => api.del<Agent>(`/agents/${agentId}/install`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agents"] });
    },
  });
}

export function useCreateAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: AgentCreatePayload) => api.post<Agent>("/agents", payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agents"] });
    },
  });
}

export function useForkAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (agentId: number) => api.post<Agent>(`/agents/${agentId}/fork`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agents"] });
    },
  });
}

export function useUpdateAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: AgentUpdatePayload }) =>
      api.patch<Agent>(`/agents/${id}`, payload),
    onSuccess: (agent) => {
      qc.invalidateQueries({ queryKey: ["agents"] });
      qc.invalidateQueries({ queryKey: ["agent", agent.id] });
    },
  });
}

export function useDeleteAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (agentId: number) => api.del<void>(`/agents/${agentId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agents"] });
    },
  });
}
