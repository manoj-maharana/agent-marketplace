import { Check, ChevronDown, Play, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useAgents } from "@/api/agents";
import {
  useCheckDueTasks,
  useCreateTask,
  useDeleteTask,
  useRunTaskNow,
  useTaskRuns,
  useTasks,
  useUpdateTask,
} from "@/api/tasks";
import { AssistantSidebar } from "@/components/AssistantSidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/cn";
import { timeAgo } from "@/lib/format";
import type { Task, TaskPriority, TaskRecurrence } from "@/types";

interface Template {
  title: string;
  description: string;
  recurrence: TaskRecurrence;
  recurrenceDay?: number; // 0=Mon..6=Sun
  recurrenceHour: number;
}

const TEMPLATES: Template[] = [
  {
    title: "Daily learning bite",
    description:
      "Each morning, deliver one 15-minute curated piece (article, video, or podcast) in my learning area.",
    recurrence: "daily",
    recurrenceHour: 8,
  },
  {
    title: "Industry research weekly",
    description: "Every Monday, summarize market dynamics, funding, new players, and regulatory shifts in my sector.",
    recurrence: "weekly",
    recurrenceDay: 0,
    recurrenceHour: 8,
  },
  {
    title: "Must-read papers weekly",
    description: "Every Sunday night, the 3 most-cited or most-discussed papers from this week as a deep-read list.",
    recurrence: "weekly",
    recurrenceDay: 6,
    recurrenceHour: 20,
  },
  {
    title: "Morning ritual",
    description: "Every day: weather, today's schedule, a thought-of-the-day, and a gentle movement nudge.",
    recurrence: "daily",
    recurrenceHour: 7,
  },
  {
    title: "Bedtime gratitude",
    description: "Every night, prompt 3 things I'm grateful for and one thing I learned today.",
    recurrence: "daily",
    recurrenceHour: 22,
  },
  {
    title: "Weekly meeting brief",
    description: "Every Monday, prep 3 talking points for my weekly strategy meeting: trends, internals, decisions.",
    recurrence: "weekly",
    recurrenceDay: 0,
    recurrenceHour: 8,
  },
];

const PRIORITIES: { value: TaskPriority; label: string; dot: string }[] = [
  { value: "none", label: "No priority", dot: "bg-text-faint" },
  { value: "low", label: "Low", dot: "bg-accent" },
  { value: "medium", label: "Medium", dot: "bg-yellow-500" },
  { value: "high", label: "High", dot: "bg-danger" },
];

function priorityMeta(p: TaskPriority) {
  return PRIORITIES.find((x) => x.value === p) ?? PRIORITIES[0];
}

function recurrenceLabel(task: Task): string {
  if (task.recurrence === "once") return "One-off";
  if (task.recurrence === "daily") return `Daily · ${String(task.recurrence_hour).padStart(2, "0")}:00 UTC`;
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const day = task.recurrence_day !== null ? days[task.recurrence_day] : "Mon";
  return `Weekly · ${day} ${String(task.recurrence_hour).padStart(2, "0")}:00 UTC`;
}

/** Recurring/agent-backed tasks are checked lazily: this fires once when the
 * Tasks page mounts, matching the v1 "no server-side cron" decision - a task
 * only actually runs while someone has this page open at/after its due time. */
