import { ExternalLink, Star, Users, Zap } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Tag } from "@/components/ui/Tag";
import { cn } from "@/lib/cn";
import { seededRange, seededRating } from "@/lib/pseudoRandom";
import type { Skill } from "@/types";

const TABS = ["Overview", "Install", "Reviews", "Info"] as const;
type Tab = (typeof TABS)[number];

interface SkillDetailModalProps {
  skill: Skill | null;
  onClose: () => void;
}

export function SkillDetailModal({ skill, onClose }: SkillDetailModalProps) {
  const [tab, setTab] = useState<Tab>("Overview");

  if (!skill) return null;

  const rating = seededRating(skill.slug);
  const installs = seededRange(skill.slug, 40, 5000);
  const reviewCount = seededRange(skill.slug + "r", 0, 90);

  return (
    <Modal open={!!skill} onClose={onClose} title="Skill Details">
      <div className="flex items-start gap-3">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-surface-raised text-2xl">
          {skill.icon}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold text-text">{skill.name}</h3>
          <p className="text-sm text-text-faint">{skill.author}</p>
        </div>
        {skill.is_functional && (
          <Tag tone="success">
            <Zap className="size-3" />
            Live
          </Tag>
        )}
      </div>

      <div className="mt-4 flex items-center gap-4 text-sm text-text-muted">
        <span className="flex items-center gap-1">
          <Star className="size-3.5 fill-current text-amber-400" />
          {rating.toFixed(1)}
          <span className="text-text-faint">({reviewCount})</span>
        </span>
        <span className="flex items-center gap-1">
          <Users className="size-3.5" />
          {installs.toLocaleString()} installs
        </span>
        {skill.category && <Tag tone="accent">{skill.category.name}</Tag>}
      </div>

      <div className="mt-4 flex gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              tab === t
                ? "border-accent text-accent"
                : "border-transparent text-text-muted hover:text-text",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="pt-4">
        {tab === "Overview" && (
          <div className="flex flex-col gap-3 text-sm">
            <p className="leading-relaxed text-text-muted">{skill.description}</p>
            <p className="leading-relaxed text-text-muted">
              {skill.is_functional
                ? "This skill is wired up end to end: any agent with it enabled can call it automatically mid-conversation whenever it would help answer your question."
                : "This is a catalog listing describing what the skill would do. It isn't wired up to a live implementation yet — think of it as a placeholder an agent could be extended with."}
            </p>
          </div>
        )}

        {tab === "Install" && (
          <div className="flex flex-col gap-2 text-sm text-text-muted">
            <p>
              Skills aren't installed on their own — enable them on an agent instead. Fork any
              marketplace agent (or edit a custom one) and turn this skill on in its skill list.
            </p>
          </div>
        )}

        {tab === "Reviews" && (
          <div className="py-6 text-center text-sm text-text-faint">
            No reviews yet.
          </div>
        )}

        {tab === "Info" && (
          <div className="divide-y divide-border text-sm">
            <InfoRow label="Category" value={skill.category?.name ?? "Uncategorized"} />
            <InfoRow label="Author" value={skill.author} />
            <InfoRow label="Status" value={skill.is_functional ? "Live (callable)" : "Catalog only"} />
            <InfoRow
              label="Source"
              value={
                skill.source_url ? (
                  <a
                    href={skill.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-accent hover:text-accent-hover"
                  >
                    {isGitHubUrl(skill.source_url) ? "View on GitHub" : "View source"}
                    <ExternalLink className="size-3" />
                  </a>
                ) : (
                  "—"
                )
              }
            />
          </div>
        )}
      </div>
    </Modal>
  );
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <span className="text-text-faint">{label}</span>
      <span className="font-medium text-text">{value}</span>
    </div>
  );
}

function isGitHubUrl(url: string): boolean {
  try {
    return new URL(url).hostname.replace(/^www\./, "") === "github.com";
  } catch {
    return false;
  }
}
