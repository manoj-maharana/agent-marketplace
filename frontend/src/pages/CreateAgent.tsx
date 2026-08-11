import { useNavigate } from "react-router-dom";
import { useCreateAgent } from "@/api/agents";
import { AgentForm } from "@/components/AgentForm";

export function CreateAgent() {
  const navigate = useNavigate();
  const createAgent = useCreateAgent();

  return (
    <div className="mx-auto h-full max-w-3xl overflow-y-auto px-8 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Create a custom agent</h1>
      <p className="mt-1 text-sm text-text-muted">
        Define a persona, system prompt, and the skills it can call — then start chatting.
      </p>

      <div className="mt-8">
        <AgentForm
          submitLabel="Create & start chat"
          submitting={createAgent.isPending}
          onCancel={() => navigate(-1)}
          onSubmit={async (payload) => {
            const agent = await createAgent.mutateAsync(payload);
            navigate(`/chat/${agent.id}`);
          }}
        />
      </div>
    </div>
  );
}
