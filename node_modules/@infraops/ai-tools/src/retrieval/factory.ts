import type { SearchFilters, ChunkResult } from '@infraops/shared';
import type { RetrieverAdapter, RetrievalBackend } from './adapter';
import { PgVectorRetriever } from './pgvector-retriever';
import { DatabricksVectorRetriever } from './databricks-retriever';

export interface CreateRetrieverOptions {
  backend: RetrievalBackend;
  pgExecuteSql?: (sql: string, params: unknown[]) => Promise<
    {
      chunk_id: string;
      document_id: string;
      content: string;
      title: string;
      revision: string;
      doc_type: string;
      discipline: string;
      security_level: string;
      combined_score: number;
    }[]
  >;
  databricks?: {
    host: string;
    token: string;
    catalog: string;
    goldSchema: string;
    vectorIndexName?: string;
    warehouseId?: string;
    useSqlFallback?: boolean;
  };
  onFallback?: (error: unknown) => void;
}

function pgRetriever(options: CreateRetrieverOptions): RetrieverAdapter {
  if (!options.pgExecuteSql) {
    throw new Error('pgvector backend requires pgExecuteSql handler');
  }
  return new PgVectorRetriever(options.pgExecuteSql);
}

export function createRetriever(options: CreateRetrieverOptions): RetrieverAdapter {
  const pg = options.pgExecuteSql ? pgRetriever(options) : null;

  if (options.backend === 'databricks') {
    if (!options.databricks?.host || !options.databricks?.token) {
      if (pg) return pg;
      throw new Error(
        'RETRIEVAL_BACKEND=databricks requires DATABRICKS_HOST and DATABRICKS_TOKEN',
      );
    }
    const dbr = new DatabricksVectorRetriever(options.databricks);
    const dbrAdapter: RetrieverAdapter = {
      search: (query, embedding, filters, limit) =>
        dbr.search(query, embedding, filters, limit) as Promise<ChunkResult[]>,
    };

    if (!pg) return dbrAdapter;

    return {
      search: async (query, embedding, filters, limit) => {
        try {
          return await dbrAdapter.search(query, embedding, filters, limit);
        } catch (err) {
          options.onFallback?.(err);
          return pg.search(query, embedding, filters, limit);
        }
      },
    };
  }

  return pgRetriever(options);
}
