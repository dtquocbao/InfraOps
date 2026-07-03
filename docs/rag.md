# RAG Pipeline - InfraOps AI

## Overview

```
Question → Intent classification → Embed query → Tri-hybrid Retriever → RBAC filters →
LLM with context → Grounded answer + citations → [Human Review if flagged] → agent_runs + evaluations
```

**Tri-hybrid retrieval** combines three signals:

| Signal | Weight | Mechanism |
|--------|--------|-----------|
| **Semantic** | 50% | pgvector cosine / Databricks Vector Search embeddings |
| **Keyword** | 30% | PostgreSQL `ts_rank` full-text search on chunk content |
| **Intent** | 20% | Rule-based intent classifier → doc-type alignment + intent keyword match |

Retrieval reads **governed Gold-layer data only** when `RETRIEVAL_BACKEND=databricks`. Local pgvector is the operational cache/fallback for Phases 1–3 and dev without Databricks credentials.

## Intent classification

Implemented in `packages/shared/src/query-intent.ts` - rule-based, no extra LLM call.

| Intent | Doc types boosted | Example question |
|--------|-------------------|------------------|
| `safety_procedure` | `safety_sop` | "What is the lockout-tagout procedure?" |
| `contract_terms` | `contract` | "What liability cap applies to Helix Power?" |
| `project_status` | `project_report` | "What is the Q1 2026 budget status?" |
| `engineering_spec` | `engineering` | "138kV transmission line specification" |
| `general` | (none) | Fallback when no domain keywords match |

Flow:

1. `classifyQueryIntent(question)` → intent profile + expanded keyword query
2. Retriever applies intent doc-type filter (soft) and intent scoring leg
3. API response includes `detectedIntent` for traceability

## Retrieval backends

| Backend | Env | Source | Search modes |
|---------|-----|--------|--------------|
| `pgvector` (default) | Admin → Settings | Postgres `document_chunks` | 50% semantic + 30% keyword + 20% intent (single SQL) |
| `databricks` | Admin → Settings | `infraops.gold.document_chunks` | Vector Search + intent re-rank |

Adapter factory: `createRetriever()` in `packages/ai-tools/src/retrieval/factory.ts`

### Databricks path

1. Notebooks populate Bronze → Silver → Gold (see `databricks/README.md`)
2. `DatabricksVectorRetriever` calls Vector Search index API
3. On failure (Free Edition quota): falls back to SQL on `gold.document_chunks` when `DATABRICKS_USE_SQL_FALLBACK=true`

## Databricks medallion pipeline

| Layer | Notebook | Tables |
|-------|----------|--------|
| Bronze | `01_bronze_ingest.py` | `bronze.documents_raw`, `bronze.iot_events_raw` |
| Silver | `02_silver_transform.py` | `silver.documents_parsed`, `silver.document_chunks`, `silver.iot_events` |
| Gold | `03_gold_curate.py` | `gold.document_chunks`, `gold.project_kpis`, `gold.risk_scores`, `gold.iot_daily_rollup` |
| Vector | `04_vector_index.py` | `gold.document_chunks_index` (Vector Search) |

Unity Catalog setup: `databricks/unity_catalog/setup.sql`

## Local document ingestion (pgvector)

1. **Seed ingest** - `npm run db:seed` processes 15 files from `seed/documents/manifest.json`
2. **Upload** - `POST /api/documents/upload` → BullMQ worker → pgvector
3. Used when `RETRIEVAL_BACKEND=pgvector` or as operational store

## Embeddings

OpenAI `text-embedding-3-small` (1536 dims) when `OPENAI_API_KEY` set; hash fallback for dev.

## LLM generation

Claude → OpenAI → context-aware stub (no keys required for keyword-heavy retrieval).

## Evaluation + MLflow

```bash
npm run eval                              # pgvector (local)
RETRIEVAL_BACKEND=databricks npm run eval # Gold layer
```

Logs metrics to MLflow when `MLFLOW_TRACKING_URI` is set. Experiment: `infraops-rag-eval`.

## API

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/agents/rag/query` | Grounded Q&A - response includes `retrievalBackend` |
| GET | `/api/health` | Shows active `retrievalBackend` + `databricksConfigured` |
| GET | `/api/agents/runs/:id` | Full trace |

## Test questions

- "What is the lockout-tagout procedure?"
- "What liability cap applies to Helix Power Cooperative?"
- "What are the top risks in the current risk register?"
