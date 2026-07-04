import { z } from 'zod';

export const SettingCategory = z.enum(['llm', 'retrieval', 'databricks', 'mlflow', 'iot']);
export type SettingCategory = z.infer<typeof SettingCategory>;

export interface SettingDefinition {
  key: string;
  label: string;
  description: string;
  category: SettingCategory;
  defaultValue: string;
  isSecret: boolean;
  options?: string[];
}

export const SETTING_DEFINITIONS: SettingDefinition[] = [
  {
    key: 'ANTHROPIC_API_KEY',
    label: 'Anthropic API Key',
    description: 'Claude API key for LLM generation',
    category: 'llm',
    defaultValue: '',
    isSecret: true,
  },
  {
    key: 'OPENAI_API_KEY',
    label: 'OpenAI API Key',
    description: 'OpenAI key for embeddings and LLM fallback',
    category: 'llm',
    defaultValue: '',
    isSecret: true,
  },
  {
    key: 'RETRIEVAL_BACKEND',
    label: 'Retrieval Backend',
    description: 'Vector search source: local pgvector or Databricks Gold layer',
    category: 'retrieval',
    defaultValue: 'pgvector',
    isSecret: false,
    options: ['pgvector', 'databricks'],
  },
  {
    key: 'DATABRICKS_HOST',
    label: 'Databricks Host',
    description: 'Workspace URL (e.g. https://adb-xxx.azuredatabricks.net)',
    category: 'databricks',
    defaultValue: '',
    isSecret: false,
  },
  {
    key: 'DATABRICKS_TOKEN',
    label: 'Databricks Token',
    description: 'Personal access token for Databricks API',
    category: 'databricks',
    defaultValue: '',
    isSecret: true,
  },
  {
    key: 'DATABRICKS_CATALOG',
    label: 'Unity Catalog',
    description: 'Catalog name for medallion schemas',
    category: 'databricks',
    defaultValue: 'infraops',
    isSecret: false,
  },
  {
    key: 'DATABRICKS_SCHEMA_BRONZE',
    label: 'Bronze Schema',
    description: 'Bronze layer schema name',
    category: 'databricks',
    defaultValue: 'bronze',
    isSecret: false,
  },
  {
    key: 'DATABRICKS_SCHEMA_SILVER',
    label: 'Silver Schema',
    description: 'Silver layer schema name',
    category: 'databricks',
    defaultValue: 'silver',
    isSecret: false,
  },
  {
    key: 'DATABRICKS_SCHEMA_GOLD',
    label: 'Gold Schema',
    description: 'Gold layer schema name',
    category: 'databricks',
    defaultValue: 'gold',
    isSecret: false,
  },
  {
    key: 'DATABRICKS_VECTOR_INDEX',
    label: 'Vector Search Index',
    description: 'Fully qualified vector index name',
    category: 'databricks',
    defaultValue: '',
    isSecret: false,
  },
  {
    key: 'DATABRICKS_WAREHOUSE_ID',
    label: 'SQL Warehouse ID',
    description: 'Warehouse ID for Gold SQL fallback queries',
    category: 'databricks',
    defaultValue: '',
    isSecret: false,
  },
  {
    key: 'DATABRICKS_USE_SQL_FALLBACK',
    label: 'Use SQL Fallback',
    description: 'Query Gold tables via SQL when Vector Search is unavailable',
    category: 'databricks',
    defaultValue: 'true',
    isSecret: false,
    options: ['true', 'false'],
  },
  {
    key: 'MLFLOW_TRACKING_URI',
    label: 'MLflow Tracking URI',
    description: 'MLflow server for eval experiment logging',
    category: 'mlflow',
    defaultValue: '',
    isSecret: false,
  },
  {
    key: 'IOT_SCORING_BACKEND',
    label: 'IoT Scoring Backend',
    description: 'heuristic (local rules) or model_serving (Databricks endpoint)',
    category: 'iot',
    defaultValue: 'heuristic',
    isSecret: false,
    options: ['heuristic', 'model_serving'],
  },
  {
    key: 'IOT_MODEL_ENDPOINT_URL',
    label: 'IoT Model Endpoint URL',
    description: 'Databricks Model Serving invoke URL for anomaly scoring',
    category: 'iot',
    defaultValue: '',
    isSecret: false,
  },
  {
    key: 'IOT_MODEL_ENDPOINT_TOKEN',
    label: 'IoT Model Endpoint Token',
    description: 'Bearer token for Model Serving (usually DATABRICKS_TOKEN)',
    category: 'iot',
    defaultValue: '',
    isSecret: true,
  },
  {
    key: 'IOT_MODEL_VERSION',
    label: 'IoT Model Version',
    description: 'Registered model version label recorded on each event',
    category: 'iot',
    defaultValue: 'heuristic-v1',
    isSecret: false,
  },
];

