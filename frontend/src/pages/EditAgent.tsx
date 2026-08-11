import { Trash2 } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useAgent, useDeleteAgent, useUpdateAgent } from "@/api/agents";
import { AgentForm } from "@/components/AgentForm";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";

export function EditAgent() {
  const { agentId } = useParams<{ agentId: string }>();
  const id = agentId ? Number(agentId) : undefined;
  const navigate = useNavigate();

  const agentQuery = useAgent(id);
  const updateAgent = useUpdateAgent();
  const deleteAgent = useDeleteAgent();

  if (agentQuery.isLoading || !agentQuery.data) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    );
  }

  const agent = agentQuery.data;

  if (!agent.is_custom) {
    return (
      <div className="mx-auto max-w-3xl px-8 py-8 text-sm text-text-muted">
        Only custom agents can be edited. Fork this agent from its detail page to make your own
        editable copy.
      </div>
    );
  }

  return (
    <div className="mx-auto h-full max-w-3xl overflow-y-auto px-8 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Edit {agent.title}</h1>
          <p className="mt-1 text-sm text-text-muted">Update the persona, prompt, or skills.</p>
        </div>
        <Button
          variant="danger"
          size="sm"
          icon={<Trash2 className="size-3.5" />}
          onClick={() => {
            if (confirm(`Delete "${agent.title}"? This can't be undone.`)) {
              deleteAgent.mutate(agent.id, { onSuccess: () => navigate("/agents") });
            }
          }}
        >
          Delete
        </Button>
      </div>

      <div className="mt-8">
        <AgentForm
          initialAgent={agent}
          submitLabel="Save changes"
          submitting={updateAgent.isPending}
          onCancel={() => navigate(`/agents/${agent.id}`)}
          onSubmit={async (payload) => {
            await updateAgent.mutateAsync({ id: agent.id, payload });
            navigate(`/agents/${agent.id}`);
          }}
        />
      </div>
    </div>
  );
}
