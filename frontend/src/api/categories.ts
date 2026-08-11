import { useQuery } from "@tanstack/react-query";
import { api } from "./client";
import type { Category } from "@/types";

export function useCategories(kind: "agent" | "skill" | "mcp") {
  return useQuery({
    queryKey: ["categories", kind],
    queryFn: () => api.get<Category[]>(`/categories?kind=${kind}`),
    staleTime: 5 * 60 * 1000,
  });
}
