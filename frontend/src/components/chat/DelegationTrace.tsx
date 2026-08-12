import { Check, Workflow } from "lucide-react";
import { useState } from "react";

/* ─────────────────────────────────────────────────────────
 * DELEGATION TRACE — shows the Assistant router's live
 * decision (which library agents it picked, and whether
 * they're running single/parallel/sequential) plus each
 * delegated agent's own streamed contribution as it arrives.
 *
 * Single-agent turns render nothing here - the one agent's
 * answer IS the final answer, no trace needed.
 * ───────────────────────────────────────────────────────── */

export interface DelegationAgentState {
  agentId: number;
  title: string;
  content: string;
  done: boolean;
}

export function DelegationTrace({
  mode,
  reason,
  agents,
}: {
  mode: "single" | "parallel" | "sequential";
  reason: string;
  agents: DelegationAgentState[];
}) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  if (agents.length <= 1) return null;

  const allDone = agents.every((a) => a.done);
  const modeLabel = mode === "parallel" ? "in parallel" : "in sequence";

  return (
    <div className="flex w-full flex-col gap-1 px-6 pt-3">
      <div className="flex items-center gap-2 text-[13px] font-medium text-ink-2">
        <Workflow className="size-3.5 text-ink-3" />
        <span
          className={allDone ? undefined : "shimmer-label bg-clip-text text-transparent"}
          style={
            allDone
              ? undefined
              : {
                  backgroundImage:
                    "linear-gradient(90deg, var(--color-ink-3) 35%, var(--color-ink) 50%, var(--color-ink-3) 65%)",
                  backgroundSize: "200% 100%",
                  animation: "shimmer-text 1.4s linear infinite",
                }
          }
        >
          {allDone ? `Delegated to ${agents.length} agents ${modeLabel}` : `Delegating ${modeLabel}…`}
        </span>
      </div>
      {reason && <p className="pl-5.5 text-[12px] text-ink-3">{reason}</p>}

      <div className="relative mt-1 ml-[5px] flex flex-col gap-0.5 border-l border-line py-1 pl-4">
        {agents.map((a) => {
          const isOpen = expandedId === a.agentId;
          return (
            <div key={a.agentId}>
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setExpandedId(isOpen ? null : a.agentId)}
                className="flex min-h-7 w-full items-center gap-2 rounded-md px-1.5 py-0.5 text-left transition-colors duration-150 hover:bg-hover"
              >
                {a.done ? (
                  <Check className="size-3.5 shrink-0 text-ink-3" />
                ) : (
                  <span className="size-3 shrink-0 rounded-full border-[1.5px] border-line-strong border-t-ink-2 [animation:spin_700ms_linear_infinite]" />
                )}
                <span className="shrink-0 text-[12.5px] font-medium text-ink">{a.title}</span>
                <span className="min-w-0 flex-1 truncate text-[11.5px] text-ink-3">
                  {a.content.replace(/\s+/g, " ").trim()}
                </span>
              </button>
              {isOpen && (
                <div className="mb-1 ml-5 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-md bg-inset px-2 py-1.5 text-[12px] leading-relaxed text-ink-2">
                  {a.content || "…"}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
