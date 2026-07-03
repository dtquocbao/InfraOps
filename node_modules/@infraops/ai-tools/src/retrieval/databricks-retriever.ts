import type { SearchFilters } from '@infraops/shared';
import { rerankByIntent } from './intent-rerank';

export interface DatabricksRetrieverConfig {
  host: string;
  token: string;
  catalog: string;
  goldSchema: string;
  vectorIndexName?: string;
  warehouseId?: string;
  useSqlFallback?: boolean;
}

interface VectorSearchRow {
  chunk_id?: string;
  document_id?: string;
  content?: string;
  title?: string;
  revision?: string;
  doc_type?: string;
  discipline?: string;
  security_level?: string;
  score?: number;
}

export class DatabricksVectorRetriever {
  constructor(private config: DatabricksRetrieverConfig) {}

  private get baseUrl() {
    return this.config.host.replace(/\/$/, '');
  }

  private headers() {
    return {
      Authorization: `Bearer ${this.config.token}`,
      'Content-Type': 'application/json',
    };
  }

  async search(
    query: string,
    queryEmbedding: number[],
    filters: SearchFilters,
    limit = 8,
  ) {
    const intent = filters.intentProfile;
    const mergedFilters = {
      projectId: filters.projectId,
      discipline: filters.discipline ?? intent?.discipline,
      docType: filters.docType ?? (intent?.docTypes.length === 1 ? intent.docTypes[0] : undefined),
      securityLevels: filters.securityLevels,
    };

    let results;
    try {
      results = await this.queryVectorSearch(query, queryEmbedding, mergedFilters, limit);
    } catch (err) {
      const canSqlFallback =
        this.config.useSqlFallback !== false && !!this.config.warehouseId;
      if (canSqlFallback) {
        results = await this.queryGoldSql(query, mergedFilters, limit);
      } else {
        throw err;
      }
    }

    if (intent && intent.intent !== 'general') {
      results = rerankByIntent(results, intent);
    }

    return results.slice(0, limit);
  }

  private async queryVectorSearch(
    query: string,
    _queryEmbedding: number[],
    filters: {
      projectId?: string;
      discipline?: string;
      docType?: string;
      securityLevels?: string[];
    },
    limit: number,
  ) {
    const indexName =
      this.config.vectorIndexName ??
      `${this.config.catalog}.${this.config.goldSchema}.document_chunks_index`;

    const filterConditions: Record<string, unknown> = {};
    if (filters.projectId) filterConditions.project_id = filters.projectId;
    if (filters.discipline) filterConditions.discipline = filters.discipline;
    if (filters.docType) filterConditions.doc_type = filters.docType;
    if (filters.securityLevels?.length) {
      filterConditions.security_level = filters.securityLevels;
    }

    const res = await fetch(
      `${this.baseUrl}/api/2.0/vector-search/indexes/${encodeURIComponent(indexName)}/query`,
      {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({
          query_text: query,
          columns: [
            'chunk_id',
            'document_id',
            'content',
            'title',
            'revision',
            'doc_type',
            'discipline',
            'security_level',
          ],
          filters_json: JSON.stringify(filterConditions),
          num_results: limit,
        }),
      },
    );

    if (!res.ok) {
      throw new Error(`Databricks Vector Search failed: ${res.status} ${await res.text()}`);
    }

    const data = (await res.json()) as {
      result?: { data_array?: unknown[][]; column_names?: string[] };
    };

    return this.mapResults(data);
  }

  private async queryGoldSql(
    query: string,
    filters: {
      projectId?: string;
      discipline?: string;
      docType?: string;
      securityLevels?: string[];
    },
    limit: number,
  ) {
    const table = `${this.config.catalog}.${this.config.goldSchema}.document_chunks`;
    const conditions: string[] = [`content ILIKE '%${query.replace(/'/g, "''").split(' ')[0]}%'`];
    if (filters.projectId) conditions.push(`project_id = '${filters.projectId}'`);
    if (filters.discipline) conditions.push(`discipline = '${filters.discipline}'`);
    if (filters.docType) conditions.push(`doc_type = '${filters.docType}'`);
    if (filters.securityLevels?.length) {
      conditions.push(
        `security_level IN (${filters.securityLevels.map((s) => `'${s}'`).join(',')})`,
      );
    }

    const sql = `
      SELECT chunk_id, document_id, content, title, revision, doc_type, discipline, security_level
      FROM ${table}
      WHERE ${conditions.join(' AND ')}
      LIMIT ${limit}
    `;

    const statement = await this.executeSql(sql);
    const rows = statement.result?.data_array ?? [];
    const cols = statement.manifest?.schema?.columns?.map((c: { name: string }) => c.name) ?? [];

    return rows.map((row: unknown[]) => {
      const obj: Record<string, string> = {};
      cols.forEach((col: string, i: number) => {
        obj[col] = String(row[i] ?? '');
      });
      return {
        chunkId: obj.chunk_id,
        documentId: obj.document_id,
        content: obj.content,
        title: obj.title,
        revision: obj.revision,
        docType: obj.doc_type,
        discipline: obj.discipline,
        securityLevel: obj.security_level,
        score: 0.7,
      };
    });
  }

  private async executeSql(statement: string) {
    const warehouseId = this.config.warehouseId;
    if (!warehouseId) {
      throw new Error('DATABRICKS_WAREHOUSE_ID required for SQL fallback on Gold layer');
    }

    const res = await fetch(`${this.baseUrl}/api/2.0/sql/statements`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        warehouse_id: warehouseId,
        statement,
        wait_timeout: '30s',
      }),
    });

    if (!res.ok) {
      throw new Error(`Databricks SQL failed: ${res.status} ${await res.text()}`);
    }

    return res.json() as Promise<{
      result?: { data_array?: unknown[][] };
      manifest?: { schema?: { columns?: { name: string }[] } };
    }>;
  }

  private mapResults(data: {
    result?: { data_array?: unknown[][]; column_names?: string[] };
  }) {
    const cols = data.result?.column_names ?? [];
    const rows = data.result?.data_array ?? [];

    return rows.map((row, idx) => {
      const obj: VectorSearchRow = {};
      cols.forEach((col, i) => {
        (obj as Record<string, unknown>)[col] = row[i];
      });
      return {
        chunkId: String(obj.chunk_id ?? `dbr-${idx}`),
        documentId: String(obj.document_id ?? ''),
        content: String(obj.content ?? ''),
        title: String(obj.title ?? ''),
        revision: String(obj.revision ?? ''),
        docType: String(obj.doc_type ?? ''),
        discipline: String(obj.discipline ?? ''),
        securityLevel: String(obj.security_level ?? ''),
        score: Number(obj.score ?? 0.8),
      };
    });
  }
}
