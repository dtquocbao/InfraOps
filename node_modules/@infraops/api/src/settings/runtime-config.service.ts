import { Injectable, Logger } from '@nestjs/common';
import { createEmbeddingAdapter, createLlmAdapter, createRetriever, type RetrieverAdapter } from '@infraops/ai-tools';
import { PrismaService } from '../prisma/prisma.module';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class RuntimeConfigService {
  private readonly logger = new Logger(RuntimeConfigService.name);

  constructor(
    private readonly settings: SettingsService,
    private readonly prisma: PrismaService,
  ) {}

  getRetrievalBackend() {
    return this.settings.get('RETRIEVAL_BACKEND') || 'pgvector';
  }

  isDatabricksConfigured() {
    return !!(this.settings.get('DATABRICKS_HOST') && this.settings.get('DATABRICKS_TOKEN'));
  }

  createEmbedder() {
    return createEmbeddingAdapter(this.settings.get('OPENAI_API_KEY') || undefined);
  }

  createLlm() {
    return createLlmAdapter({
      anthropicKey: this.settings.get('ANTHROPIC_API_KEY') || undefined,
      openaiKey: this.settings.get('OPENAI_API_KEY') || undefined,
    });
  }

  createRetriever(): RetrieverAdapter {
    const backend = this.getRetrievalBackend() as 'pgvector' | 'databricks';
    return createRetriever({
      backend,
      pgExecuteSql: async (sql, params) =>
        this.prisma.$queryRawUnsafe(sql, ...params) as Promise<
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
        >,
      databricks: {
        host: this.settings.get('DATABRICKS_HOST'),
        token: this.settings.get('DATABRICKS_TOKEN'),
        catalog: this.settings.get('DATABRICKS_CATALOG') || 'infraops',
        goldSchema: this.settings.get('DATABRICKS_SCHEMA_GOLD') || 'gold',
        vectorIndexName: this.settings.get('DATABRICKS_VECTOR_INDEX') || undefined,
        warehouseId: this.settings.get('DATABRICKS_WAREHOUSE_ID') || undefined,
        useSqlFallback: this.settings.get('DATABRICKS_USE_SQL_FALLBACK') !== 'false',
      },
      onFallback: (err) => {
        this.logger.warn(
          `Databricks retrieval failed (${err instanceof Error ? err.message : err}); falling back to pgvector`,
        );
      },
    });
  }
}
