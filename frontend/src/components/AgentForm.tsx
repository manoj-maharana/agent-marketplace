import { useState } from "react";
import { useCategories } from "@/api/categories";
import { useSkills } from "@/api/skills";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, TextArea } from "@/components/ui/Input";
import { cn } from "@/lib/cn";
import type { Agent, AgentCreatePayload } from "@/types";

const COLORS = [
  "#6366f1",
  "#f59e0b",
  "#0ea5e9",
  "#22c55e",
  "#a855f7",
  "#ec4899",
  "#14b8a6",
  "#ef4444",
];

const EMOJIS = ["🤖", "🧠", "✨", "🚀", "🦉", "🧭", "🎯", "🛠️", "📚", "💡"];

interface AgentFormProps {
  initialAgent?: Agent;
  submitLabel: string;
  submitting: boolean;
  onSubmit: (payload: Required<AgentCreatePayload>) => void;
  onCancel: () => void;
}

export function AgentForm({ initialAgent, submitLabel, submitting, onSubmit, onCancel }: AgentFormProps) {
  const categoriesQuery = useCategories("agent");
  const skillsQuery = useSkills({ page_size: 60 });

  const [title, setTitle] = useState(initialAgent?.title ?? "");
  const [description, setDescription] = useState(initialAgent?.description ?? "");
  const [systemPrompt, setSystemPrompt] = useState(
    initialAgent?.system_prompt ?? "You are a helpful, concise assistant.",
  );
  const [categorySlug, setCategorySlug] = useState<string | undefined>(initialAgent?.category?.slug);
  const [emoji, setEmoji] = useState(initialAgent?.avatar_emoji ?? "🤖");
  const [color, setColor] = useState(initialAgent?.avatar_color ?? COLORS[0]);
  const [temperature, setTemperature] = useState(initialAgent?.temperature ?? 0.7);
  const [skillIds, setSkillIds] = useState<number[]>(initialAgent?.skills.map((s) => s.id) ?? []);

  const canSubmit = title.trim().length > 0 && !submitting;

  function handleSubmit() {
    if (!canSubmit) return;
    onSubmit({
      title: title.trim(),
      description: description.trim(),
      system_prompt: systemPrompt.trim(),
      category_slug: categorySlug ?? null,
      avatar_emoji: emoji,
      avatar_color: color,
      temperature,
      skill_ids: skillIds,
      tags: initialAgent?.tags ?? [],
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="flex items-center gap-4 p-4">
        <Avatar emoji={emoji} color={color} size={56} />
        <div className="flex-1">
          <div className="mb-2 flex flex-wrap gap-1.5">
            {EMOJIS.map((e) => (
              <button
                key={e}
                onClick={() => setEmoji(e)}
                className={cn(
                  "flex size-8 items-center justify-center rounded-lg border text-base transition-colors",
                  emoji === e ? "border-accent bg-accent-soft" : "border-border hover:bg-surface-hover",
                )}
              >
                {e}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={cn(
                  "size-6 rounded-full border-2 transition-transform",
                  color === c ? "scale-110 border-text" : "border-transparent",
                )}
                style={{ background: c }}
              />
            ))}
          </div>
        </div>
      </Card>

      <Field label="Name">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Contract Reviewer" />
      </Field>

      <Field label="Short description">
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What does this agent help with?"
        />
      </Field>

      <Field label="Category">
        <div className="flex flex-wrap gap-2">
          {(categoriesQuery.data ?? []).map((c) => (
            <button
              key={c.slug}
              onClick={() => setCategorySlug(categorySlug === c.slug ? undefined : c.slug)}
              className={cn(
                "rounded-full border px-3 py-1 text-sm transition-colors",
                categorySlug === c.slug
                  ? "border-accent bg-accent-soft text-accent"
                  : "border-border text-text-muted hover:bg-surface-hover",
              )}
            >
              {c.name}
            </button>
          ))}
        </div>
      </Field>

      <Field label="System prompt">
        <TextArea
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          rows={5}
          placeholder="Describe how this agent should behave..."
        />
      </Field>

      <Field label={`Temperature: ${temperature.toFixed(1)}`}>
        <input
          type="range"
          min={0}
          max={1}
          step={0.1}
          value={temperature}
          onChange={(e) => setTemperature(Number(e.target.value))}
          className="w-full accent-accent"
        />
      </Field>

      <Field label="Skills this agent can use">
        <div className="grid grid-cols-2 gap-2">
          {(skillsQuery.data?.items ?? []).map((s) => {
            const checked = skillIds.includes(s.id);
            return (
              <label
                key={s.id}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                  checked ? "border-accent bg-accent-soft" : "border-border hover:bg-surface-hover",
                )}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() =>
                    setSkillIds((ids) => (checked ? ids.filter((id) => id !== s.id) : [...ids, s.id]))
                  }
                  className="accent-accent"
                />
                <span>{s.icon}</span>
                <span className="truncate">{s.name}</span>
                {!s.is_functional && (
                  <span className="ml-auto shrink-0 text-xs text-text-faint">catalog</span>
                )}
              </label>
            );
          })}
        </div>
      </Field>

      <div className="flex justify-end gap-3 pb-8">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} loading={submitting} disabled={!canSubmit}>
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-text">{label}</label>
      {children}
    </div>
  );
}
