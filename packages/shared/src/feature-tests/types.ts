import { z } from 'zod';

export const FeatureTestCategorySchema = z.enum([
  'platform',
  'auth',
  'data',
  'rag',
  'workflow',
  'settings',
]);

export type FeatureTestCategory = z.infer<typeof FeatureTestCategorySchema>;

export const FeatureTestCaseStatusSchema = z.enum([
  'passed',
  'failed',
  'skipped',
  'error',
]);

export type FeatureTestCaseStatus = z.infer<typeof FeatureTestCaseStatusSchema>;

export const FeatureTestRunStatusSchema = z.enum(['running', 'completed', 'failed']);

export type FeatureTestRunStatus = z.infer<typeof FeatureTestRunStatusSchema>;

export interface FeatureTestCaseDef {
  id: string;
  category: FeatureTestCategory;
  name: string;
  description: string;
  tags?: string[];
}

export interface FeatureTestOutcome {
  status: FeatureTestCaseStatus;
  message?: string;
  details?: Record<string, unknown>;
}

export const FeatureTestCaseViewSchema = z.object({
  id: z.string(),
  category: FeatureTestCategorySchema,
  name: z.string(),
  description: z.string(),
  tags: z.array(z.string()).optional(),
});

export const FeatureTestResultViewSchema = z.object({
  id: z.string(),
  testCaseId: z.string(),
  category: FeatureTestCategorySchema,
  name: z.string(),
  status: FeatureTestCaseStatusSchema,
  message: z.string().nullable(),
  durationMs: z.number().nullable(),
  details: z.record(z.unknown()),
});

export const FeatureTestRunViewSchema = z.object({
  id: z.string(),
  source: z.string(),
  status: FeatureTestRunStatusSchema,
  passCount: z.number(),
  failCount: z.number(),
  skipCount: z.number(),
  totalCount: z.number(),
  passRate: z.number(),
  retrievalBackend: z.string().nullable(),
  triggeredBy: z
    .object({
      id: z.string(),
      name: z.string(),
      email: z.string(),
    })
    .nullable(),
  startedAt: z.string(),
  completedAt: z.string().nullable(),
  results: z.array(FeatureTestResultViewSchema).optional(),
});

export type FeatureTestRunView = z.infer<typeof FeatureTestRunViewSchema>;
