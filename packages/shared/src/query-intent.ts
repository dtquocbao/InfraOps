import { z } from 'zod';

export const QueryIntentIdSchema = z.enum([
  'safety_procedure',
  'contract_terms',
  'project_status',
  'engineering_spec',
  'general',
]);

export type QueryIntentId = z.infer<typeof QueryIntentIdSchema>;

export interface IntentDefinition {
  id: QueryIntentId;
  label: string;
  docTypes: string[];
  keywords: string[];
  discipline?: string;
}

export const INTENT_DEFINITIONS: IntentDefinition[] = [
  {
    id: 'safety_procedure',
    label: 'Safety Procedure',
    docTypes: ['safety_sop'],
    keywords: [
      'lockout',
      'tagout',
      'loto',
      'arc flash',
      'ppe',
      'safety',
      'procedure',
      'hazard',
      'confined',
      'osha',
      'incident',
    ],
    discipline: 'electrical',
  },
  {
    id: 'contract_terms',
    label: 'Contract & Legal',
    docTypes: ['contract'],
    keywords: [
      'contract',
      'liability',
      'indemnity',
      'clause',
      'helix',
      'cap',
      'warranty',
      'termination',
      'agreement',
      'payment',
    ],
  },
  {
    id: 'project_status',
    label: 'Project Status',
    docTypes: ['project_report'],
    keywords: [
      'budget',
      'schedule',
      'risk',
      'status',
      'milestone',
      'variance',
      'report',
      'q1',
      'q2',
      'timeline',
      'cost',
    ],
  },
  {
    id: 'engineering_spec',
    label: 'Engineering Specification',
    docTypes: ['engineering'],
    keywords: [
      'specification',
      'design',
      'transmission',
      'substation',
      'transformer',
      'layout',
      'drawing',
      '138kv',
      '138 kv',
      'electrical',
      'structural',
    ],
    discipline: 'electrical',
  },
  {
    id: 'general',
    label: 'General Inquiry',
    docTypes: [],
    keywords: [],
  },
];

export const QueryIntentProfileSchema = z.object({
  intent: QueryIntentIdSchema,
  label: z.string(),
  confidence: z.number().min(0).max(1),
  docTypes: z.array(z.string()),
  keywordQuery: z.string(),
  discipline: z.string().optional(),
});

export type QueryIntentProfile = z.infer<typeof QueryIntentProfileSchema>;

/** Rule-based intent classifier - maps natural language to document domains. */
export function classifyQueryIntent(question: string): QueryIntentProfile {
  const normalized = question.toLowerCase();

  let best: IntentDefinition = INTENT_DEFINITIONS.find((d) => d.id === 'general')!;
  let bestScore = 0;

  for (const def of INTENT_DEFINITIONS) {
    if (def.id === 'general') continue;
    let score = 0;
    for (const kw of def.keywords) {
      if (normalized.includes(kw.toLowerCase())) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = def;
    }
  }

  const confidence =
    best.id === 'general' ? 0.35 : Math.min(1, 0.45 + bestScore * 0.12);

  const matchedKeywords = best.keywords.filter((kw) =>
    normalized.includes(kw.toLowerCase()),
  );
  const keywordQuery =
    matchedKeywords.length > 0
      ? [...new Set([...matchedKeywords, ...question.split(/\s+/).slice(0, 6)])].join(' ')
      : question;

  return {
    intent: best.id,
    label: best.label,
    confidence,
    docTypes: best.docTypes,
    keywordQuery,
    discipline: best.discipline,
  };
}

/** Tri-hybrid retrieval weights: semantic + keyword FTS + intent alignment */
export const RETRIEVAL_WEIGHTS = {
  semantic: 0.5,
  keyword: 0.3,
  intent: 0.2,
} as const;