export const SETTING_KEYS = SETTING_DEFINITIONS.map((d) => d.key);

export const AppSettingsSchema = z.object({
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  RETRIEVAL_BACKEND: z.enum(['pgvector', 'databricks']).default('pgvector'),
  DATABRICKS_HOST: z.string().optional(),
  DATABRICKS_TOKEN: z.string().optional(),
  DATABRICKS_CATALOG: z.string().default('infraops'),
  DATABRICKS_SCHEMA_BRONZE: z.string().default('bronze'),
  DATABRICKS_SCHEMA_SILVER: z.string().default('silver'),
  DATABRICKS_SCHEMA_GOLD: z.string().default('gold'),
  DATABRICKS_VECTOR_INDEX: z.string().optional(),
  DATABRICKS_WAREHOUSE_ID: z.string().optional(),
  DATABRICKS_USE_SQL_FALLBACK: z
    .string()
    .default('true')
    .transform((v) => v === 'true' || v === '1'),
  MLFLOW_TRACKING_URI: z.string().optional(),
  IOT_SCORING_BACKEND: z.enum(['heuristic', 'model_serving']).default('heuristic'),
  IOT_MODEL_ENDPOINT_URL: z.string().optional(),
  IOT_MODEL_ENDPOINT_TOKEN: z.string().optional(),
  IOT_MODEL_VERSION: z.string().default('heuristic-v1'),
});

export type AppSettings = z.infer<typeof AppSettingsSchema>;

export function settingsRecordToAppSettings(raw: Record<string, string>): AppSettings {
  const merged: Record<string, string> = {};
  for (const def of SETTING_DEFINITIONS) {
    merged[def.key] = raw[def.key] ?? def.defaultValue;
  }
  const parsed = AppSettingsSchema.safeParse(merged);
  if (!parsed.success) {
    throw new Error(`Invalid app settings: ${parsed.error.message}`);
  }
  if (parsed.data.RETRIEVAL_BACKEND === 'databricks') {
    if (!parsed.data.DATABRICKS_HOST || !parsed.data.DATABRICKS_TOKEN) {
      throw new Error('RETRIEVAL_BACKEND=databricks requires DATABRICKS_HOST and DATABRICKS_TOKEN');
    }
  }
  return parsed.data;
}

export function maskSecretValue(value: string, isSecret: boolean): string {
  if (!isSecret || !value) return value;
  if (value.length <= 4) return '••••';
  return `${'•'.repeat(8)}${value.slice(-4)}`;
}

export interface SettingView {
  key: string;
  label: string;
  description: string;
  category: SettingCategory;
  value: string;
  displayValue: string;
  isSecret: boolean;
  options?: string[];
  updatedAt: string | null;
}

export function toSettingViews(
  values: Record<string, { value: string; updatedAt: Date | null }>,
): SettingView[] {
  return SETTING_DEFINITIONS.map((def) => {
    const row = values[def.key];
    const value = row?.value ?? def.defaultValue;
    return {
      key: def.key,
      label: def.label,
      description: def.description,
      category: def.category,
      value,
      displayValue: maskSecretValue(value, def.isSecret),
      isSecret: def.isSecret,
      options: def.options,
      updatedAt: row?.updatedAt?.toISOString() ?? null,
    };
  });
}

export function isMaskedSecretValue(value: string): boolean {
  return /^•{4,}/.test(value);
}

export async function loadSettingsFromDb(
  prisma: { systemSetting: { findMany: () => Promise<{ key: string; value: string }[]> } },
): Promise<Record<string, string>> {
  const rows = await prisma.systemSetting.findMany();
  const map: Record<string, string> = {};
  for (const def of SETTING_DEFINITIONS) {
    map[def.key] = def.defaultValue;
  }
  for (const row of rows) {
    map[row.key] = row.value;
  }
  return map;
}
