import { FormEvent, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload } from 'lucide-react';
import { uploadDocument } from '../lib/api';

interface DocumentUploadPanelProps {
  compact?: boolean;
}

export function DocumentUploadPanel({ compact = false }: DocumentUploadPanelProps) {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [docType, setDocType] = useState('engineering');
  const [securityLevel, setSecurityLevel] = useState('internal');
  const [success, setSuccess] = useState(false);

  const uploadMutation = useMutation({
    mutationFn: () => {
      if (!file || !title) throw new Error('File and title required');
      return uploadDocument(file, {
        title,
        docType,
        department: 'Engineering',
        securityLevel,
        projectId: 'proj-substation-alpha',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      setFile(null);
      setTitle('');
      setSuccess(true);
      setTimeout(() => setSuccess(false), 4000);
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    uploadMutation.mutate();
  }

  return (
    <form onSubmit={handleSubmit} className={compact ? 'space-y-3' : 'rounded-xl border border-charcoal-700 bg-charcoal-900 p-6'}>
      {!compact && (
        <h2 className="mb-4 flex items-center gap-2 text-lg font-medium text-white">
          <Upload className="h-5 w-5 text-accent" />
          Upload Document
        </h2>
      )}
      {compact && (
        <h3 className="flex items-center gap-2 text-sm font-medium text-white">
          <Upload className="h-4 w-4 text-accent" />
          Upload Document
        </h3>
      )}
      <input
        type="text"
        placeholder="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full rounded-lg border border-charcoal-700 bg-charcoal-800 px-3 py-2 text-sm text-white"
        required
      />
      <select
        value={docType}
        onChange={(e) => setDocType(e.target.value)}
        className="w-full rounded-lg border border-charcoal-700 bg-charcoal-800 px-3 py-2 text-sm text-white"
      >
        <option value="engineering">Engineering</option>
        <option value="safety_sop">Safety SOP</option>
        <option value="contract">Contract</option>
        <option value="project_report">Project Report</option>
      </select>
      <input
        type="file"
        accept=".md,.txt,.pdf"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="w-full text-xs text-gray-400"
        required
      />
      <select
        value={securityLevel}
        onChange={(e) => setSecurityLevel(e.target.value)}
        className="w-full rounded-lg border border-charcoal-700 bg-charcoal-800 px-3 py-2 text-sm text-white"
      >
        <option value="public">Public</option>
        <option value="internal">Internal</option>
        <option value="confidential">Confidential</option>
        <option value="restricted">Restricted</option>
      </select>
      {uploadMutation.error && (
        <p className="text-xs text-red-400">{(uploadMutation.error as Error).message}</p>
      )}
      {success && (
        <p className="text-xs text-green-400">Uploaded - processing for RAG indexing…</p>
      )}
      <button
        type="submit"
        disabled={uploadMutation.isPending}
        className="w-full rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
      >
        {uploadMutation.isPending ? 'Uploading…' : 'Upload & Process'}
      </button>
    </form>
  );
}
