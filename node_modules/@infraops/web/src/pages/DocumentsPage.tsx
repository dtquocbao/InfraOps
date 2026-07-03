import { useQuery } from '@tanstack/react-query';
import { FileText, RefreshCw } from 'lucide-react';
import { fetchDocuments } from '../lib/api';
import { DocumentUploadPanel } from '../components/DocumentUploadPanel';

export function DocumentsPage() {
  const { data: documents, isLoading, refetch } = useQuery({
    queryKey: ['documents'],
    queryFn: fetchDocuments,
    refetchInterval: 5000,
  });

  const statusColor: Record<string, string> = {
    ready: 'text-green-400',
    queued: 'text-yellow-400',
    parsing: 'text-yellow-400',
    chunking: 'text-yellow-400',
    embedding: 'text-yellow-400',
    indexing: 'text-yellow-400',
    pending: 'text-gray-400',
  };

  return (
    <div>
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Documents</h1>
          <p className="mt-1 text-gray-400">Upload and monitor document processing pipeline</p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          className="flex items-center gap-2 rounded-lg border border-charcoal-700 px-3 py-2 text-sm text-gray-400 hover:text-white"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </header>

      <div className="mb-8">
        <DocumentUploadPanel />
      </div>

      <div className="rounded-xl border border-charcoal-700 bg-charcoal-900">
        <div className="border-b border-charcoal-700 px-6 py-4">
          <h2 className="flex items-center gap-2 font-medium text-white">
            <FileText className="h-5 w-5 text-accent" />
            Document Library ({documents?.length ?? 0})
          </h2>
        </div>
        {isLoading ? (
          <p className="p-6 text-gray-400">Loading…</p>
        ) : (
          <div className="divide-y divide-charcoal-700">
            {documents?.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between px-6 py-4">
                <div>
                  <p className="font-medium text-white">{doc.title}</p>
                  <p className="text-sm text-gray-500">
                    {doc.docType} · rev {doc.revision} · {doc.chunkCount ?? 0} chunks
                  </p>
                </div>
                <span className={`text-sm font-medium ${statusColor[doc.processingStatus] ?? 'text-gray-400'}`}>
                  {doc.processingStatus}
                </span>
              </div>
            ))}
            {!documents?.length && (
              <p className="p-6 text-center text-gray-500">No documents yet. Run db:seed or upload one.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
