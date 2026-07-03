import type { ChunkResult, QueryIntentProfile } from '@infraops/shared';
import { RETRIEVAL_WEIGHTS } from '@infraops/shared';

/** Re-rank retrieved chunks with intent alignment boost (used by Databricks path). */
export function rerankByIntent(
  chunks: ChunkResult[],
  intent: QueryIntentProfile,
): ChunkResult[] {
  if (intent.intent === 'general' || chunks.length === 0) return chunks;

  const keywords = intent.keywordQuery.toLowerCase().split(/\s+/).filter((w: string) => w.length > 3);

  return [...chunks]
    .map((chunk) => {
      const intentScore = computeIntentScore(chunk, intent, keywords);
      const blended = chunk.score * (1 - RETRIEVAL_WEIGHTS.intent) + intentScore * RETRIEVAL_WEIGHTS.intent;
      return { ...chunk, score: blended };
    })
    .sort((a, b) => b.score - a.score);
}

function computeIntentScore(
  chunk: ChunkResult,
  intent: QueryIntentProfile,
  keywords: string[],
): number {
  let score = 0;

  if (intent.docTypes.includes(chunk.docType)) {
    score += 0.55;
  }

  const haystack = `${chunk.title} ${chunk.content} ${chunk.docType}`.toLowerCase();
  let kwHits = 0;
  for (const kw of keywords) {
    if (haystack.includes(kw)) kwHits += 1;
  }
  if (keywords.length > 0) {
    score += 0.45 * (kwHits / keywords.length);
  }

  return Math.min(1, score);
}
