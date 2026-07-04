# Evaluation Framework

Evaluation is a **buy the judges, keep the orchestration** layer: NestJS/BullMQ still run agents; scoring is pluggable via `EVAL_BACKEND`.

## Why MLflow

The original heuristic scorer estimated groundedness and citation accuracy with token overlap. That was a reasonable placeholder, but it is not calibrated. Databricks-managed MLflow provides research-backed LLM judges and custom domain judges in natural language, while remaining **framework-agnostic** — traces can come from any orchestrator, including this NestJS stack. We did **not** migrate agent orchestration to Agent Bricks or Model Serving; only the evaluation step calls `apps/eval-service`.

## Architecture

```
agent_run completes
  → BullMQ evaluate_response
  → EVAL_BACKEND=mlflow?
       yes → eval-service POST /trace → POST /evaluate/:mlflowRunId
            → evaluations row (judge_scores + derived columns + mlflow_run_id)
       no  → local scoreEvaluation() heuristic
            → evaluations row (eval_backend=heuristic)
```

| Component | Role |
|-----------|------|
| `apps/api` | Unchanged orchestration; enqueues `evaluate_response` |
| `apps/worker` | Calls eval-service or heuristic; writes `evaluations` |
| `apps/eval-service` | Python FastAPI sidecar: MLflow traces + judges |

## Feature flag

| Setting | Default | Behavior |
|---------|---------|----------|
| `EVAL_BACKEND` | `heuristic` | Local overlap scorer (zero Python dependency) |
| | `mlflow` | `eval-service` judges; falls back to heuristic if service is down |
| `EVAL_SERVICE_URL` | `http://localhost:8100` | Sidecar base URL (`http://eval-service:8100` in Docker) |
| `MLFLOW_TRACKING_URI` | empty | Local file store in eval-service; set `databricks` + host/token for workspace |
| `MLFLOW_EXPERIMENT_PATH` | `/Shared/infraops-ai-eval` | Experiment name/path |

Configure under **Admin → Settings → MLflow**.

## Judges

### Built-in (four)

| Judge | Measures |
|-------|----------|
| **Correctness** | Answer aligns with retrieved evidence (proxy: groundedness + citations) |
| **RelevanceToQuery** | Answer addresses the question |
| **Safety** | No disallowed content |
| **Groundedness** | Claims supported by retrieved chunks only |

Guidelines text for groundedness (verbatim):

> The response must only assert claims that are directly supported by the retrieved document chunks in the trace. Flag any claim not traceable to a specific chunk.

When MLflow GenAI scorers are unavailable (common on Free Edition / local), eval-service uses **local proxies** that write the same `judge_scores` shape (`_source: local_proxy`).

### Custom domain judges

**contract_clause_fidelity** (instructions):

> Analyze the trace for a contract analysis agent response. Verify that every clause, obligation, or risk flag mentioned in the outputs is actually present in the source document chunks retrieved in the trace. Penalize any invented clause or obligation not found in the retrieved context.

**iot_explanation_fidelity** — explanations must reference actual sensor reading values, not pure boilerplate.

## Data model

`evaluations` columns:

| Column | Purpose |
|--------|---------|
| `groundedness`, `citation_accuracy`, `relevance`, `hallucination_flag` | Dashboard-compatible metrics (derived from judges when `eval_backend=mlflow`) |
| `eval_backend` | `heuristic` or `mlflow` |
| `mlflow_run_id` | Trace id for drill-down |
| `judge_scores` | Raw per-judge JSON |

## Harness (`npm run eval`)

1. Runs all 15 questions through the live RAG pipeline (same as before).
2. If `EVAL_BACKEND=mlflow` and eval-service is healthy, scores via `POST /harness/run`.
3. Otherwise uses the heuristic scorer.
4. Prints a scorecard and, for MLflow mode, writes `apps/eval-service/harness-results/<timestamp>.json`.

```bash
docker compose up -d   # includes eval-service on :8100
# Admin or env: EVAL_BACKEND=mlflow EVAL_SERVICE_URL=http://localhost:8100
npm run eval
```

### Sample scorecard (heuristic, seeded pgvector)

```
═══════════════════════════════════════════════════
  InfraOps AI - RAG Evaluation Scorecard
  Retrieval backend: pgvector
  Eval backend:      heuristic
═══════════════════════════════════════════════════

✓ q01: groundedness=0.42 citations=3 PASS
…

── Summary ──────────────────────────────────────
  Pass rate:          12/15 (80%)
  Avg groundedness:   0.36
  Avg citation acc:   1.00
  Avg relevance:      0.41
  Hallucination rate: 15%
═══════════════════════════════════════════════════
```

Pass criteria per question: `groundedness >= 0.3` and `citationAccuracy >= 0.5`. Suite exit code 0 if pass rate ≥ 60%.

## Admin dashboard

`GET /api/evaluations/summary` includes:

- Aggregate metrics (unchanged)
- `byBackend: { heuristic, mlflow }`
- `recent[]` with `evalBackend` and `mlflowRunId` per evaluation

Admin UI shows backend counts and recent rows so heuristic vs MLflow provenance is visible.

## Running eval-service locally

```bash
cd apps/eval-service
pip install -e ".[dev]"
uvicorn main:app --app-dir src --port 8100
pytest
```

Docker: service `eval-service` on port **8100**.

## Related

- [iot-anomaly-model.md](./iot-anomaly-model.md) — separate Model Serving path for IoT scoring
- [architecture.md](./architecture.md)
- `apps/eval-service/`
