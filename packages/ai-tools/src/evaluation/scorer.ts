import type { EvaluationInput, EvaluationScores } from '@infraops/shared';
import { IOT_BASELINES } from '@infraops/shared';

const RETRIEVAL_HIT_THRESHOLD = 0.05;
const HALLUCINATION_GROUNDEDNESS_THRESHOLD = 0.45;

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 3),
  );
}

function overlapScore(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let overlap = 0;
  for (const w of a) if (b.has(w)) overlap++;
  return overlap / Math.max(a.size, b.size);
}

export function scoreEvaluation(input: EvaluationInput): EvaluationScores {
  const contextText = input.chunks.map((c) => c.content).join(' ');
  const citationText = input.citations.map((c) => c.excerpt ?? '').join(' ');

  const retrievalHitRate =
    input.chunks.length > 0 && input.chunks.some((c) => c.score >= RETRIEVAL_HIT_THRESHOLD)
      ? 1
      : 0;

  const answerTokens = tokenize(input.answer);
  const contextTokens = tokenize(contextText);
  const questionTokens = tokenize(input.question);

  const groundedness = overlapScore(answerTokens, contextTokens);
  const relevance = overlapScore(answerTokens, questionTokens) * 0.5 + overlapScore(questionTokens, answerTokens) * 0.5;

  const validCitationIds = new Set(input.chunks.map((c) => c.chunkId));
  const citedCount = input.citations.filter((c) => validCitationIds.has(c.chunkId)).length;
  const citationAccuracy =
    input.citations.length === 0 ? 0 : citedCount / input.citations.length;

  const citationOverlap =
    input.citations.length > 0 ? overlapScore(answerTokens, tokenize(citationText)) : groundedness;
  const adjustedGroundedness = Math.max(groundedness, citationOverlap * 0.8);

  const hallucinationFlag = adjustedGroundedness < HALLUCINATION_GROUNDEDNESS_THRESHOLD && input.citations.length > 0;

  return {
    groundedness: Math.round(adjustedGroundedness * 100) / 100,
    citationAccuracy: Math.round(citationAccuracy * 100) / 100,
    relevance: Math.round(relevance * 100) / 100,
    hallucinationFlag,
    retrievalHitRate,
  };
}

export function detectAnomaly(
  deviceType: string,
  reading: Record<string, number>,
): number {
  const baseline = IOT_BASELINES[deviceType];
  if (!baseline) return 0;

  let totalWeight = 0;
  let anomalySum = 0;

  for (const [field, range] of Object.entries(baseline.fields)) {
    const value = reading[field];
    if (value === undefined) continue;
    totalWeight += range.weight;

    if (value >= range.min && value <= range.max) continue;

    const span = range.max - range.min || 1;
    const distance =
      value < range.min ? (range.min - value) / span : (value - range.max) / span;
    anomalySum += Math.min(1, distance) * range.weight;
  }

  if (totalWeight === 0) return 0;
  return Math.round((anomalySum / totalWeight) * 100) / 100;
}
