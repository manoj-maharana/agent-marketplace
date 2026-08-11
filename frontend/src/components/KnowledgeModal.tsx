import { FileText, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { useDeleteKnowledgeFile, useKnowledgeFiles, useUploadKnowledgeFile } from "@/api/knowledge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Spinner } from "@/components/ui/Spinner";

interface KnowledgeModalProps {
  agentId: number | undefined;
  open: boolean;
  onClose: () => void;
}

export function KnowledgeModal({ agentId, open, onClose }: KnowledgeModalProps) {
  const filesQuery = useKnowledgeFiles(agentId);
  const upload = useUploadKnowledgeFile(agentId);
  const deleteFile = useDeleteKnowledgeFile(agentId);
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    upload.mutate(file, {
      onError: (err) => setError(err instanceof Error ? err.message : "Upload failed"),
    });
  }

  return (
    <Modal open={open} onClose={onClose} title="Knowledge files">
      <p className="mb-4 text-sm text-text-muted">
        Attach <code className="rounded bg-surface-raised px-1 py-0.5">.txt</code> or{" "}
        <code className="rounded bg-surface-raised px-1 py-0.5">.md</code> files. This agent will search
        them for relevant context before answering.
      </p>

      {error && (
        <div className="mb-4 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".txt,.md"
        className="hidden"
        onChange={handleFileChange}
      />
      <Button
        variant="secondary"
        icon={<Upload className="size-3.5" />}
        loading={upload.isPending}
        onClick={() => inputRef.current?.click()}
        className="w-full justify-center"
      >
        Upload file
      </Button>

      <div className="mt-4 flex flex-col gap-2">
        {filesQuery.isLoading ? (
          <div className="flex justify-center py-6">
            <Spinner />
          </div>
        ) : filesQuery.data && filesQuery.data.length > 0 ? (
          filesQuery.data.map((f) => (
            <div
              key={f.id}
              className="flex items-center gap-2.5 rounded-lg border border-border px-3 py-2"
            >
              <FileText className="size-4 shrink-0 text-text-faint" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-text">{f.filename}</p>
                <p className="text-xs text-text-faint">{f.chunk_count} chunks</p>
              </div>
              <button
                onClick={() => deleteFile.mutate(f.id)}
                className="flex size-7 shrink-0 items-center justify-center rounded-lg text-text-faint transition-colors hover:bg-danger/10 hover:text-danger"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))
        ) : (
          <p className="py-6 text-center text-sm text-text-faint">No files attached yet.</p>
        )}
      </div>
    </Modal>
  );
}
