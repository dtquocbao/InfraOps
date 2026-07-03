import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Shield, Check, X } from 'lucide-react';
import { decideReview, fetchPendingReviews } from '../lib/api';

export function ReviewPage() {
  const queryClient = useQueryClient();
  const [comments, setComments] = useState<Record<string, string>>({});

  const { data: reviews, isLoading } = useQuery({
    queryKey: ['reviews', 'pending'],
    queryFn: fetchPendingReviews,
    refetchInterval: 10_000,
  });

  const decideMutation = useMutation({
    mutationFn: ({ runId, decision }: { runId: string; decision: 'approved' | 'rejected' }) =>
      decideReview(runId, decision, comments[runId]),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reviews'] }),
  });

  return (
    <div>
      <header className="mb-8">
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-white">
          <Shield className="h-7 w-7 text-accent" />
          Human Review
        </h1>
        <p className="mt-1 text-gray-400">
          Approve or reject flagged AI outputs - safety, contracts, low confidence
        </p>
      </header>

      {isLoading ? (
        <p className="text-gray-400">Loading review queue…</p>
      ) : !reviews?.length ? (
        <div className="rounded-xl border border-dashed border-charcoal-700 bg-charcoal-900 p-12 text-center text-gray-500">
          No pending reviews. Ask a safety or contract question in AI Assistant to trigger one.
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => {
            const run = review.agentRun;
            const question = (run.input as { question?: string }).question ?? 'Unknown';
            const answer = (run.output as { answer?: string }).answer ?? '';
            const confidence = (run.output as { confidence?: number }).confidence;

            return (
              <div key={review.id} className="rounded-xl border border-charcoal-700 bg-charcoal-900 p-6">
                <div className="mb-4 flex items-start justify-between">
                  <div>
                    <p className="text-xs text-accent">{review.comments}</p>
                    <p className="mt-1 text-sm text-gray-500">
                      {run.user.name} · {run.agentType} ·{' '}
                      {confidence !== undefined ? `${(confidence * 100).toFixed(0)}% confidence` : ''}
                    </p>
                  </div>
                  <span className="rounded-full bg-yellow-500/20 px-3 py-1 text-xs text-yellow-400">
                    pending review
                  </span>
                </div>

                <p className="text-sm font-medium text-gray-300">Q: {question}</p>
                <p className="mt-2 text-sm text-gray-400">{answer.slice(0, 400)}{answer.length > 400 ? '…' : ''}</p>

                {run.citations?.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {run.citations.map((c) => (
                      <span key={c.chunkId} className="rounded border border-charcoal-600 px-2 py-0.5 text-xs text-gray-500">
                        {c.title}
                      </span>
                    ))}
                  </div>
                )}

                <textarea
                  placeholder="Reviewer comments (optional)"
                  value={comments[run.id] ?? ''}
                  onChange={(e) => setComments({ ...comments, [run.id]: e.target.value })}
                  className="mt-4 w-full rounded-lg border border-charcoal-700 bg-charcoal-800 px-3 py-2 text-sm text-white"
                  rows={2}
                />

                <div className="mt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => decideMutation.mutate({ runId: run.id, decision: 'approved' })}
                    disabled={decideMutation.isPending}
                    className="flex items-center gap-2 rounded-lg bg-green-600/20 px-4 py-2 text-sm text-green-400 hover:bg-green-600/30"
                  >
                    <Check className="h-4 w-4" /> Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => decideMutation.mutate({ runId: run.id, decision: 'rejected' })}
                    disabled={decideMutation.isPending}
                    className="flex items-center gap-2 rounded-lg bg-red-600/20 px-4 py-2 text-sm text-red-400 hover:bg-red-600/30"
                  >
                    <X className="h-4 w-4" /> Reject
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
