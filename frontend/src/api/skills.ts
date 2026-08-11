import { useQuery } from "@tanstack/react-query";
import { api, buildQuery } from "./client";
import type { SkillListResponse } from "@/types";

export interface SkillQueryParams {
  category?: string;
  q?: string;
  page?: number;
  page_size?: number;
}

export function useSkills(params: SkillQueryParams) {
  const qs = buildQuery(params as Record<string, string | number | undefined | null>);
  return useQuery({
    queryKey: ["skills", params],
    queryFn: () => api.get<SkillListResponse>(`/skills${qs}`),
    placeholderData: (prev) => prev,
  });
}
