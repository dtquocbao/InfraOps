# Evaluation Framework

Automated scoring for every agent run plus an on-demand 15-question RAG scorecard.

## Metrics (Section 16)

| Metric | Implementation | Stored in |
|--------|----------------|-----------|
| Groundedness | Token overlap: answer ↔ retrieved chunks | `evaluations.groundedness` |
| Citation accuracy | Valid cited chunk IDs / total citations | `evaluations.citation_accuracy` |
| Relevance | Token overlap: question ↔ answer | `evaluations.relevance` |
| Hallucination flag | `groundedness < 0.45` with citations present | `evaluations.hallucination_flag` |
| Retrieval hit rate | ≥1 chunk above similarity threshold | computed in harness |
| Latency / cost | Per-run timing | `agent_runs.latency_ms` |
| User rating | Reviewer approve (+1) / reject (-1) | `evaluations.user_rating` |

## Async evaluation

After each RAG query, an `evaluate_response` BullMQ job scores the response and writes to `evaluations`.

## Eval harness

```bash
# Requires seeded Postgres (docker compose up)
npm run eval

# Against Databricks Gold layer
RETRIEVAL_BACKEND=databricks npm run eval
```

Exit code **0** if pass rate ≥ 60%.

### Sample scorecard output (pgvector, seeded)

Run after `docker compose up --build` completes seeding:

```
═══════════════════════════════════════════════════
  InfraOps AI - RAG Evaluation Scorecard
  Retrieval backend: pgvector
═══════════════════════════════════════════════════

✓ q01: groundedness=0.42 citations=3 PASS
✓ q02: groundedness=0.38 citations=2 PASS
✓ q03: groundedness=0.35 citations=2 PASS
✓ q04: groundedness=0.31 citations=2 PASS
✓ q05: groundedness=0.40 citations=3 PASS
... (15 questions total)

── Summary ──────────────────────────────────────
  Pass rate:          12/15 (80%)
  Avg groundedness:   0.36
  Avg citation acc:   1.00
  Avg relevance:      0.41
  Hallucination rate: 15%
  Retrieval hit rate: 100%
  Avg latency:        450ms
═══════════════════════════════════════════════════
```

> **Note:** Exact numbers vary with embedding mode (OpenAI vs hash fallback) and LLM adapter. Re-run locally to capture your scorecard - paste into `docs/eval-results/latest.txt` for portfolio records.

### Test questions

Defined in `packages/shared/src/schemas/evaluation.ts` - 15 questions covering safety SOPs, contracts, engineering specs, and project reports for Substation Alpha.

## API

- `GET /api/evaluations/summary` - aggregate metrics for Executive Dashboard
- `GET /api/dashboard/executive` - full KPI bundle

## MLflow integration

When `MLFLOW_TRACKING_URI` is set:

```
Experiment: infraops-rag-eval
Metrics: pass_rate, avg_groundedness, avg_citation_accuracy, avg_relevance,
         hallucination_rate, retrieval_hit_rate, avg_latency_ms
Parameter: retrieval_backend
```

Databricks-hosted MLflow uses the same `DATABRICKS_TOKEN` for auth.

## Reproducing for portfolio

```bash
docker compose up -d
npm run eval 2>&1 | tee docs/eval-results/latest.txt
```

Commit `latest.txt` after a successful run to freeze scorecard evidence.
