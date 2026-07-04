import { useQuery } from '@tanstack/react-query';
import { Settings, BarChart3 } from 'lucide-react';
import { fetchAuditLog, fetchEvalSummary, fetchQueueMetrics } from '../lib/api';
import { AdminSettingsPanel } from '../components/AdminSettingsPanel';
import { AuditLogPanel } from '../components/AuditLogPanel';
import { FeatureTestsPanel } from '../components/FeatureTestsPanel';

export function AdminPage() {
  const { data: evalSummary } = useQuery({
    queryKey: ['eval', 'summary'],
    queryFn: fetchEvalSummary,
  });

  const { data: queueMetrics } = useQuery({
    queryKey: ['admin', 'queues'],
    queryFn: fetchQueueMetrics,
    refetchInterval: 10_000,
  });

  const { data: auditLog } = useQuery({
    queryKey: ['admin', 'audit'],
    queryFn: fetchAuditLog,
    refetchInterval: 15_000,
  });

  return (
    <div>
      <header className="mb-8">
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-white">
          <Settings className="h-7 w-7 text-accent" />
          Admin
        </h1>
        <p className="mt-1 text-gray-400">Settings, feature tests, audit trail, queue metrics, and evaluation summary</p>
      </header>

      <AdminSettingsPanel />

      <FeatureTestsPanel />

      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Total Agent Runs', value: evalSummary?.totalRuns ?? '-' },
          { label: 'Avg Groundedness', value: evalSummary?.avgGroundedness?.toFixed(2) ?? '-' },
          { label: 'Hallucination Rate', value: evalSummary ? `${(evalSummary.hallucinationRate * 100).toFixed(0)}%` : '-' },
          { label: 'Retrieval Hit Rate', value: evalSummary ? `${(evalSummary.retrievalHitRate * 100).toFixed(0)}%` : '-' },
        ].map((c) => (
          <div key={c.label} className="rounded-xl border border-charcoal-700 bg-charcoal-900 p-5">
            <p className="text-sm text-gray-400">{c.label}</p>
            <p className="mt-2 text-2xl font-semibold text-white">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-charcoal-700 bg-charcoal-900 p-6">
          <h2 className="mb-4 flex items-center gap-2 font-medium text-white">
            <BarChart3 className="h-5 w-5 text-accent" />
            Queue Metrics
          </h2>
          {queueMetrics ? (
            <div className="space-y-3 text-sm">
              {Object.entries(queueMetrics).filter(([k]) => k !== 'timestamp').map(([name, counts]) => (
                <div key={name}>
                  <p className="text-gray-400 capitalize">{name.replace(/([A-Z])/g, ' $1')}</p>
                  <p className="text-white">
                    waiting {(counts as Record<string, number>).waiting ?? 0} · active {(counts as Record<string, number>).active ?? 0} · failed {(counts as Record<string, number>).failed ?? 0}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">Loading…</p>
          )}
        </div>

        <div className="rounded-xl border border-charcoal-700 bg-charcoal-900 p-6">
          <h2 className="mb-4 flex items-center gap-2 font-medium text-white">
            <BarChart3 className="h-5 w-5 text-accent" />
            Evaluation Feedback
          </h2>
          <p className="text-sm text-gray-400">
            Positive ratings: {evalSummary?.positiveRatings ?? 0} · Negative: {evalSummary?.negativeRatings ?? 0}
          </p>
          <p className="mt-2 text-sm text-gray-400">
            Avg latency: {evalSummary?.avgLatencyMs?.toFixed(0) ?? '-'}ms
          </p>
          <p className="mt-2 text-sm text-gray-400">
            Backend: heuristic {evalSummary?.byBackend?.heuristic ?? 0} · mlflow{' '}
            {evalSummary?.byBackend?.mlflow ?? 0}
          </p>
          {evalSummary?.recent && evalSummary.recent.length > 0 && (
            <div className="mt-4 space-y-2 border-t border-charcoal-700 pt-3">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Recent evaluations</p>
              {evalSummary.recent.slice(0, 5).map((e: {
                id: string;
                evalBackend: string;
                mlflowRunId?: string | null;
                groundedness: number | null;
              }) => (
                <div key={e.id} className="flex items-center justify-between text-xs text-gray-400">
                  <span>
                    <span className="text-accent">{e.evalBackend}</span>
                    {e.mlflowRunId ? ` · ${e.mlflowRunId.slice(0, 8)}…` : ''}
                  </span>
                  <span>g={(e.groundedness ?? 0).toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <AuditLogPanel entries={auditLog} />
    </div>
  );
}
