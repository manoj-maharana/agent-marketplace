import { User } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { MarkdownContent } from "@/components/MarkdownContent";
import type { Agent } from "@/types";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  agent: Agent;
}

export function ChatMessage({ role, content, agent }: ChatMessageProps) {
  const isUser = role === "user";
  return (
    <div className="flex items-start gap-3 px-6 py-4">
      {isUser ? (
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-raised text-text-muted">
          <User className="size-4" />
        </div>
      ) : (
        <Avatar emoji={agent.avatar_emoji} color={agent.avatar_color} size={32} className="rounded-full" />
      )}
      <div className="min-w-0 flex-1 pt-1">
        <p className="mb-1 text-xs font-medium text-text-faint">{isUser ? "You" : agent.title}</p>
        {content ? (
          <MarkdownContent content={content} />
        ) : (
          <span className="inline-flex gap-1">
            <span className="size-1.5 animate-pulse-dot rounded-full bg-text-faint" />
            <span className="size-1.5 animate-pulse-dot rounded-full bg-text-faint [animation-delay:0.15s]" />
            <span className="size-1.5 animate-pulse-dot rounded-full bg-text-faint [animation-delay:0.3s]" />
          </span>
        )}
      </div>
    </div>
  );
}
