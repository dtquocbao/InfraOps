import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FlaskConical,
  Loader2,
  Play,
  XCircle,
  AlertCircle,
  MinusCircle,
} from 'lucide-react';
import { useState } from 'react';
import {
  fetchFeatureTestCases,
  fetchFeatureTestLatestRun,
  fetchFeatureTestRuns,
  triggerFeatureTestRun,
  getUser,
  type FeatureTestCaseView,
  type FeatureTestRunView,
} from '../lib/api';

const CATEGORY_LABELS: Record<string, string> = {
  platform: 'Platform',
  auth: 'Authentication',
  data: 'Data & Seed',
  rag: 'RAG & AI',
  workflow: 'Workflow',
  settings: 'Settings',
};

function StatusBadge({ status }: { status: string }) {
  if (status === 'passed') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-400">
        <CheckCircle2 className="h-3 w-3" /> Pass
      </span>
    );
  }
  if (status === 'failed') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-xs text-red-400">
        <XCircle className="h-3 w-3" /> Fail
      </span>
    );
  }
  if (status === 'error') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-xs text-red-400">
        <AlertCircle className="h-3 w-3" /> Error
      </span>
    );
  }
  if (status === 'skipped') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-gray-500/15 px-2 py-0.5 text-xs text-gray-400">
        <MinusCircle className="h-3 w-3" /> Skip
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-400">
      <Loader2 className="h-3 w-3 animate-spin" /> Running
    </span>
  );
}

function RunStatusBadge({ status }: { status: FeatureTestRunView['status'] }) {
  if (status === 'running') {
    return (
      <span className="inline-flex items-center gap-1 text-amber-400">
        <Loader2 className="h-4 w-4 animate-spin" /> Running
      </span>
    );
  }
  if (status === 'failed') {
    return <span className="text-red-400">Failed</span>;
  }
  return <span className="text-emerald-400">Completed</span>;
}

