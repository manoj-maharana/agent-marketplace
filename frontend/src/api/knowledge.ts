import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiForm } from "./client";
import type { KnowledgeFile } from "@/types";

export function useKnowledgeFiles(agentId: number | undefined) {
  return useQuery({
    queryKey: ["knowledge", agentId],
    queryFn: () => api.get<KnowledgeFile[]>(`/agents/${agentId}/knowledge`),
    enabled: agentId !== undefined,
  });
}

export function useUploadKnowledgeFile(agentId: number | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return apiForm.post<KnowledgeFile>(`/agents/${agentId}/knowledge`, formData);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["knowledge", agentId] });
    },
  });
}

export function useDeleteKnowledgeFile(agentId: number | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (fileId: number) => api.del<void>(`/agents/${agentId}/knowledge/${fileId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["knowledge", agentId] });
    },
  });
}
