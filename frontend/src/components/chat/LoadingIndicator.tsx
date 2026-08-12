import { useEffect, useState } from "react";

/* ─────────────────────────────────────────────────────────
 * LOADING INDICATOR — pixel-grid loader for the gap between
 * sending a message and the first token/tool event arriving.
 * A chevron wavefront sweeps the 3x3 grid, paired with a
 * shimmering label and a live elapsed timer.
 * ───────────────────────────────────────────────────────── */

const CHEVRON_DELAYS = Array.from({ length: 9 }, (_, i) => {
  const r = Math.floor(i / 3);
  const c = i % 3;
  return (c + Math.abs(r - 1)) * 90;
});

const CYCLE_MS = 650;

function useElapsed() {
  const [deciseconds, setDeciseconds] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setDeciseconds((d) => d + 1), 100);
    return () => clearInterval(t);
  }, []);
  const total = deciseconds / 10;
  if (total < 60) return `${total.toFixed(1)}s`;
  return `${Math.floor(total / 60)}m ${(total % 60).toFixed(1)}s`;
}

export function LoadingIndicator({ label = "Thinking" }: { label?: string }) {
  const elapsed = useElapsed();

  return (
    <div className="flex w-fit items-center gap-2.5 px-6 py-4">
      <span aria-hidden className="grid grid-cols-[repeat(3,4px)] gap-[1.5px]">
        {CHEVRON_DELAYS.map((delay, i) => (
          <span
            key={i}
            className="pixel-cell size-[4px] rounded-[1px] bg-ink"
            style={{ opacity: 0.15, animation: `pixel-on ${CYCLE_MS}ms ease-in-out ${delay}ms infinite` }}
          />
        ))}
      </span>
      <span
        className="shimmer-label bg-clip-text text-[13px] font-medium text-transparent"
        style={{
          backgroundImage: "linear-gradient(90deg, var(--color-ink-3) 35%, var(--color-ink) 50%, var(--color-ink-3) 65%)",
          backgroundSize: "200% 100%",
          animation: "shimmer-text 1.4s linear infinite",
        }}
      >
        {label}
      </span>
      <span className="font-mono text-[12px] text-ink-3 tabular-nums">{elapsed}</span>
    </div>
  );
}
