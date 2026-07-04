# InfraOps AI — MLflow Evaluation Upgrade

## Coding Agent Instructions

This document is an addendum to the original `InfraOps_AI_Agent_Build_Instructions.Rmd`.
It does not change the platform's architecture — it upgrades one subsystem: the
evaluation harness described in that spec's Section 16. Read this alongside the
original spec, not instead of it.

---

## 0. Objective

Replace the heuristic evaluation scoring with **Databricks-managed MLflow Agent
Evaluation** (built-in and custom LLM judges), while keeping 100% of the existing
NestJS agent orchestration untouched. This is an additive change, not a rewrite.

**Do not** migrate agent orchestration to Databricks Agent Bricks, Model Serving, or
AI Gateway as part of this task. Orchestration stays in `apps/api` and `apps/worker`
exactly as it is. Only the evaluation step changes.

**Definition of Done for this task:**
- Every `agent_run` produces an MLflow trace with a retrievable `mlflow_run_id`
- At least 4 built-in judges (Correctness, RelevanceToQuery, Safety, Groundedness)
  score every trace
- At least 1 custom domain judge (Section 5) is implemented and scoring real traces
- `npm run eval` runs the fixed 15-question harness against MLflow instead of the
  old heuristic scorer and produces a scorecard
- The heuristic scorer still exists behind a feature flag as a fallback — do not
  delete it
- `docs/evaluation.md` is rewritten to describe the actual system, not the old one

---

## 1. Why (context for the agent, not user-facing)

The original heuristic scorer estimated groundedness/citation accuracy with
simple string/overlap heuristics. That was a reasonable placeholder, but Databricks'
managed MLflow provides calibrated, research-backed LLM judges for the same
dimensions, plus the ability to define domain-specific custom judges in natural
language. Since MLflow is framework-agnostic, it can evaluate traces from **any**
orchestration layer — including this project's existing NestJS/BullMQ stack —
without requiring a migration to Databricks-native orchestration. This is a "buy the
evaluation layer, keep the custom orchestration" decision, not an all-in platform
migration.

---

## 2. Prerequisites

1. A Databricks Free Edition workspace already exists per the original spec's
   Section 8. If it doesn't yet, create one at `databricks.com/learn/free-edition`
   before starting this task.
2. Create (or confirm) an MLflow experiment in the workspace for this project, e.g.
   `/Shared/infraops-ai-eval`.
3. Add to `.env` / `.env.example`:

```bash
# MLflow (Databricks-managed)
DATABRICKS_HOST=
DATABRICKS_TOKEN=
MLFLOW_TRACKING_URI=databricks
MLFLOW_EXPERIMENT_PATH=/Shared/infraops-ai-eval
EVAL_BACKEND=mlflow   # mlflow | heuristic — fallback flag, see Section 7
```

4. This work is Python-native (MLflow's SDK ergonomics are Python-first). Add a new
   service rather than fighting Node/TypeScript interop — see Section 3.

---

## 3. New component: `apps/eval-service` (Python)

Add a small, focused Python service — not a rewrite of the worker, a sidecar next
to it.

```text
apps/
├── web/
├── api/
├── worker/
└── eval-service/            # NEW
    ├── pyproject.toml
    ├── src/
    │   ├── main.py           # FastAPI app, internal-only (not public-facing)
    │   ├── tracing.py        # logs agent_run data as MLflow traces
    │   ├── judges/
    │   │   ├── builtin.py    # wraps Correctness, RelevanceToQuery, Safety, Groundedness
    │   │   └── custom.py     # domain-specific judges, see Section 5
    │   └── harness.py        # runs the fixed 15-question eval set on demand
    └── tests/
```

Dependencies: `mlflow[databricks]>=3.1`, `fastapi`, `uvicorn`.

This service exposes two internal endpoints consumed only by `apps/worker`:

| Method | Path | Purpose |
|---|---|---|
| POST | `/trace` | Accepts a completed `agent_run` payload, logs it as an MLflow trace, returns `mlflow_run_id` |
| POST | `/evaluate/:mlflowRunId` | Runs built-in + custom judges against a logged trace, returns scores |
| POST | `/harness/run` | Runs the fixed 15-question eval set end-to-end, returns a scorecard |

`apps/worker`'s existing `evaluate_response` job (already in the original spec's
Section 12 queue list) now calls this service instead of the old heuristic function.
Do not remove the HTTP boundary — keeping evaluation as its own service is what
makes this swappable later if evaluation needs change again.

---

## 4. Data model changes

Extend the existing `evaluations` table (Section 7 of the original spec) — do not
create a parallel table:

```sql
ALTER TABLE evaluations
  ADD COLUMN mlflow_run_id text,
  ADD COLUMN eval_backend text NOT NULL DEFAULT 'heuristic',
  ADD COLUMN judge_scores jsonb;
```

`judge_scores` stores the raw per-judge output, e.g.:

```json
{
  "correctness": { "score": "yes", "rationale": "..." },
  "relevance_to_query": { "score": "yes", "rationale": "..." },
  "safety": { "score": "yes", "rationale": "..." },
  "groundedness": { "score": 0.92, "rationale": "..." },
  "contract_clause_fidelity": { "score": "pass", "rationale": "..." }
}
```

