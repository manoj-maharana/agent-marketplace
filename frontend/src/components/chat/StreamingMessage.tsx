import { useMemo } from "react";

/* ─────────────────────────────────────────────────────────
 * STREAMING MESSAGE — the actively-in-flight assistant reply.
 * Rendered as plain text (not markdown) while tokens are
 * still arriving so each new word can blur-in individually;
 * once the turn settles, Chat.tsx swaps to the persisted
 * message rendered through ChatMessage/MarkdownContent.
 *
 * Content only ever grows (SSE tokens append), so splitting
 * into an array and keying by index is safe: earlier tokens
 * keep their identity across renders and never replay their
 * mount animation - only freshly-appended words do.
 * ───────────────────────────────────────────────────────── */

export function StreamingMessage({ content, streaming }: { content: string; streaming: boolean }) {
  const tokens = useMemo(() => content.split(/(\s+)/).filter((t) => t.length > 0), [content]);

  return (
    <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-ink">
      {tokens.map((token, i) => (
        <span
          key={i}
          className="stream-word inline [will-change:filter,opacity]"
          style={{ animation: "stream-in 380ms cubic-bezier(0.22,0.61,0.25,1) both" }}
        >
          {token}
        </span>
      ))}
      {streaming && (
        <span
          aria-hidden
          className="ml-0.5 inline-block h-3.5 w-0.5 translate-y-0.5 rounded-full bg-ink"
          style={{ animation: "fade-in 150ms ease-out both, pulse-dot 1s ease-in-out infinite" }}
        />
      )}
    </p>
  );
}
