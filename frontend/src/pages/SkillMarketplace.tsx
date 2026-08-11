import { useState } from "react";
import { useCategories } from "@/api/categories";
import { useSkills } from "@/api/skills";
import { CategoryRail } from "@/components/CategoryRail";
import { Pagination } from "@/components/Pagination";
import { SearchBar } from "@/components/SearchBar";
import { SkillCard } from "@/components/SkillCard";
import { SkillDetailModal } from "@/components/SkillDetailModal";
import { Spinner } from "@/components/ui/Spinner";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import type { Skill } from "@/types";

const PAGE_SIZE = 12;

export function SkillMarketplace() {
  const [category, setCategory] = useState<string | undefined>();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const debouncedSearch = useDebouncedValue(search);

  const categoriesQuery = useCategories("skill");
  const skillsQuery = useSkills({
    category,
    q: debouncedSearch || undefined,
    page,
    page_size: PAGE_SIZE,
  });

  return (
    <div className="mx-auto flex h-full max-w-6xl gap-8 overflow-y-auto px-8 py-8">
      <CategoryRail
        categories={categoriesQuery.data ?? []}
        active={category}
        onSelect={(slug) => {
          setCategory(slug);
          setPage(1);
        }}
      />

      <div className="min-w-0 flex-1">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Skill Marketplace</h1>
            <p className="mt-1 text-sm text-text-muted">
              Skills are tools agents can call mid-conversation. "Live" skills are wired up end to end.
            </p>
          </div>
          <SearchBar
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            placeholder="Search skills..."
          />
        </div>

        {skillsQuery.isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <Spinner />
          </div>
        ) : skillsQuery.data && skillsQuery.data.items.length > 0 ? (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {skillsQuery.data.items.map((skill) => (
                <SkillCard key={skill.id} skill={skill} onClick={() => setSelectedSkill(skill)} />
              ))}
            </div>
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              total={skillsQuery.data.total}
              onPageChange={setPage}
            />
          </>
        ) : (
          <div className="flex h-64 flex-col items-center justify-center text-center text-text-muted">
            <p className="font-medium text-text">No skills found</p>
            <p className="mt-1 text-sm">Try a different search term or category.</p>
          </div>
        )}
      </div>

      <SkillDetailModal skill={selectedSkill} onClose={() => setSelectedSkill(null)} />
    </div>
  );
}
