import { z } from 'zod';

export const DocumentManifestEntrySchema = z.object({
  id: z.string(),
  title: z.string(),
  doc_type: z.string(),
  project_id: z.string(),
  discipline: z.string(),
  revision: z.string(),
  approval_status: z.string(),
  department: z.string(),
  security_level: z.string(),
  created_date: z.string(),
  filename: z.string(),
});

export type DocumentManifestEntry = z.infer<typeof DocumentManifestEntrySchema>;

export const DocumentResponseSchema = z.object({
  id: z.string(),
  title: z.string(),
  docType: z.string(),
  revision: z.string(),
  approvalStatus: z.string(),
  department: z.string(),
  securityLevel: z.string(),
  processingStatus: z.string(),
  projectId: z.string().nullable(),
  createdAt: z.string(),
  chunkCount: z.number().optional(),
});

export type DocumentResponse = z.infer<typeof DocumentResponseSchema>;
