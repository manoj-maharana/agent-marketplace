import { AlertCircle, FileText, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { useAttachResource, useDetachResource, useResources, useUploadResource } from "@/api/resources";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Spinner } from "@/components/ui/Spinner";

interface KnowledgeModalProps {
  agentId: number | undefined;
  open: boolean;
  onClose: () => void;
}

const ACCEPT = ".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.md,.txt,.csv";

/**
 * Which documents this agent draws on for RAG - backed by the workspace-level
 * Resources feature (see pages/Resources.tsx) rather than a per-agent-only
 * upload: a resource uploaded once can be attached to any number of agents.
 */
export function KnowledgeModal({ agentId, open, onClose }: KnowledgeModalProps) {
  const resourcesQuery = useResources();
  const upload = useUploadResource();
  const attach = useAttachResource();
  const detach = useDetachResource();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pickerId, setPickerId] = useState<number | "">("");

  const resources = resourcesQuery.data ?? [];
  const attached = agentId ? resources.filter((r) => r.attached_agent_ids.includes(agentId)) : [];
  const unattached = agentId ? resources.filter((r) => !r.attached_agent_ids.includes(agentId)) : [];

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !agentId) return;
    setError(null);
    upload.mutate(file, {
      onSuccess: (resource) => attach.mutate({ resourceId: resource.id, agentId }),
      onError: (err) => setError(err instanceof Error ? err.message : "Upload failed"),
    });
  }

  function handleAttachExisting() {
    if (!agentId || pickerId === "") return;
    attach.mutate({ resourceId: pickerId, agentId }, { onSuccess: () => setPickerId("") });
  }

  return (
    <Modal open={open} onClose={onClose} title="Knowledge">
      <p className="mb-4 text-sm text-text-muted">
        Documents this agent searches for relevant context before answering. Uploaded here or on the{" "}
        <a href="/assistant/resources" className="text-accent underline">
          Resources
        </a>{" "}
        page — either way, one file can be attached to any number of agents.
      </p>

      {error && (
        <div className="mb-4 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </div>
      )}

      <input ref={inputRef} type="file" accept={ACCEPT} className="hidden" onChange={handleFileChange} />
      <Button
        variant="secondary"
        icon={<Upload className="size-3.5" />}
        loading={upload.isPending}
        onClick={() => inputRef.current?.click()}
        className="w-full justify-center"
      >
        Upload file
      </Button>

      {unattached.length > 0 && (
        <div className="mt-3 flex items-center gap-2">
          <select
            value={pickerId}
            onChange={(e) => setPickerId(e.target.value ? Number(e.target.value) : "")}
            className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-2 py-1.5 text-xs text-text-muted outline-none"
          >
            <option value="">Attach an existing resource…</option>
            {unattached.map((r) => (
              <option key={r.id} value={r.id}>
                {r.filename}
              </option>
            ))}
          </select>
          <Button size="sm" variant="secondary" disabled={pickerId === ""} onClick={handleAttachExisting}>
            Attach
          </Button>
        </div>
      )}

      <div className="mt-4 flex flex-col gap-2">
        {resourcesQuery.isLoading ? (
          <div className="flex justify-center py-6">
            <Spinner />
          </div>
        ) : attached.length > 0 ? (
          attached.map((r) => (
            <div key={r.id} className="flex items-center gap-2.5 rounded-lg border border-border px-3 py-2">
              <FileText className="size-4 shrink-0 text-text-faint" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-text">{r.filename}</p>
                {r.processing_error ? (
                  <p className="flex items-center gap-1 text-xs text-danger">
                    <AlertCircle className="size-3" />
                    {r.processing_error}
                  </p>
                ) : (
                  <p className="text-xs text-text-faint">
                    {r.is_processed ? `${r.chunk_count} chunks` : "Processing…"}
                  </p>
                )}
              </div>
              <button
                onClick={() => agentId && detach.mutate({ resourceId: r.id, agentId })}
                className="flex size-7 shrink-0 items-center justify-center rounded-lg text-text-faint transition-colors hover:bg-danger/10 hover:text-danger"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))
        ) : (
          <p className="py-6 text-center text-sm text-text-faint">No documents attached yet.</p>
        )}
      </div>
    </Modal>
  );
}
