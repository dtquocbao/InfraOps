import { z } from 'zod';

export const ReviewDecisionSchema = z.enum(['approved', 'rejected']);
export type ReviewDecision = z.infer<typeof ReviewDecisionSchema>;

export const ReviewDecideRequestSchema = z.object({
  decision: ReviewDecisionSchema,
  comments: z.string().optional(),
});

export type ReviewDecideRequest = z.infer<typeof ReviewDecideRequestSchema>;

export interface ReviewTriggerContext {
  agentType: string;
  question?: string;
  answer: string;
  confidence: number;
  citations: { docType?: string; title?: string }[];
}

export interface ReviewTriggerRule {
  id: string;
  description: string;
  evaluate: (ctx: ReviewTriggerContext) => boolean;
}

/** Rules table - not hardcoded ifs scattered in business logic */
export const REVIEW_TRIGGER_RULES: ReviewTriggerRule[] = [
  {
    id: 'low_confidence',
    description: 'Retrieval confidence below threshold',
    evaluate: (ctx) => ctx.confidence < 0.35,
  },
  {
    id: 'safety_recommendation',
    description: 'Safety-related content in question or answer',
    evaluate: (ctx) => {
      const text = `${ctx.question ?? ''} ${ctx.answer}`.toLowerCase();
      return ['safety', 'arc flash', 'lockout', 'confined space', 'ppe', 'hazard'].some((k) =>
        text.includes(k),
      );
    },
  },
  {
    id: 'contract_summary',
    description: 'Response cites contract documents',
    evaluate: (ctx) =>
      ctx.citations.some((c) => c.docType === 'contract') ||
      ctx.answer.toLowerCase().includes('liability') ||
      ctx.answer.toLowerCase().includes('contract'),
  },
  {
    id: 'executive_report',
    description: 'Executive or portfolio-level question',
    evaluate: (ctx) => {
      const q = (ctx.question ?? '').toLowerCase();
      return ['executive', 'portfolio', 'budget', 'kpi', 'variance'].some((k) => q.includes(k));
    },
  },
];

export function shouldRequireReview(ctx: ReviewTriggerContext): { required: boolean; reasons: string[] } {
  const reasons = REVIEW_TRIGGER_RULES.filter((r) => r.evaluate(ctx)).map((r) => r.id);
  return { required: reasons.length > 0, reasons };
}
