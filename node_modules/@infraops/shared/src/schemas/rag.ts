import { z } from 'zod';
import { QueryIntentProfileSchema } from '../query-intent';

export const CitationSchema = z.object({
  documentId: z.string(),
  chunkId: z.string(),
  title: z.string(),
  revision: z.string(),
  excerpt: z.string().optional(),
});

export type Citation = z.infer<typeof CitationSchema>;

export const RagQueryRequestSchema = z.object({
  question: z.string().min(3).max(2000),
  projectId: z.string().optional(),
  discipline: z.string().optional(),
  docType: z.string().optional(),
});

export type RagQueryRequest = z.infer<typeof RagQueryRequestSchema>;

export const RagQueryResponseSchema = z.object({
  answer: z.string(),
  citations: z.array(CitationSchema),
  agentRunId: z.string(),
  traceId: z.string(),
  confidence: z.number(),
  retrievalBackend: z.string().optional(),
  detectedIntent: z
    .object({
      intent: z.string(),
      label: z.string(),
      confidence: z.number(),
    })
    .optional(),
  reviewRequired: z.boolean().optional(),
  reviewId: z.string().optional(),
});

export type RagQueryResponse = z.infer<typeof RagQueryResponseSchema>;

export const ChunkResultSchema = z.object({
  chunkId: z.string(),
  documentId: z.string(),
  content: z.string(),
  title: z.string(),
  revision: z.string(),
  docType: z.string(),
  discipline: z.string(),
  securityLevel: z.string(),
  score: z.number(),
});

export type ChunkResult = z.infer<typeof ChunkResultSchema>;

export const SearchFiltersSchema = z.object({
  projectId: z.string().optional(),
  discipline: z.string().optional(),
  docType: z.string().optional(),
  securityLevels: z.array(z.string()).optional(),
  intentProfile: QueryIntentProfileSchema.optional(),
});

export type SearchFilters = z.infer<typeof SearchFiltersSchema>;
