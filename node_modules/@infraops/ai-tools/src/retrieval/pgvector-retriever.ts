import type { SearchFilters, ChunkResult } from '@infraops/shared';
import { RETRIEVAL_WEIGHTS } from '@infraops/shared';
import type { RetrieverAdapter } from './adapter';

export type { RetrieverAdapter } from './adapter';

export interface RawChunkRow {
  chunk_id: string;
  document_id: string;
  content: string;
  title: string;
  revision: string;
  doc_type: string;
  discipline: string;
  security_level: string;
  combined_score: number;
}

export class PgVectorRetriever implements RetrieverAdapter {
  constructor(private executeSql: (sql: string, params: unknown[]) => Promise<RawChunkRow[]>) {}

  async search(
    query: string,
    queryEmbedding: number[],
    filters: SearchFilters,
    limit = 8,
  ): Promise<ChunkResult[]> {
    const intent = filters.intentProfile;
    const conditions: string[] = ['d.processing_status = \'ready\''];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (filters.projectId) {
      conditions.push(`d.project_id = $${paramIdx++}`);
      params.push(filters.projectId);
    }

    const discipline = filters.discipline ?? intent?.discipline;
    if (discipline) {
      conditions.push(`p.discipline = $${paramIdx++}`);
      params.push(discipline);
    }

    const docType = filters.docType;
    if (docType) {
      conditions.push(`d.doc_type = $${paramIdx++}`);
      params.push(docType);
    } else if (intent?.docTypes.length) {
      conditions.push(`d.doc_type = ANY($${paramIdx++})`);
      params.push(intent.docTypes);
    }

    if (filters.securityLevels?.length) {
      conditions.push(`d.security_level = ANY($${paramIdx++})`);
      params.push(filters.securityLevels);
    }

    const embeddingParam = `$${paramIdx++}`;
    params.push(`[${queryEmbedding.join(',')}]`);

    const keywordQuery = intent?.keywordQuery ?? query;
    const queryParam = `$${paramIdx++}`;
    params.push(keywordQuery);

    const intentQueryParam = `$${paramIdx++}`;
    params.push(intent?.keywordQuery ?? query);

    const intentDocTypesParam = `$${paramIdx++}`;
    params.push(intent?.docTypes?.length ? intent.docTypes : ['']);

    const limitParam = `$${paramIdx++}`;
    params.push(limit);

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { semantic, keyword, intent: intentW } = RETRIEVAL_WEIGHTS;

    const sql = `
      SELECT
        dc.id AS chunk_id,
        dc.document_id,
        dc.content,
        d.title,
        d.revision,
        d.doc_type,
        COALESCE(p.discipline, '') AS discipline,
        d.security_level,
        (
          CASE WHEN dc.embedding IS NOT NULL THEN
            ${semantic} * (1 - (dc.embedding <=> ${embeddingParam}::vector))
          ELSE 0 END
          +
          ${keyword} * ts_rank(
            to_tsvector('english', dc.content),
            plainto_tsquery('english', ${queryParam})
          )
          +
          ${intentW} * (
            CASE WHEN cardinality(${intentDocTypesParam}::text[]) > 0 AND d.doc_type = ANY(${intentDocTypesParam}::text[]) THEN 0.6 ELSE 0 END
            +
            ts_rank(
              to_tsvector('english', coalesce(d.title, '') || ' ' || dc.content),
              plainto_tsquery('english', ${intentQueryParam})
            ) * 0.4
          )
        ) AS combined_score
      FROM document_chunks dc
      JOIN documents d ON d.id = dc.document_id
      LEFT JOIN projects p ON p.id = d.project_id
      ${where}
      ORDER BY combined_score DESC
      LIMIT ${limitParam}
    `;

    const rows = await this.executeSql(sql, params);
    return rows.map((r) => ({
      chunkId: r.chunk_id,
      documentId: r.document_id,
      content: r.content,
      title: r.title,
      revision: r.revision,
      docType: r.doc_type,
      discipline: r.discipline,
      securityLevel: r.security_level,
      score: Number(r.combined_score),
    }));
  }
}
