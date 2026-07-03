import { z } from 'zod';

export const EvaluationSummarySchema = z.object({
  totalRuns: z.number(),
  avgGroundedness: z.number().nullable(),
  avgCitationAccuracy: z.number().nullable(),
  avgRelevance: z.number().nullable(),
  hallucinationRate: z.number(),
  avgLatencyMs: z.number().nullable(),
  retrievalHitRate: z.number(),
});

export type EvaluationSummary = z.infer<typeof EvaluationSummarySchema>;

export interface EvaluationInput {
  question: string;
  answer: string;
  citations: { chunkId: string; excerpt?: string; documentId?: string }[];
  chunks: { chunkId: string; content: string; score: number }[];
  latencyMs: number;
}

export interface EvaluationScores {
  groundedness: number;
  citationAccuracy: number;
  relevance: number;
  hallucinationFlag: boolean;
  retrievalHitRate: number;
}

export const EVAL_TEST_QUESTIONS = [
  { id: 'q01', question: 'What is the lockout-tagout procedure for Substation Alpha?', expectsCitation: true },
  { id: 'q02', question: 'What PPE category is required for arc flash at 25 cal/cm²?', expectsCitation: true },
  { id: 'q03', question: 'What is the Q1 2026 project budget status?', expectsCitation: true },
  { id: 'q04', question: 'What liability cap applies under the Helix Power contract?', expectsCitation: true },
  { id: 'q05', question: 'What are the confined space entry atmospheric limits for oxygen?', expectsCitation: true },
  { id: 'q06', question: 'What is the substation grounding grid resistance target?', expectsCitation: true },
  { id: 'q07', question: 'What change order markup rate applies to labor?', expectsCitation: true },
  { id: 'q08', question: 'What is the incident reporting timeline for recordable injuries?', expectsCitation: true },
  { id: 'q09', question: 'What transformer MVA rating is specified for Substation Alpha?', expectsCitation: true },
  { id: 'q10', question: 'What are the top risks in the current risk register?', expectsCitation: true },
  { id: 'q11', question: 'What is the 138kV conductor specification?', expectsCitation: true },
  { id: 'q12', question: 'What is the budget variance for April 2026?', expectsCitation: true },
  { id: 'q13', question: 'What structural steel standard applies to lattice towers?', expectsCitation: true },
  { id: 'q14', question: 'What payment terms apply to milestone invoices?', expectsCitation: true },
  { id: 'q15', question: 'What protection relay coordination fault current was calculated?', expectsCitation: true },
] as const;
