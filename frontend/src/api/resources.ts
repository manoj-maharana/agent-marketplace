import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiForm, BASE_URL } from "./client";
import type { Resource } from "@/types";

export function useResources() {
  return useQuery({
    queryKey: ["resources"],
    queryFn: () => api.get<Resource[]>("/resources"),
  });
}

export function useUploadResource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return apiForm.post<Resource>("/resources", formData);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["resources"] });
    },
  });
}

export function useDeleteResource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (resourceId: number) => api.del<void>(`/resources/${resourceId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["resources"] });
    },
  });
}

export function resourceDownloadUrl(resourceId: number): string {
  return `${BASE_URL}/resources/${resourceId}/download`;
}
