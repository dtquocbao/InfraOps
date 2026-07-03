# Databricks Setup - InfraOps AI

Medallion pipeline for Meridian Grid Services synthetic seed data.

## Prerequisites

1. Sign up for [Databricks Free Edition](https://www.databricks.com/learn/free-edition) (not Community Edition - retired)
2. Create a personal access token: **Settings → Developer → Access tokens**
3. Create a SQL warehouse (for SQL fallback): **SQL → SQL Warehouses → Create**
4. Install the **Databricks CLI** (required for `databricks fs` upload)

### Install Databricks CLI (Windows)

```powershell
winget install --id Databricks.DatabricksCLI -e
```

Close and reopen the terminal (PATH update), then verify:

```powershell
databricks -v
```

Alternative (any OS with Python):

```bash
pip install databricks-cli
```

## 1. Unity Catalog

Run `unity_catalog/setup.sql` in a SQL editor or:

```sql
-- Creates infraops catalog + bronze/silver/gold schemas
```

## 2. Authenticate & upload seed data

**Option A — interactive configure (new CLI):**

```powershell
# Restart terminal after winget install, then:
databricks configure
# Host: https://adb-xxx.azuredatabricks.net
# Token: dapi...
```

**Option B — environment variables (no interactive prompt):**

```powershell
$env:DATABRICKS_HOST = "https://adb-xxx.azuredatabricks.net"
$env:DATABRICKS_TOKEN = "dapi..."
```

Upload seed files from the repo root:

```powershell
cd D:\WORKSPACE\PROJECTS\QISG\InfraOps
databricks fs cp -r seed dbfs:/FileStore/infraops/seed --overwrite
```

## 3. Run notebooks (in order)

| Notebook | Output |
|----------|--------|
| `01_bronze_ingest.py` | `bronze.documents_raw`, `bronze.iot_events_raw` |
| `02_silver_transform.py` | `silver.documents_parsed`, `silver.document_chunks`, `silver.iot_events` |
| `03_gold_curate.py` | `gold.document_chunks`, `gold.project_kpis`, `gold.risk_scores`, `gold.iot_daily_rollup` |
| `04_vector_index.py` | Vector Search index on Gold chunks |

Import notebooks via **Workspace → Import** or sync with Databricks Repos.

## 4. Configure the app

```bash
# .env
RETRIEVAL_BACKEND=databricks
DATABRICKS_HOST=https://adb-xxx.azuredatabricks.net
DATABRICKS_TOKEN=dapi...
DATABRICKS_CATALOG=infraops
DATABRICKS_VECTOR_INDEX=infraops.gold.document_chunks_index
DATABRICKS_WAREHOUSE_ID=abc123...   # for SQL fallback
DATABRICKS_USE_SQL_FALLBACK=true
MLFLOW_TRACKING_URI=https://adb-xxx.azuredatabricks.net  # same host for Databricks MLflow
```

## 5. Verify

```bash
# Health check shows retrieval backend
curl http://localhost:3000/api/health

# RAG query against Gold layer
RETRIEVAL_BACKEND=databricks npm run eval
```

## Free Edition limitations

Vector Search may be quota-limited on Free Edition. If `04_vector_index.py` fails:

1. Set `DATABRICKS_USE_SQL_FALLBACK=true` - app queries `gold.document_chunks` via SQL API
2. Or keep `RETRIEVAL_BACKEND=pgvector` for local demo

Both paths remain demonstrable via the feature flag.

## Gold table schemas

### gold.document_chunks
| Column | Type | Description |
|--------|------|-------------|
| chunk_id | STRING | Primary key |
| document_id | STRING | Source document |
| content | STRING | Chunk text |
| title, revision, doc_type, discipline, security_level, project_id | STRING | Metadata for filters |
| chunk_index | INT | Order within document |

### gold.project_kpis
project_id, project_name, status, budget_usd, spent_usd, schedule_index, reporting_period

### gold.risk_scores
risk_id, project_id, description, severity, score

### gold.iot_daily_rollup
rollup_date, device_id, event_count, avg_anomaly_score, max_anomaly_score
