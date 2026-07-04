# Build Log - InfraOps AI

Living task log for coding agent context across sessions.

---

## Session: 2026-07-03 - MLflow Evaluation Upgrade (COMPLETE)

### Goal
Replace heuristic-only evaluation with MLflow-backed judges via a Python sidecar, keep NestJS orchestration unchanged. Spec: `InfraOps_AI_MLflow_Eval_Upgrade.md`.

### Completed

- [x] **`apps/eval-service`** — FastAPI: `/trace`, `/evaluate/:id`, `/harness/run`, health
- [x] **Judges** — Correctness, RelevanceToQuery, Safety, Groundedness (+ local proxies); custom `contract_clause_fidelity`, `iot_explanation_fidelity`
- [x] **Schema** — `evaluations.mlflow_run_id`, `eval_backend`, `judge_scores`
- [x] **Settings** — `EVAL_BACKEND`, `EVAL_SERVICE_URL`, `MLFLOW_EXPERIMENT_PATH` (env overrides for Docker)
- [x] **Worker** — `processEvaluation` calls eval-service when `EVAL_BACKEND=mlflow`, heuristic fallback
- [x] **`npm run eval`** — scores via harness endpoint when service healthy; writes JSON artifacts
- [x] **Admin summary** — `byBackend` + recent rows with `mlflowRunId`
- [x] **Docs** — rewritten `docs/evaluation.md`; docker-compose `eval-service` on :8100

### Verification

```bash
cd apps/eval-service && pip install -e ".[dev]" && pytest
docker compose up --build
# Admin → EVAL_BACKEND=mlflow (or env on worker)
npm run eval
```

### Notes

- Default remains `EVAL_BACKEND=heuristic` so demos work without Python judges.
- Local proxies run when MLflow GenAI scorers are unavailable (Free Edition).

---

## Session: 2026-07-03 - Model Serving IoT Anomaly Upgrade (COMPLETE)

### Goal
Replace high-frequency LLM-style detection with a small classifier path (heuristic or Databricks Model Serving); LLM only explains flagged events. Spec: `InfraOps_AI_ModelServing_IoT_Upgrade.md`.

### Completed

- [x] **Settings** — `IOT_SCORING_BACKEND`, `IOT_MODEL_ENDPOINT_URL`, `IOT_MODEL_ENDPOINT_TOKEN`, `IOT_MODEL_VERSION` (Admin → IoT Anomaly Scoring)
- [x] **Schema** — `iot_events.scoring_backend`, `model_version`, `explanation` + migration
- [x] **`analyzeIot`** — feature extract → score (heuristic | model_serving with fallback) → LLM explain if flagged
- [x] **Worker** — `processIotEvent` uses two-step flow; audit log includes explanation + backend
- [x] **Training notebook** — `databricks/notebooks/05_train_iot_anomaly_model.py` (IsolationForest + MLflow UC)
- [x] **Deploy script** — `databricks/serving/iot_anomaly_endpoint.py` (dev scale-to-zero vs demo provisioned)
- [x] **Docs** — `docs/iot-anomaly-model.md`, architecture IoT sequence, unit tests for heuristic path
- [x] **UI** — IoT Monitor shows scoring backend + explanation on alerts

### Verification

```bash
npm run build -w @infraops/shared -w @infraops/ai-tools
npm run test -w @infraops/ai-tools
# With stack up:
npm run iot:simulate
# Admin → Settings → IOT_SCORING_BACKEND=heuristic (default)
```

### Notes

- Default remains **heuristic** (zero Databricks dependency).
- Model Serving deploy is optional and cost-aware (`scale_to_zero` for day-to-day).
- No changes to RAG, agent orchestration, or eval harness beyond IoT.

---

## Session: 2026-07-02 - Phase 5 Polish & Narrative (COMPLETE)

### Goal
Phase 5 DoD: stranger can clone, follow README, run full stack in ~15 minutes; docs reflect what's built.

### Completed

