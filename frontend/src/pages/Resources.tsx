import { Download, FileText, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { resourceDownloadUrl, useDeleteResource, useResources, useUploadResource } from "@/api/resources";
import { AssistantSidebar } from "@/components/AssistantSidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Spinner } from "@/components/ui/Spinner";
import { formatBytes, timeAgo } from "@/lib/format";

const ACCEPT = ".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.md,.txt,.csv";

/**
 * Workspace-level file storage (PDF, Word, PPT, Excel, Markdown, text, CSV) -
 * distinct from the per-agent Knowledge base, which only keeps derived text
 * chunks for RAG. These are raw files anyone in the workspace can fetch back,
 * stored in Azure Blob Storage (see backend/app/services/blob_storage.py).
 */
export function Resources() {
  const resourcesQuery = useResources();
  const upload = useUploadResource();
  const deleteResource = useDeleteResource();
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  const resources = resourcesQuery.data ?? [];

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
                Files anyone in your workspace can save and fetch back — PDF, Word, PPT, Excel,
                Markdown, text, CSV.
              </p>
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={upload.isPending}
              className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
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
                  <div key={r.id} className="group flex items-center gap-3 px-4 py-3">
                    <FileText className="size-4 shrink-0 text-text-faint" />
                    <span className="min-w-0 flex-1 truncate text-sm text-text">{r.filename}</span>
                    <span className="shrink-0 text-xs text-text-faint">{formatBytes(r.size_bytes)}</span>
                    <span className="shrink-0 text-xs text-text-faint">{timeAgo(r.created_at)}</span>
                    <a
                      href={resourceDownloadUrl(r.id)}
                      className="flex size-7 shrink-0 items-center justify-center rounded-md text-text-faint opacity-0 transition-opacity hover:bg-surface-hover hover:text-text group-hover:opacity-100"
                      aria-label={`Download ${r.filename}`}
                    >
                      <Download className="size-3.5" />
                    </a>
                    <button
                      onClick={() => deleteResource.mutate(r.id)}
                      className="flex size-7 shrink-0 items-center justify-center rounded-md text-text-faint opacity-0 transition-opacity hover:bg-danger/10 hover:text-danger group-hover:opacity-100"
                      aria-label={`Delete ${r.filename}`}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
