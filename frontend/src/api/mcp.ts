import { useQuery } from "@tanstack/react-query";
import { api, buildQuery } from "./client";
import type { McpServer, McpServerListResponse } from "@/types";

export interface McpQueryParams {
  category?: string;
  q?: string;
  page?: number;
  page_size?: number;
}

export function useMcpServers(params: McpQueryParams) {
  const qs = buildQuery(params as Record<string, string | number | undefined | null>);
  return useQuery({
    queryKey: ["mcp", params],
    queryFn: () => api.get<McpServerListResponse>(`/mcp${qs}`),
    placeholderData: (prev) => prev,
  });
}

export function useMcpServer(id: number | undefined) {
  return useQuery({
    queryKey: ["mcp-server", id],
    queryFn: () => api.get<McpServer>(`/mcp/${id}`),
    enabled: id !== undefined,
  });
}
