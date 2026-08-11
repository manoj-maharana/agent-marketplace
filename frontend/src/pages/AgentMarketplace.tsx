import { useState } from "react";
import { useAgents, useInstallAgent } from "@/api/agents";
import { useCategories } from "@/api/categories";
import { AgentCard } from "@/components/AgentCard";
import { CategoryRail } from "@/components/CategoryRail";
import { Pagination } from "@/components/Pagination";
import { SearchBar } from "@/components/SearchBar";
import { Spinner } from "@/components/ui/Spinner";
import { useDebouncedValue } from "@/lib/useDebouncedValue";

const PAGE_SIZE = 12;

export function AgentMarketplace() {
  const [category, setCategory] = useState<string | undefined>();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search);

  const categoriesQuery = useCategories("agent");
  const agentsQuery = useAgents({
    category,
    q: debouncedSearch || undefined,
    page,
    page_size: PAGE_SIZE,
  });
  const install = useInstallAgent();

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
            <h1 className="text-2xl font-semibold tracking-tight">Agent Marketplace</h1>
            <p className="mt-1 text-sm text-text-muted">
              Browse ready-made AI agents and add them to your chat library.
            </p>
          </div>
          <SearchBar
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            placeholder="Search agents..."
          />
        </div>

        {agentsQuery.isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <Spinner />
          </div>
        ) : agentsQuery.data && agentsQuery.data.items.length > 0 ? (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {agentsQuery.data.items.map((agent) => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  onInstall={(id) => install.mutate(id)}
                  installing={install.isPending && install.variables === agent.id}
                />
              ))}
            </div>
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              total={agentsQuery.data.total}
              onPageChange={setPage}
            />
          </>
        ) : (
          <div className="flex h-64 flex-col items-center justify-center text-center text-text-muted">
            <p className="font-medium text-text">No agents found</p>
            <p className="mt-1 text-sm">Try a different search term or category.</p>
          </div>
        )}
      </div>
    </div>
  );
}
