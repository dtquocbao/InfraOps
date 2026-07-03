import type { SearchFilters, ChunkResult } from '@infraops/shared';

export interface RetrieverAdapter {
  search(
    query: string,
    queryEmbedding: number[],
    filters: SearchFilters,
    limit?: number,
  ): Promise<ChunkResult[]>;
}

export type RetrievalBackend = 'pgvector' | 'databricks';
