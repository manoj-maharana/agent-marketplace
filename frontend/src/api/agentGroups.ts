import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type {
  AgentGroup,
  AgentGroupCreatePayload,
  AgentGroupListResponse,
  GroupRunResponse,
} from "@/types";

const BASE = "/experimental/deepagents/groups";

export function useAgentGroups() {
  return useQuery({
    queryKey: ["agent-groups"],
    queryFn: () => api.get<AgentGroupListResponse>(BASE),
  });
}

export function useAgentGroup(id: number | undefined) {
  return useQuery({
    queryKey: ["agent-group", id],
    queryFn: () => api.get<AgentGroup>(`${BASE}/${id}`),
    enabled: id !== undefined,
  });
}

export function useCreateAgentGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: AgentGroupCreatePayload) => api.post<AgentGroup>(BASE, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agent-groups"] });
    },
  });
}

export function useDeleteAgentGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.del<void>(`${BASE}/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agent-groups"] });
    },
  });
}

export function useRunAgentGroup(groupId: number | undefined) {
  return useMutation({
    mutationFn: (message: string) => api.post<GroupRunResponse>(`${BASE}/${groupId}/run`, { message }),
  });
}