export function FeatureTestsPanel() {
  const queryClient = useQueryClient();
  const user = getUser();
  const isAdmin = user?.role === 'admin';
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['platform', 'rag']));
  const [showHistory, setShowHistory] = useState(false);

  const { data: cases } = useQuery({
    queryKey: ['feature-tests', 'cases'],
    queryFn: fetchFeatureTestCases,
  });

  const { data: latestRun, isLoading: loadingRun } = useQuery({
    queryKey: ['feature-tests', 'latest'],
    queryFn: fetchFeatureTestLatestRun,
    refetchInterval: (query) =>
      query.state.data?.status === 'running' ? 3000 : false,
  });

  const { data: runHistory } = useQuery({
    queryKey: ['feature-tests', 'runs'],
    queryFn: () => fetchFeatureTestRuns(10),
    enabled: showHistory,
  });

  const runMutation = useMutation({
    mutationFn: triggerFeatureTestRun,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feature-tests'] });
    },
  });

  const resultsByCaseId = new Map(
    latestRun?.results?.map((r) => [r.testCaseId, r]) ?? [],
  );

  const casesByCategory = (cases ?? []).reduce<Record<string, FeatureTestCaseView[]>>(
    (acc, testCase) => {
      (acc[testCase.category] ??= []).push(testCase);
      return acc;
    },
    {},
  );

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  };

  const isRunning = latestRun?.status === 'running' || runMutation.isPending;

  return (
    <div className="mb-8 rounded-xl border border-charcoal-700 bg-charcoal-900 p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 font-medium text-white">
            <FlaskConical className="h-5 w-5 text-accent" />
            Feature Test Suite
          </h2>
          <p className="mt-1 text-sm text-gray-400">
            Automated regression tests for platform, RAG, workflow, and data features
          </p>
        </div>
        {isAdmin && (
          <button
            type="button"
            disabled={isRunning}
            onClick={() => runMutation.mutate()}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-charcoal-950 disabled:opacity-50"
          >
            {isRunning ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Running…
              </>
            ) : (
              <>
                <Play className="h-4 w-4" /> Run All Tests
              </>
            )}
          </button>
        )}
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-charcoal-700 bg-charcoal-800/50 p-4">
          <p className="text-xs text-gray-400">Registered tests</p>
          <p className="mt-1 text-xl font-semibold text-white">{cases?.length ?? '-'}</p>
        </div>
        <div className="rounded-lg border border-charcoal-700 bg-charcoal-800/50 p-4">
          <p className="text-xs text-gray-400">Latest pass rate</p>
          <p className="mt-1 text-xl font-semibold text-white">
            {latestRun ? `${Math.round(latestRun.passRate * 100)}%` : '-'}
          </p>
        </div>
        <div className="rounded-lg border border-charcoal-700 bg-charcoal-800/50 p-4">
          <p className="text-xs text-gray-400">Last run status</p>
          <p className="mt-1 text-sm font-medium">
            {loadingRun ? '…' : latestRun ? <RunStatusBadge status={latestRun.status} /> : 'No runs yet'}
          </p>
        </div>
        <div className="rounded-lg border border-charcoal-700 bg-charcoal-800/50 p-4">
          <p className="text-xs text-gray-400">Pass / Fail / Skip</p>
          <p className="mt-1 text-sm text-white">
            {latestRun
              ? `${latestRun.passCount} / ${latestRun.failCount} / ${latestRun.skipCount}`
              : '-'}
          </p>
        </div>
      </div>

      {latestRun && (
        <p className="mb-4 text-xs text-gray-500">
          Last run: {new Date(latestRun.startedAt).toLocaleString()}
          {latestRun.retrievalBackend && ` · Backend: ${latestRun.retrievalBackend}`}
          {latestRun.triggeredBy && ` · By: ${latestRun.triggeredBy.name}`}
        </p>
      )}

      <div className="space-y-2">
        {Object.entries(casesByCategory).map(([category, categoryCases]) => {
          const expanded = expandedCategories.has(category);
          const categoryResults = categoryCases.map((c) => resultsByCaseId.get(c.id));
          const passed = categoryResults.filter((r) => r?.status === 'passed').length;
          const failed = categoryResults.filter(
            (r) => r?.status === 'failed' || r?.status === 'error',
          ).length;

          return (
            <div key={category} className="rounded-lg border border-charcoal-700 overflow-hidden">
              <button
                type="button"
                onClick={() => toggleCategory(category)}
                className="flex w-full items-center justify-between bg-charcoal-800/60 px-4 py-3 text-left"
              >
                <span className="flex items-center gap-2 text-sm font-medium text-white">
                  {expanded ? (
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  )}
                  {CATEGORY_LABELS[category] ?? category}
                  <span className="text-gray-500">({categoryCases.length})</span>
                </span>
                {latestRun?.results && (
                  <span className="text-xs text-gray-400">
                    {passed} pass · {failed} fail
                  </span>
                )}
              </button>
              {expanded && (
                <div className="divide-y divide-charcoal-700">
                  {categoryCases.map((testCase) => {
                    const result = resultsByCaseId.get(testCase.id);
                    return (
                      <div
                        key={testCase.id}
                        className="flex flex-wrap items-start justify-between gap-2 px-4 py-3 text-sm"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-gray-200">{testCase.name}</p>
                          <p className="mt-0.5 text-xs text-gray-500">{testCase.description}</p>
                          {result?.message && (
                            <p className="mt-1 text-xs text-gray-400">{result.message}</p>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-3">
                          {result?.durationMs != null && (
                            <span className="text-xs text-gray-500">{result.durationMs}ms</span>
                          )}
                          {result ? (
                            <StatusBadge status={result.status} />
                          ) : (
                            <span className="text-xs text-gray-600">Not run</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => setShowHistory((v) => !v)}
        className="mt-4 text-sm text-accent hover:underline"
      >
        {showHistory ? 'Hide run history' : 'Show run history'}
      </button>

      {showHistory && runHistory && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-charcoal-700 text-gray-400">
                <th className="pb-2 pr-4">Started</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2 pr-4">Pass rate</th>
                <th className="pb-2 pr-4">Backend</th>
                <th className="pb-2">Triggered by</th>
              </tr>
            </thead>
            <tbody>
              {runHistory.map((run) => (
                <tr key={run.id} className="border-b border-charcoal-800">
                  <td className="py-2 pr-4 text-gray-300">
                    {new Date(run.startedAt).toLocaleString()}
                  </td>
                  <td className="py-2 pr-4">
                    <RunStatusBadge status={run.status} />
                  </td>
                  <td className="py-2 pr-4 text-gray-300">
                    {Math.round(run.passRate * 100)}% ({run.passCount}/{run.totalCount})
                  </td>
                  <td className="py-2 pr-4 text-gray-400">{run.retrievalBackend ?? '-'}</td>
                  <td className="py-2 text-gray-400">{run.triggeredBy?.name ?? 'System'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