- [x] **`GET /api/dashboard/executive`** - aggregates docs, evals, reviews, IoT, queues, project KPIs
- [x] **Executive Dashboard UI** - Recharts for eval scores + doc types; recent runs, IoT alerts, retrieval backend badge
- [x] **`docs/architecture.md`** - as-built mermaid diagrams (context, RAG sequence, build vs buy)
- [x] **README** - 15-minute quick start, demo walkthrough, troubleshooting, screenshot checklist
- [x] **`docs/evaluation.md`** - metrics reference + sample scorecard format + MLflow notes
- [x] **`docs/ai-sdlc.md`** - Phase 5 component maturity table
- [x] **`docs/SUCCESS_CHECKLIST.md`** - Section 23 success criteria
- [x] **`docs/screenshots/README.md`** - capture guide for portfolio assets
- [x] **`docs/eval-results/latest.txt`** - placeholder for `npm run eval` output
- [x] **TypeScript** - `ExecutiveSummary` types in web `api.ts`

### Verification

```bash
docker compose up --build
# → http://localhost:5173 - Executive Dashboard shows live metrics
npm run build && npm run typecheck
npm run eval   # paste output to docs/eval-results/latest.txt
```

### Notes

- Eval requires Docker Postgres (port 5432) - stop host Postgres if bind fails
- Screenshots are manual capture per `docs/screenshots/README.md`

---

## Session: 2026-07-02 - Phase 4 Databricks Integration (COMPLETE)

### Goal
Phase 4 DoD: `RETRIEVAL_BACKEND=databricks` produces cited answers from Gold-layer Databricks tables.

### Completed

- [x] **Unity Catalog** - `databricks/unity_catalog/setup.sql` (infraops.bronze/silver/gold)
- [x] **Medallion notebooks** - 01 bronze ingest, 02 silver transform, 03 gold curate, 04 vector index
- [x] Gold tables: `document_chunks`, `project_kpis`, `risk_scores`, `iot_daily_rollup`
- [x] **`DatabricksVectorRetriever`** - Vector Search API + SQL fallback on `gold.document_chunks`
- [x] **`createRetriever()` factory** - swaps pgvector ↔ databricks via `RETRIEVAL_BACKEND`
- [x] Env validation requires DATABRICKS_HOST/TOKEN when backend=databricks
- [x] RAG responses include `retrievalBackend`; health endpoint shows active backend
- [x] **MLflow** - eval harness logs pass_rate, groundedness, etc. to `infraops-rag-eval` experiment
- [x] `npm run eval` supports `RETRIEVAL_BACKEND=databricks`
- [x] `databricks/README.md` setup guide + Free Edition fallback documented
- [x] `docs/rag.md` updated with full medallion + adapter docs

### Verification

```bash
# 1. Set up Databricks Free Edition (see databricks/README.md)
# 2. Run notebooks 01→04, upload seed to DBFS
# 3. Configure .env:
RETRIEVAL_BACKEND=databricks
DATABRICKS_HOST=https://adb-xxx.azuredatabricks.net
DATABRICKS_TOKEN=dapi...
DATABRICKS_WAREHOUSE_ID=...
MLFLOW_TRACKING_URI=https://adb-xxx.azuredatabricks.net

# 4. Eval against Gold layer
npm run eval

# 5. RAG query via API - citations sourced from gold.document_chunks
```

### Free Edition note

If Vector Search index creation fails (quota), set `DATABRICKS_USE_SQL_FALLBACK=true` to query Gold via SQL API. Documented in `databricks/README.md`.

### Next session (Phase 5)

1. Finalize `docs/architecture.md` with real diagrams
2. README 15-minute setup + screenshots
3. Populate executive dashboard with Databricks-sourced metrics where applicable

---

## Phase status summary

| Phase | Status | DoD |
|-------|--------|-----|
| 1 Foundation | ✅ Complete | docker up, login, dashboard |
| 2 Document RAG | ✅ Complete | upload + cited RAG answer |
| 3 Review + Eval + IoT | ✅ Complete | review workflow, eval scorecard, IoT alert |
| 4 Databricks | ✅ Complete | RETRIEVAL_BACKEND=databricks + notebooks + MLflow |
| 5 Polish | ✅ Complete | README 15-min setup, architecture docs, executive dashboard |
