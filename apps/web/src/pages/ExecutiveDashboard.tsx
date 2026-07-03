import { useQuery } from '@tanstack/react-query';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { fetchExecutiveSummary, fetchHealth } from '../lib/api';

export function ExecutiveDashboard() {
  const { data: health } = useQuery({ queryKey: ['health'], queryFn: fetchHealth, refetchInterval: 30_000 });
  const { data: summary, isLoading } = useQuery({
    queryKey: ['dashboard', 'executive'],
    queryFn: fetchExecutiveSummary,
    refetchInterval: 15_000,
  });

  const evalChart = summary?.evaluations
    ? [
        { name: 'Groundedness', value: summary.evaluations.avgGroundedness ?? 0 },
        { name: 'Citation Acc.', value: summary.evaluations.avgCitationAccuracy ?? 0 },
        { name: 'Relevance', value: summary.evaluations.avgRelevance ?? 0 },
        { name: 'Retrieval Hit', value: summary.evaluations.retrievalHitRate ?? 0 },
      ]
    : [];

  const docTypeChart = summary?.documents.byType
    ? Object.entries(summary.documents.byType).map(([name, value]) => ({ name, value }))
    : [];

  const cards = [
    {
      label: 'Documents Indexed',
      value: String(summary?.documents.ready ?? '-'),
      sub: `${summary?.documents.total ?? 0} total · ${summary?.project?.name ?? 'Substation Alpha'}`,
    },
    {
      label: 'Agent Runs',
      value: String(summary?.agentRuns.total ?? '-'),
      sub: `backend: ${summary?.retrievalBackend ?? '…'}`,
    },
    {
      label: 'Pending Reviews',
      value: String(summary?.reviews.pending ?? '-'),
      sub: 'human-in-the-loop queue',
    },
    {
      label: 'IoT Alerts',
      value: String(summary?.iot.activeAlerts ?? '-'),
      sub: 'anomaly ≥ 85% threshold',
    },
  ];

  return (
    <div>
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-white">Executive Dashboard</h1>
        <p className="mt-1 text-gray-400">
          Live portfolio KPIs - {summary?.project?.name ?? 'Meridian Grid Services'}
        </p>
      </header>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-charcoal-700 bg-charcoal-900 px-4 py-3">
          <p className="text-sm text-gray-400">System health</p>
          <p className="mt-1 text-lg font-medium text-white">
            API: {health?.status ?? 'checking…'}
            {health?.checks && (
              <span className="ml-3 text-sm font-normal text-gray-500">
                DB {health.checks.database ? '✓' : '✗'} · Redis {health.checks.redis ? '✓' : '✗'}
              </span>
            )}
          </p>
        </div>
        <div className="rounded-lg border border-charcoal-700 bg-charcoal-900 px-4 py-3">
          <p className="text-sm text-gray-400">Retrieval & data platform</p>
          <p className="mt-1 text-lg font-medium text-white">
            {summary?.retrievalBackend ?? '…'}
            <span className="ml-3 text-sm font-normal text-gray-500">
              Databricks {summary?.databricksConfigured ? 'configured' : 'not configured'}
            </span>
          </p>
        </div>
      </div>

      {isLoading ? (
        <p className="text-gray-400">Loading live metrics…</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map((card) => (
              <div key={card.label} className="rounded-xl border border-charcoal-700 bg-charcoal-900 p-5">
                <p className="text-sm text-gray-400">{card.label}</p>
                <p className="mt-2 text-3xl font-semibold text-white">{card.value}</p>
                <p className="mt-1 text-xs text-accent">{card.sub}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-charcoal-700 bg-charcoal-900 p-6">
              <h2 className="mb-4 font-medium text-white">AI Evaluation Scores</h2>
              {evalChart.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={evalChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis dataKey="name" tick={{ fill: '#888', fontSize: 11 }} />
                    <YAxis domain={[0, 1]} tick={{ fill: '#888', fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ background: '#1c2027', border: '1px solid #333' }}
                      labelStyle={{ color: '#fff' }}
                    />
                    <Bar dataKey="value" fill="#e87722" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-gray-500">
                  Run AI Assistant queries or <code className="text-accent">npm run eval</code> to populate scores.
                </p>
              )}
              {summary?.evaluations && (
                <p className="mt-3 text-xs text-gray-500">
                  Hallucination rate: {(summary.evaluations.hallucinationRate * 100).toFixed(0)}% · Avg latency:{' '}
                  {summary.evaluations.avgLatencyMs?.toFixed(0) ?? '-'}ms
                </p>
              )}
            </div>

            <div className="rounded-xl border border-charcoal-700 bg-charcoal-900 p-6">
              <h2 className="mb-4 font-medium text-white">Documents by Type</h2>
              {docTypeChart.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={docTypeChart} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis type="number" tick={{ fill: '#888', fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={100} tick={{ fill: '#888', fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: '#1c2027', border: '1px solid #333' }} />
                    <Bar dataKey="value" fill="#e87722" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-gray-500">Seed documents load on first startup via db:seed.</p>
              )}
            </div>
          </div>

          {summary?.agentRuns.recent && summary.agentRuns.recent.length > 0 && (
            <div className="mt-8 rounded-xl border border-charcoal-700 bg-charcoal-900 p-6">
              <h2 className="mb-4 font-medium text-white">Recent Agent Runs</h2>
              <div className="space-y-2">
                {summary.agentRuns.recent.slice(0, 5).map((run) => (
                  <div key={run.id} className="flex items-center justify-between text-sm">
                    <span className="text-gray-300">{run.agentType}</span>
                    <span className="text-gray-500">
                      {run.latencyMs ?? '-'}ms · conf {((run.confidence ?? 0) * 100).toFixed(0)}% ·{' '}
                      {new Date(run.createdAt).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {summary?.iot.alerts && summary.iot.alerts.length > 0 && (
            <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/5 p-6">
              <h2 className="mb-3 font-medium text-red-400">Recent IoT Alerts</h2>
              {summary?.iot.alerts.map((a) => (
                <p key={a.id} className="text-sm text-gray-300">
                  {a.deviceName} - anomaly score {((a.anomalyScore ?? 0) * 100).toFixed(0)}%
                </p>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
