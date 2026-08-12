import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

/* ─────────────────────────────────────────────────────────
 * TOOL TRACE — expandable agent tool-call trace, driven by
 * real SSE tool_call/tool_result events (not a timed demo
 * sequence). Auto-expands while any call is in flight,
 * settles to a one-line summary, stays expandable.
 * ───────────────────────────────────────────────────────── */

export interface ToolTraceEvent {
  name: string;
  status: "calling" | "done";
  arguments?: Record<string, unknown>;
  result?: Record<string, unknown>;
}

function summarize(value: Record<string, unknown> | undefined): string | null {
  if (!value || Object.keys(value).length === 0) return null;
  try {
    const json = JSON.stringify(value);
    return json.length > 60 ? `${json.slice(0, 60)}…` : json;
  } catch {
    return null;
  }
}

export function ToolTrace({ events }: { events: ToolTraceEvent[] }) {
  const working = events.some((e) => e.status === "calling");
  const [manualExpanded, setManualExpanded] = useState<boolean | null>(null);
  const [openRow, setOpenRow] = useState<string | null>(null);
  const expanded = manualExpanded ?? true;
  const traceRef = useRef<HTMLDivElement>(null);
  const [lineHeight, setLineHeight] = useState(0);

  useLayoutEffect(() => {
    if (traceRef.current) setLineHeight(traceRef.current.offsetHeight);
  }, [events.length, expanded, openRow]);

  if (events.length === 0) return null;

  const doneCount = events.filter((e) => e.status === "done").length;
  const label = working
    ? "Using tools"
    : `Used ${events.length} tool${events.length > 1 ? "s" : ""}`;

  return (
    <div className="flex w-full flex-col px-6 pt-3">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setManualExpanded((current) => !(current ?? true))}
        className="-mx-1.5 flex w-fit items-center gap-2 rounded-lg px-1.5 py-1 transition-colors duration-100 hover:bg-hover"
      >
        {working ? (
          <span
            className="shimmer-label bg-clip-text text-[13px] font-medium whitespace-nowrap text-transparent"
            style={{
              backgroundImage:
                "linear-gradient(90deg, var(--color-ink-3) 35%, var(--color-ink) 50%, var(--color-ink-3) 65%)",
              backgroundSize: "200% 100%",
              animation: "shimmer-text 1.4s linear infinite",
            }}
          >
            {label}
          </span>
        ) : (
          <span
            className="text-[13px] font-medium whitespace-nowrap text-ink-2"
            style={{ animation: "fade-in 350ms ease-out both" }}
          >
            {label} ({doneCount}/{events.length})
          </span>
        )}
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-ink-3 transition-transform duration-300"
          style={{ transform: expanded ? "rotate(180deg)" : "rotate(0)" }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      <div
        className="grid transition-[grid-template-rows,opacity] duration-400"
        style={{
          gridTemplateRows: expanded ? "1fr" : "0fr",
          opacity: expanded ? 1 : 0,
          transitionTimingFunction: "cubic-bezier(0.23, 1, 0.32, 1)",
        }}
      >
        <div className="overflow-hidden">
          <div className="relative mt-1 ml-[5px] pl-4">
            <span
              aria-hidden
              className="absolute left-[3px] w-px bg-line"
              style={{
                top: -4,
                height: lineHeight ? lineHeight - 2 : 0,
                transition: "height 500ms cubic-bezier(0.23,1,0.32,1)",
              }}
            />
            <div ref={traceRef} className="flex flex-col gap-0.5 py-1">
              {events.map((event, i) => {
                const key = `${event.name}-${i}`;
                const rowOpen = openRow === key;
                const argSummary = summarize(event.arguments);
                const resultSummary = summarize(event.result);
                return (
                  <div key={key} style={{ animation: "fade-up 300ms cubic-bezier(0.23,1,0.32,1) both" }}>
                    <button
                      type="button"
                      aria-expanded={rowOpen}
                      onClick={() => setOpenRow(rowOpen ? null : key)}
                      className="flex min-h-7 w-full items-center gap-2 rounded-md px-1.5 py-0.5 text-left transition-colors duration-150 hover:bg-hover"
                    >
                      {event.status === "calling" ? (
                        <span className="size-3 shrink-0 rounded-full border-[1.5px] border-line-strong border-t-ink-2 [animation:spin_700ms_linear_infinite]" />
                      ) : (
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="shrink-0 text-ink-3"
                        >
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      )}
                      <span className="min-w-0 truncate text-[12.5px] font-medium text-ink">{event.name}</span>
                      {argSummary && (
                        <span className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-ink-3">
                          {argSummary}
                        </span>
                      )}
                    </button>
                    <div
                      className="grid transition-[grid-template-rows,opacity] duration-300"
                      style={{
                        gridTemplateRows: rowOpen ? "1fr" : "0fr",
                        opacity: rowOpen ? 1 : 0,
                        transitionTimingFunction: "cubic-bezier(0.23, 1, 0.32, 1)",
                      }}
                    >
                      <div className="overflow-hidden">
                        <pre
                          className={cn(
                            "mb-1 ml-5 overflow-x-auto rounded-md bg-inset px-2 py-1.5 font-mono text-[11px] leading-relaxed text-ink-2",
                          )}
                        >
                          {resultSummary ?? argSummary ?? "(no arguments)"}
                        </pre>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
