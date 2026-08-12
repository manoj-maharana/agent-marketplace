import { AlertCircle, Download, FileText, Link2, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { useAgents } from "@/api/agents";
import { resourceDownloadUrl, useAttachResource, useDeleteResource, useDetachResource, useResources, useUploadResource } from "@/api/resources";
import { AssistantSidebar } from "@/components/AssistantSidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Spinner } from "@/components/ui/Spinner";
import { formatBytes, timeAgo } from "@/lib/format";
import type { Resource } from "@/types";

const ACCEPT = ".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.md,.txt,.csv";

/**
 * Workspace-level file storage (PDF, Word, PPT, Excel, Markdown, text, CSV),
 * stored in Azure Blob Storage. Each upload is extracted, chunked, and
 * embedded automatically (see backend/app/framework/resource_processing.py)
 * so it can be attached to any number of agents for RAG - one upload,
 * reusable everywhere, rather than a separate per-agent upload each time.
 */
export function Resources() {
  const resourcesQuery = useResources();
  const agentsQuery = useAgents({ scope: "library", page_size: 60 });
  const upload = useUploadResource();
  const deleteResource = useDeleteResource();
  const attach = useAttachResource();
  const detach = useDetachResource();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [attachPickerId, setAttachPickerId] = useState<number | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    upload.mutate(file, {
      onError: (err) => setError(err instanceof Error ? err.message : "Upload failed"),
    });
  }

  const resources = resourcesQuery.data ?? [];
  const agents = agentsQuery.data?.items ?? [];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg text-text">
      <AssistantSidebar />
      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4">
          <span />
          <ThemeToggle />
        </div>

        <div className="mx-auto w-full max-w-3xl flex-1 px-6 pb-12">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Resources</h1>
              <p className="mt-1 text-sm text-text-muted">
                Files anyone in your workspace can save, search, and fetch back — PDF, Word, PPT,
                Excel, Markdown, text, CSV. Attach any file to an agent to ground its answers in it.
              </p>
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={upload.isPending}
              className="flex shrink-0 items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
            >
              {upload.isPending ? (
                <span className="size-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              ) : (
                <Upload className="size-4" />
              )}
              Upload file
            </button>
            <input ref={fileInputRef} type="file" accept={ACCEPT} className="hidden" onChange={handleFileChange} />
          </div>

          {error && (
            <div className="mt-4 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
              {error}
            </div>
          )}

          <div className="mt-6">
            {resourcesQuery.isLoading ? (
              <div className="flex justify-center py-12">
                <Spinner />
              </div>
            ) : resources.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border px-6 py-16 text-center">
                <FileText className="size-8 text-text-faint" />
                <p className="text-sm text-text-muted">No files yet — upload one to get started.</p>
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-surface">
                {resources.map((r) => (
                  <ResourceRow
                    key={r.id}
                    resource={r}
                    agents={agents}
                    pickerOpen={attachPickerId === r.id}
                    onTogglePicker={() => setAttachPickerId(attachPickerId === r.id ? null : r.id)}
                    onAttach={(agentId) => {
                      attach.mutate({ resourceId: r.id, agentId });
                      setAttachPickerId(null);
                    }}
                    onDetach={(agentId) => detach.mutate({ resourceId: r.id, agentId })}
                    onDelete={() => deleteResource.mutate(r.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function StatusLabel({ resource }: { resource: Resource }) {
  if (resource.processing_error) {
    return (
      <span className="flex items-center gap-1 text-xs text-danger">
        <AlertCircle className="size-3" />
        Not indexed
      </span>
    );
  }
  if (!resource.is_processed) {
    return <span className="text-xs text-text-faint">Processing…</span>;
  }
  return <span className="text-xs text-text-faint">{resource.chunk_count} chunks indexed</span>;
}

function ResourceRow({
  resource,
  agents,
  pickerOpen,
  onTogglePicker,
  onAttach,
  onDetach,
  onDelete,
}: {
  resource: Resource;
  agents: { id: number; title: string; avatar_emoji: string }[];
  pickerOpen: boolean;
  onTogglePicker: () => void;
  onAttach: (agentId: number) => void;
  onDetach: (agentId: number) => void;
  onDelete: () => void;
}) {
  const attachedAgents = agents.filter((a) => resource.attached_agent_ids.includes(a.id));
  const unattachedAgents = agents.filter((a) => !resource.attached_agent_ids.includes(a.id));

  return (
    <div className="group px-4 py-3">
      <div className="flex items-center gap-3">
        <FileText className="size-4 shrink-0 text-text-faint" />
        <div className="min-w-0 flex-1">
          <span className="block truncate text-sm text-text">{resource.filename}</span>
          <StatusLabel resource={resource} />
        </div>
        <span className="shrink-0 text-xs text-text-faint">{formatBytes(resource.size_bytes)}</span>
        <span className="shrink-0 text-xs text-text-faint">{timeAgo(resource.created_at)}</span>
        <button
          onClick={onTogglePicker}
          aria-label="Attach to agent"
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-text-faint opacity-0 transition-opacity hover:bg-surface-hover hover:text-text group-hover:opacity-100"
        >
          <Link2 className="size-3.5" />
        </button>
        <a
          href={resourceDownloadUrl(resource.id)}
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-text-faint opacity-0 transition-opacity hover:bg-surface-hover hover:text-text group-hover:opacity-100"
          aria-label={`Download ${resource.filename}`}
        >
          <Download className="size-3.5" />
        </a>
        <button
          onClick={onDelete}
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-text-faint opacity-0 transition-opacity hover:bg-danger/10 hover:text-danger group-hover:opacity-100"
          aria-label={`Delete ${resource.filename}`}
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>

      {attachedAgents.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5 pl-7">
          {attachedAgents.map((a) => (
            <button
              key={a.id}
              onClick={() => onDetach(a.id)}
              className="flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11px] text-text-muted transition-colors hover:border-danger/30 hover:text-danger"
              title="Click to detach"
            >
              {a.avatar_emoji} {a.title}
            </button>
          ))}
        </div>
      )}

      {pickerOpen && (
        <div className="mt-2 flex items-center gap-2 pl-7">
          <select
            defaultValue=""
            onChange={(e) => e.target.value && onAttach(Number(e.target.value))}
            className="min-w-0 flex-1 rounded-md border border-border bg-surface px-2 py-1 text-xs text-text-muted outline-none"
          >
            <option value="" disabled>
              Attach to agent…
            </option>
            {unattachedAgents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.avatar_emoji} {a.title}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
