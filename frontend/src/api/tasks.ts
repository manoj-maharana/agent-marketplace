import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type { Task, TaskCreatePayload, TaskRun, TaskUpdatePayload } from "@/types";

export function useTasks() {
  return useQuery({
    queryKey: ["tasks"],
    queryFn: () => api.get<Task[]>("/tasks"),
  });
}

export function useTaskRuns(taskId: number | undefined) {
  return useQuery({
    queryKey: ["task-runs", taskId],
    queryFn: () => api.get<TaskRun[]>(`/tasks/${taskId}/runs`),
    enabled: taskId !== undefined,
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: TaskCreatePayload) => api.post<Task>("/tasks", payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: TaskUpdatePayload }) =>
      api.patch<Task>(`/tasks/${id}`, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.del<void>(`/tasks/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
}

export function useRunTaskNow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.post<TaskRun>(`/tasks/${id}/run-now`),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["task-runs", id] });
    },
  });
}

export function useCheckDueTasks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ ran: { task_id: number; title: string }[] }>("/tasks/check-due"),
    onSuccess: (data) => {
      if (data.ran.length > 0) qc.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}