The existing top-level columns (`groundedness`, `citation_accuracy`,
`hallucination_flag`, `relevance`, `user_rating`) remain and are now populated
**from** `judge_scores` when `eval_backend = 'mlflow'`, so the admin dashboard and
any existing queries against those columns keep working unmodified.

---

## 5. Judges to implement

**Built-in judges (wire up all four):**

```python
from mlflow.genai.scorers import Correctness, RelevanceToQuery, Safety, Guidelines

scorers = [
    Correctness(),
    RelevanceToQuery(),
    Safety(),
    Guidelines(name="groundedness", guidelines=(
        "The response must only assert claims that are directly supported by "
        "the retrieved document chunks in the trace. Flag any claim not "
        "traceable to a specific chunk."
    )),
]
```

**Custom domain judge — implement at least this one** (trace-based, using the
seed dataset's document types from the original spec's Section 2):

```python
from mlflow.genai.judges import make_judge
from typing import Literal

contract_fidelity_judge = make_judge(
    name="contract_clause_fidelity",
    instructions=(
        "Analyze the {{ trace }} for a contract analysis agent response. "
        "Verify that every clause, obligation, or risk flag mentioned in the "
        "{{ outputs }} is actually present in the source document chunks "
        "retrieved in the trace. Penalize any invented clause or obligation "
        "not found in the retrieved context."
    ),
    feedback_value_type=Literal["pass", "fail"],
    model="databricks:/databricks-gpt-5-mini",
)
```

Add a second custom judge for the IoT anomaly agent if time allows — same pattern,
checking that anomaly explanations reference actual reading values from the trace
rather than generic boilerplate.

---

## 6. Tracing integration

Every agent run in `apps/api`'s agent orchestrator already produces the data needed
for a trace (input, tool calls, retrieved chunks, output — see the original spec's
Section 9). When an agent run completes:

1. `apps/api` writes the `agent_run` row as it already does (unchanged).
2. `apps/api` enqueues the existing `evaluate_response` BullMQ job (unchanged).
3. The job handler in `apps/worker` calls `eval-service`'s `/trace` endpoint with the
   full run payload.
4. `eval-service` logs it via MLflow tracing (`mlflow.start_span` / autolog if using
   a supported framework wrapper, otherwise manual span construction from the
   payload) and returns `mlflow_run_id`.
5. The worker immediately calls `/evaluate/:mlflowRunId`.
6. The worker writes the returned scores back into the `evaluations` row from
   Section 4, including the derived top-level columns.

---

## 7. Feature flag / fallback

Respect `EVAL_BACKEND` from `.env`:

- `EVAL_BACKEND=mlflow` (default going forward): use the flow in Section 6
- `EVAL_BACKEND=heuristic`: keep calling the original heuristic scorer, unchanged,
  writing `eval_backend='heuristic'` on the row

Do not delete the heuristic scorer. This mirrors the existing `RETRIEVAL_BACKEND`
pattern from the original spec (Section 8) — both flags exist so the system can
demonstrate either path and so a Databricks outage doesn't take down evaluation
entirely.

---

## 8. The eval harness command

`npm run eval` currently runs the fixed 15-question set through the heuristic
scorer. Update it to:

1. Run all 15 questions through the live RAG/agent pipeline as before
2. For each, call `eval-service`'s `/harness/run` (or reuse `/trace` +
   `/evaluate/:id` per question)
3. Aggregate into the same scorecard shape as before — pass/fail against explicit
   thresholds — so anything already consuming this output doesn't break
4. Print a summary table to stdout AND write a JSON artifact to
   `apps/eval-service/harness-results/<timestamp>.json` for historical comparison
   across runs

---

## 9. Admin dashboard

The existing Evaluation Summary page/endpoint (`GET /evaluations/summary`) should
now show, per metric, which backend produced it (`heuristic` vs `mlflow`) and link
out to the MLflow run when `mlflow_run_id` is present. Don't hide the distinction —
being able to show "here's the old heuristic scorer's output next to the calibrated
judge's output on the same question" is a genuinely good artifact, not something to
paper over.

---

## 10. Documentation

Rewrite `docs/evaluation.md` to describe:
- Why MLflow was chosen for this layer specifically (Section 1's reasoning, in your
  own words)
- The four built-in judges and what each measures
- The custom judge(s) and their instructions, verbatim
- The feature-flag fallback and why it exists
- A sample scorecard from an actual harness run (not a mocked example)

---

## 11. Success checklist

- [ ] `apps/eval-service` exists, boots independently, and passes its own test suite
- [ ] `evaluations` table has the three new columns, migration applied
- [ ] All four built-in judges score real traces from real agent runs
- [ ] At least one custom judge (`contract_clause_fidelity` at minimum) is live
- [ ] `EVAL_BACKEND=heuristic` still works end-to-end as a fallback
- [ ] `npm run eval` produces a real scorecard sourced from MLflow, with a saved
      JSON artifact per run
- [ ] Admin dashboard shows backend provenance per evaluation
- [ ] `docs/evaluation.md` reflects the actual system
- [ ] No changes were made to agent orchestration, retrieval, or the queue
      architecture outside of what's described here
