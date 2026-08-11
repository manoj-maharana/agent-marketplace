import { Square, ArrowUp } from "lucide-react";
import { useState, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/Button";
import { TextArea } from "@/components/ui/Input";

interface ComposerProps {
  onSend: (content: string) => void;
  onStop: () => void;
  isStreaming: boolean;
  placeholder?: string;
}

export function Composer({ onSend, onStop, isStreaming, placeholder }: ComposerProps) {
  const [value, setValue] = useState("");

  function submit() {
    const trimmed = value.trim();
    if (!trimmed || isStreaming) return;
    onSend(trimmed);
    setValue("");
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="border-t border-border bg-surface px-6 py-4">
      <div className="flex items-end gap-3 rounded-2xl border border-border bg-surface-raised p-2 focus-within:border-accent">
        <TextArea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder={placeholder ?? "Message this agent..."}
          className="max-h-40 min-h-10 flex-1 resize-none border-none bg-transparent px-2 py-1.5 focus:border-none"
        />
        {isStreaming ? (
          <Button variant="secondary" size="sm" icon={<Square className="size-3.5" />} onClick={onStop}>
            Stop
          </Button>
        ) : (
          <Button size="sm" icon={<ArrowUp className="size-4" />} onClick={submit} disabled={!value.trim()} />
        )}
      </div>
    </div>
  );
}