function useDueCheckOnMount() {
  const checkDue = useCheckDueTasks();
  useEffect(() => {
    checkDue.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

export function Tasks() {
  useDueCheckOnMount();

  const tasksQuery = useTasks();
  const agentsQuery = useAgents({ scope: "library", page_size: 30 });
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const runNow = useRunTaskNow();

  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("none");
  const [assignee, setAssignee] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [agentId, setAgentId] = useState<number | "">("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const agents = agentsQuery.data?.items ?? [];
  const tasks = tasksQuery.data ?? [];

  function resetForm() {
    setTitle("");
    setPriority("none");
    setAssignee("");
    setIsPrivate(false);
  }

  function handleCreate() {
    const trimmed = title.trim();
    if (!trimmed) return;
    createTask.mutate(
      {
        title: trimmed,
        priority,
        assignee: assignee.trim() || null,
        is_private: isPrivate,
        agent_id: agentId === "" ? null : agentId,
      },
      { onSuccess: resetForm },
    );
  }

  function handleAddTemplate(t: Template) {
    createTask.mutate({
      title: t.title,
      description: t.description,
      recurrence: t.recurrence,
      recurrence_day: t.recurrenceDay ?? null,
      recurrence_hour: t.recurrenceHour,
      agent_id: agentId === "" ? null : agentId,
    });
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg text-text">
      <AssistantSidebar />
      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4">
          <span />
          <ThemeToggle />
        </div>

        <div className="mx-auto w-full max-w-3xl flex-1 px-6 pb-12">
          <h1 className="text-2xl font-semibold tracking-tight">What should we tackle today?</h1>
          <p className="mt-1 text-sm text-text-muted">
            One-off checklist items, or hand a task to an agent to run on a schedule.
          </p>

          {/* Quick create */}
          <div className="mt-5 rounded-2xl border border-border bg-surface-raised p-3">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="Create task..."
              className="w-full border-none bg-transparent px-1 py-1 text-sm text-text placeholder:text-text-faint outline-none"
            />
            <div className="mt-2 flex flex-wrap items-center gap-2 px-1">
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-text-muted outline-none"
              >
                {PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
              <select
                value={agentId}
                onChange={(e) => setAgentId(e.target.value ? Number(e.target.value) : "")}
                className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-text-muted outline-none"
              >
                <option value="">No agent (checklist only)</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.avatar_emoji} {a.title}
                  </option>
                ))}
              </select>
              <input
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                placeholder="Assignee"
                className="w-28 rounded-md border border-border bg-surface px-2 py-1 text-xs text-text-muted outline-none placeholder:text-text-faint"
              />
              <label className="flex items-center gap-1.5 text-xs text-text-muted">
                <input
                  type="checkbox"
                  checked={isPrivate}
                  onChange={(e) => setIsPrivate(e.target.checked)}
                  className="size-3.5 accent-accent"
                />
                Private
              </label>
              <button
                onClick={handleCreate}
                disabled={!title.trim() || createTask.isPending}
                className="ml-auto flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
              >
                <Plus className="size-3.5" />
                Create task
              </button>
            </div>
          </div>

          {/* Templates */}
          <div className="mt-8">
            <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-text-faint">
              Templates picked for you
            </h2>
            <p className="mb-3 text-xs text-text-faint">
              {agentId === "" ? "Pick an agent above to make these run automatically." : "Adds using the selected agent."}
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {TEMPLATES.map((t) => (
                <div key={t.title} className="rounded-2xl border border-border bg-surface p-4">
                  <h3 className="text-sm font-semibold text-text">{t.title}</h3>
                  <p className="mt-1 text-xs text-text-muted">{t.description}</p>
                  <button
                    onClick={() => handleAddTemplate(t)}
                    disabled={createTask.isPending}
                    className="mt-3 flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text transition-colors hover:bg-surface-hover disabled:opacity-50"
                  >
                    <Plus className="size-3.5" />
                    Add task
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Task list */}
          <div className="mt-8">
            <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-text-faint">
              Your tasks · {tasks.length}
            </h2>
            {tasksQuery.isLoading ? (
              <div className="flex justify-center py-10">
                <Spinner />
              </div>
            ) : tasks.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-text-faint">
                No tasks yet.
              </p>
            ) : (
              <div className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-surface">
                {tasks.map((t) => (
                  <TaskRow
                    key={t.id}
                    task={t}
                    expanded={expandedId === t.id}
                    onToggleExpand={() => setExpandedId(expandedId === t.id ? null : t.id)}
                    onToggleActive={() =>
                      updateTask.mutate({ id: t.id, payload: { is_active: !t.is_active } })
                    }
                    onRunNow={() => runNow.mutate(t.id)}
                    onDelete={() => deleteTask.mutate(t.id)}
                    running={runNow.isPending && runNow.variables === t.id}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function TaskRow({
  task,
  expanded,
  onToggleExpand,
  onToggleActive,
  onRunNow,
  onDelete,
  running,
}: {
  task: Task;
  expanded: boolean;
  onToggleExpand: () => void;
  onToggleActive: () => void;
  onRunNow: () => void;
  onDelete: () => void;
  running: boolean;
}) {
  const runsQuery = useTaskRuns(expanded ? task.id : undefined);
  const meta = priorityMeta(task.priority);

  return (
    <div>
      <div className="group flex items-center gap-3 px-4 py-3">
        <button
          onClick={onToggleActive}
          aria-label={task.is_active ? "Mark inactive" : "Mark active"}
          className={cn(
            "flex size-4 shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors",
            task.is_active ? "border-border-strong" : "border-accent bg-accent text-white",
          )}
        >
          {!task.is_active && <Check className="size-2.5" />}
        </button>

        <span className={cn("size-1.5 shrink-0 rounded-full", meta.dot)} />

        <button onClick={onToggleExpand} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <span className={cn("truncate text-sm", task.is_active ? "text-text" : "text-text-faint line-through")}>
            {task.title}
          </span>
          {task.agent && <span className="shrink-0 text-xs text-text-faint">via {task.agent.title}</span>}
        </button>

        {task.agent_id && task.recurrence !== "once" && (
          <span className="hidden shrink-0 text-xs text-text-faint sm:inline">{recurrenceLabel(task)}</span>
        )}
        {task.assignee && <span className="hidden shrink-0 text-xs text-text-faint sm:inline">{task.assignee}</span>}

        {task.agent_id && (
          <button
            onClick={onRunNow}
            disabled={running}
            aria-label="Run now"
            className="flex size-7 shrink-0 items-center justify-center rounded-md text-text-faint opacity-0 transition-opacity hover:bg-surface-hover hover:text-text group-hover:opacity-100 disabled:opacity-100"
          >
            {running ? (
              <span className="size-3 animate-spin rounded-full border-2 border-border-strong border-t-accent" />
            ) : (
              <Play className="size-3.5" />
            )}
          </button>
        )}
        <button
          onClick={onToggleExpand}
          aria-label="Expand"
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-text-faint transition-colors hover:bg-surface-hover hover:text-text"
        >
          <ChevronDown className={cn("size-3.5 transition-transform", expanded && "rotate-180")} />
        </button>
        <button
          onClick={onDelete}
          aria-label="Delete"
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-text-faint opacity-0 transition-opacity hover:bg-danger/10 hover:text-danger group-hover:opacity-100"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>

      {expanded && (
        <div className="border-t border-border/60 bg-surface-raised px-4 py-3">
          {task.description && <p className="mb-2 text-xs text-text-muted">{task.description}</p>}
          {task.next_run_at && (
            <p className="mb-2 text-xs text-text-faint">Next run: {timeAgo(task.next_run_at)}</p>
          )}
          {runsQuery.isLoading ? (
            <Spinner className="size-4" />
          ) : (runsQuery.data ?? []).length === 0 ? (
            <p className="text-xs text-text-faint">No runs yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {(runsQuery.data ?? []).slice(0, 3).map((run) => (
                <div key={run.id} className="rounded-lg bg-inset px-3 py-2">
                  <p className="mb-1 text-[11px] text-text-faint">{timeAgo(run.created_at)}</p>
                  <p className="whitespace-pre-wrap text-xs leading-relaxed text-text-muted">{run.output}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
