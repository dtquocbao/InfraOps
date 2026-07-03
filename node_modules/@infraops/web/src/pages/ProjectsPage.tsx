import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, FileText, FolderKanban, Radio } from 'lucide-react';
import { fetchProject, fetchProjects } from '../lib/api';

export function ProjectsPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: fetchProjects,
  });

  const activeId = selectedId ?? projects?.[0]?.id ?? null;

  const { data: detail } = useQuery({
    queryKey: ['projects', activeId],
    queryFn: () => fetchProject(activeId!),
    enabled: !!activeId,
  });

  const statusColor: Record<string, string> = {
    active: 'text-green-400 bg-green-400/10',
    planning: 'text-yellow-400 bg-yellow-400/10',
    complete: 'text-gray-400 bg-gray-400/10',
  };

  return (
    <div>
      <header className="mb-8">
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-white">
          <FolderKanban className="h-7 w-7 text-accent" />
          Projects
        </h1>
        <p className="mt-1 text-gray-400">Portfolio projects with linked documents and IoT assets</p>
      </header>

      {isLoading ? (
        <p className="text-gray-400">Loading projects…</p>
      ) : !projects?.length ? (
        <div className="rounded-xl border border-dashed border-charcoal-700 bg-charcoal-900 p-12 text-center text-gray-500">
          No projects found. Run <code className="text-accent">npm run db:seed</code> to load demo data.
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-3 lg:col-span-1">
            {projects.map((project) => (
              <button
                key={project.id}
                type="button"
                onClick={() => setSelectedId(project.id)}
                className={`w-full rounded-xl border p-4 text-left transition-colors ${
                  activeId === project.id
                    ? 'border-accent bg-accent/5'
                    : 'border-charcoal-700 bg-charcoal-900 hover:border-charcoal-600'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-white">{project.name}</p>
                    <p className="mt-1 text-sm capitalize text-gray-400">{project.discipline}</p>
                  </div>
                  <ChevronRight className={`h-5 w-5 shrink-0 ${activeId === project.id ? 'text-accent' : 'text-gray-600'}`} />
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <span className={`rounded-full px-2 py-0.5 capitalize ${statusColor[project.status] ?? statusColor.active}`}>
                    {project.status}
                  </span>
                  <span className="text-gray-500">{project.documentCount} docs</span>
                  <span className="text-gray-500">{project.iotDeviceCount} IoT</span>
                </div>
              </button>
            ))}
          </div>

          {detail && (
            <div className="space-y-6 lg:col-span-2">
              <div className="rounded-xl border border-charcoal-700 bg-charcoal-900 p-6">
                <h2 className="text-xl font-semibold text-white">{detail.name}</h2>
                <p className="mt-1 text-sm capitalize text-gray-400">{detail.discipline} · started {new Date(detail.createdAt).toLocaleDateString()}</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg bg-charcoal-800 p-3">
                    <p className="text-xs text-gray-500">Documents</p>
                    <p className="text-2xl font-semibold text-white">{detail.documentCount}</p>
                    <p className="text-xs text-accent">{detail.readyDocumentCount} indexed</p>
                  </div>
                  <div className="rounded-lg bg-charcoal-800 p-3">
                    <p className="text-xs text-gray-500">IoT Devices</p>
                    <p className="text-2xl font-semibold text-white">{detail.iotDeviceCount}</p>
                  </div>
                  <div className="rounded-lg bg-charcoal-800 p-3">
                    <p className="text-xs text-gray-500">Status</p>
                    <p className="text-2xl font-semibold capitalize text-white">{detail.status}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-charcoal-700 bg-charcoal-900 p-6">
                <h3 className="mb-4 flex items-center gap-2 font-medium text-white">
                  <FileText className="h-5 w-5 text-accent" />
                  Linked Documents ({detail.documents.length})
                </h3>
                <div className="max-h-64 space-y-2 overflow-y-auto">
                  {detail.documents.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between rounded-lg bg-charcoal-800 px-3 py-2 text-sm">
                      <span className="text-gray-200">{doc.title}</span>
                      <span className="text-xs text-gray-500">
                        {doc.docType} · {doc.processingStatus}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-charcoal-700 bg-charcoal-900 p-6">
                <h3 className="mb-4 flex items-center gap-2 font-medium text-white">
                  <Radio className="h-5 w-5 text-accent" />
                  IoT Assets ({detail.iotDevices.length})
                </h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  {detail.iotDevices.map((device) => (
                    <div key={device.id} className="rounded-lg bg-charcoal-800 px-3 py-2 text-sm">
                      <p className="text-white">{device.name}</p>
                      <p className="text-xs text-gray-500">
                        {device.deviceType} · {device.location}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
