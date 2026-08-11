import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useAgents, useInstallAgent } from "@/api/agents";
import { useSkills } from "@/api/skills";
import { AgentCard } from "@/components/AgentCard";
import { GeneralChatHero } from "@/components/GeneralChatHero";
import { SkillCard } from "@/components/SkillCard";
import { SkillDetailModal } from "@/components/SkillDetailModal";
import { Spinner } from "@/components/ui/Spinner";
import type { Skill } from "@/types";

export function Home() {
  const agentsQuery = useAgents({ page_size: 8 });
  const skillsQuery = useSkills({ page_size: 8 });
  const install = useInstallAgent();
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);

  return (
    <div className="mx-auto h-full max-w-6xl overflow-y-auto px-8 py-8">
      <GeneralChatHero />

      <Section title="Featured Agents" moreHref="/agents">
        {agentsQuery.isLoading ? (
          <LoadingRow />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {agentsQuery.data?.items.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                onInstall={(id) => install.mutate(id)}
                installing={install.isPending && install.variables === agent.id}
              />
            ))}
          </div>
        )}
      </Section>

      <Section title="Featured Skills" moreHref="/skills">
        {skillsQuery.isLoading ? (
          <LoadingRow />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {skillsQuery.data?.items.map((skill) => (
              <SkillCard key={skill.id} skill={skill} onClick={() => setSelectedSkill(skill)} />
            ))}
          </div>
        )}
      </Section>

      <SkillDetailModal skill={selectedSkill} onClose={() => setSelectedSkill(null)} />
    </div>
  );
}

function Section({
  title,
  moreHref,
  children,
}: {
  title: string;
  moreHref: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text">{title}</h2>
        <Link
          to={moreHref}
          className="flex items-center gap-1 text-sm font-medium text-accent hover:text-accent-hover"
        >
          Discover more
          <ArrowRight className="size-3.5" />
        </Link>
      </div>
      {children}
    </section>
  );
}

function LoadingRow() {
  return (
    <div className="flex h-40 items-center justify-center">
      <Spinner />
    </div>
  );
}
