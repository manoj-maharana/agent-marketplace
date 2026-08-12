import { Check, Copy, RotateCcw, User } from "lucide-react";
import { useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { MarkdownContent } from "@/components/MarkdownContent";
import type { Agent } from "@/types";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  agent: Agent;
  onRetry?: () => void;
}

export function ChatMessage({ role, content, agent, onRetry }: ChatMessageProps) {
  const isUser = role === "user";
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="group flex items-start gap-3 px-6 py-4">
      {isUser ? (
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-raised text-text-muted">
          <User className="size-4" />
        </div>
      ) : (
        <Avatar emoji={agent.avatar_emoji} color={agent.avatar_color} size={32} className="rounded-full" />
      )}
      <div className="min-w-0 flex-1 pt-1">
        <p className="mb-1 text-xs font-medium text-text-faint">{isUser ? "You" : agent.title}</p>
        <MarkdownContent content={content} />

        {!isUser && (
          <div className="mt-1.5 flex items-center gap-0.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
            <button
              type="button"
              aria-label="Copy message"
              onClick={handleCopy}
              className="flex size-6 items-center justify-center rounded-md text-text-faint transition-colors duration-100 hover:bg-surface-hover hover:text-text-muted"
            >
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            </button>
            {onRetry && (
              <button
                type="button"
                aria-label="Retry"
                onClick={onRetry}
                className="flex size-6 items-center justify-center rounded-md text-text-faint transition-colors duration-100 hover:bg-surface-hover hover:text-text-muted"
              >
                <RotateCcw className="size-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
