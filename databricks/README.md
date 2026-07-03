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

## 1. Unity Catalog + seed volume

Open **SQL → SQL Editor** in Databricks and run `databricks/unity_catalog/setup.sql`.

This creates:

- Catalog `infraops` and schemas `bronze` / `silver` / `gold`
- Volume `infraops.bronze.seed_files` (path: `/Volumes/infraops/bronze/seed_files`)

> **Do not use `dbfs:/FileStore/...`** — many workspaces (including Free Edition) disable the public DBFS root and return:
> `Public DBFS root is disabled. Access is denied on path: /FileStore/...`

## 2. Authenticate & upload seed data

**Option A — interactive configure (new CLI):**

```powershell
# Restart terminal after winget install, then:
databricks configure
# Host: https://dbc-xxx.cloud.databricks.com
# Token: dapi...
```

**Option B — environment variables (no interactive prompt):**

```powershell
$env:DATABRICKS_HOST = "https://dbc-xxx.cloud.databricks.com"
$env:DATABRICKS_TOKEN = "dapi..."
```

Upload seed files from the repo root **into the Unity Catalog volume**:

```powershell
cd D:\WORKSPACE\PROJECTS\QISG\InfraOps

# Documents (required for bronze ingest)
databricks fs cp -r seed/documents /Volumes/infraops/bronze/seed_files/documents --overwrite

# Optional: IoT fixtures folder
databricks fs cp -r seed/iot /Volumes/infraops/bronze/seed_files/iot --overwrite
```

Verify:

```powershell
databricks fs ls /Volumes/infraops/bronze/seed_files/documents
```

You should see `manifest.json` and the `.md` / `.txt` seed files.

**UI alternative:** Catalog Explorer → `infraops` → `bronze` → `seed_files` → Upload.

## 3. Run notebooks (in order)

Import notebooks via **Workspace → Import**. Use a **SQL warehouse** or classic cluster if Serverless blocks libraries.

| Notebook | Required? | Output |
|----------|-----------|--------|
| `01_bronze_ingest.py` | **Yes** | `bronze.documents_raw`, `bronze.iot_events_raw` |
| `02_silver_transform.py` | **Yes** | `silver.documents_parsed`, `silver.document_chunks`, `silver.iot_events` |
| `03_gold_curate.py` | **Yes** | `gold.document_chunks`, KPIs, risks, IoT rollup |
| `04_vector_index.py` | **No** (optional) | Vector Search index — often unavailable on Free Edition / Serverless |

After **03**, verify in Catalog Explorer:

`infraops.gold.document_chunks` has rows (expect ~60+ chunks).

**Notebook 04 failure is OK.** On Serverless, `%pip install databricks-vector-search` fails (`No matching distribution`). The app does **not** need Vector Search — use SQL fallback (below).

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

## Free Edition / Serverless limitations

| Limitation | What to do |
|------------|------------|
| Public DBFS disabled | Use UC volume `/Volumes/infraops/bronze/seed_files` |
| `databricks-vector-search` pip fails | Skip notebook 04; use SQL fallback |
| Vector Search endpoint quota | Same — SQL fallback |
| No OpenAI secret for embeddings | Not required for SQL fallback |

**App settings (Admin → Settings or env):**

```
RETRIEVAL_BACKEND=databricks
DATABRICKS_HOST=https://dbc-xxx.cloud.databricks.com
DATABRICKS_TOKEN=dapi...
DATABRICKS_CATALOG=infraops
DATABRICKS_SCHEMA_GOLD=gold
DATABRICKS_WAREHOUSE_ID=<from SQL → SQL Warehouses>
DATABRICKS_USE_SQL_FALLBACK=true
```

Find warehouse ID: **SQL → SQL Warehouses → your warehouse → Connection details**.

Or keep `RETRIEVAL_BACKEND=pgvector` for local Postgres demo.

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
