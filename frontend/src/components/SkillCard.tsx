import { Zap } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Tag } from "@/components/ui/Tag";
import type { Skill } from "@/types";

export function SkillCard({ skill, onClick }: { skill: Skill; onClick?: () => void }) {
  return (
    <Card
      className="flex cursor-pointer flex-col gap-3 p-4 hover:border-border-strong hover:shadow-sm"
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-raised text-lg">
            {skill.icon}
          </div>
          <div>
            <h3 className="text-[15px] font-semibold text-text">{skill.name}</h3>
            <p className="text-xs text-text-faint">{skill.author}</p>
          </div>
        </div>
        {skill.is_functional && (
          <Tag tone="success" title="This skill is wired up and callable by agents">
            <Zap className="size-3" />
            Live
          </Tag>
        )}
      </div>

      <p className="line-clamp-3 text-sm leading-relaxed text-text-muted">{skill.description}</p>

      {skill.category && (
        <div className="mt-auto pt-1">
          <Tag tone="accent">{skill.category.name}</Tag>
        </div>
      )}
    </Card>
  );
}
