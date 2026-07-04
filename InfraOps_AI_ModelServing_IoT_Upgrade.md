# InfraOps AI — Model Serving IoT Anomaly Upgrade

## Coding Agent Instructions

This document is a second addendum to `InfraOps_AI_Agent_Build_Instructions.Rmd`,
alongside `InfraOps_AI_MLflow_Eval_Upgrade.md`. It upgrades one subsystem: the IoT
anomaly detection path described in the original spec's Sections 10 and 13. It does
not change agent orchestration, RAG, or evaluation.

---

## 0. Objective & scope

Replace LLM-based anomaly detection in the `analyze_iot` tool with a small,
purpose-built classifier hosted on Databricks Model Serving, configured for
real-time, low-latency scoring. The LLM's role narrows to **explaining** a flagged
anomaly in natural language — it no longer does the detection itself.

**Do not** route the high-frequency IoT event stream through a full LLM call for
scoring. That's the anti-pattern this upgrade removes.

**Definition of Done:**
- A trained classifier scores anomaly likelihood for incoming IoT events
- It's deployed to a Model Serving endpoint configured for low latency (no
  scale-to-zero, provisioned concurrency floor)
- `analyze_iot` calls this endpoint for the score, then calls the LLM only when a
  score crosses the alert threshold, to generate a human-readable explanation
- A feature flag allows falling back to the original heuristic threshold rule if
  the endpoint is unavailable or not deployed
- `docs/architecture.md` and a new `docs/iot-anomaly-model.md` describe the actual
  system

---

## 1. Why (context for the agent, not user-facing)

Model Serving is built for real-time, low-latency inference — Databricks publishes
support for 25K+ QPS with under 50ms of overhead latency, but only when the
endpoint is kept warm. Routing every sensor event through a full LLM call is both
slower and unnecessarily expensive for what is fundamentally a narrow classification
task. The correct pattern is: small model for high-frequency scoring, LLM reserved
for the low-frequency, high-value task of explaining a flagged event in context.
This is a "build a small custom model, buy the serving infrastructure" decision —
training and feature logic stay custom, hosting and autoscaling come from the
platform.

---

## 2. Prerequisites

1. Databricks workspace already exists per the original spec's Section 8.
2. **Cost note, read before deploying anything:** a Model Serving endpoint
   configured for low latency (`scale_to_zero_enabled: false`, with a provisioned
   concurrency floor) is always-on, billed compute — not covered by Free Edition's
   serverless/quota-limited scope. Do not leave such an endpoint running
   continuously for a portfolio project. Two acceptable paths:
   - **(a) Design-and-document only:** implement everything through Section 6,
     write the deployment config, but keep `scale_to_zero_enabled: true` (or don't
     deploy at all) for day-to-day cost safety. Document the production config as
     what *would* be used.
   - **(b) Time-boxed live demo:** deploy with the low-latency config only during
     an active demo window (e.g., a Premium trial), then tear down or revert to
     scale-to-zero afterward.
   Default to (a) unless told otherwise. Never leave a provisioned, no-scale-to-zero
   endpoint running unattended.
3. Add to `.env` / `.env.example`:

```bash
IOT_SCORING_BACKEND=heuristic   # heuristic | model_serving — see Section 7
IOT_MODEL_ENDPOINT_URL=
IOT_MODEL_ENDPOINT_TOKEN=
```

---

## 3. Training the classifier

Use the existing `seed/iot/` data and simulator (original spec Section 13).

1. Feature engineering from the `iot_events.reading` payload: per device type,
   compute rolling features over a short window (e.g., last 5 readings) —
   mean, std deviation, rate of change, and deviation from the device's own
   historical baseline. Keep this simple; the point is a fast, explainable model,
   not state-of-the-art anomaly detection.
2. Model choice: a gradient-boosted tree (XGBoost) or isolation forest
   (scikit-learn) trained on the simulator's labeled anomaly injections
   (`seed/iot/simulate.ts` already injects known anomalies — use those as labels).
3. Log the trained model with MLflow (`mlflow.sklearn.log_model` or
   `mlflow.xgboost.log_model`), register it in Unity Catalog.
4. Keep training code in `databricks/notebooks/05_train_iot_anomaly_model.py`.

---

## 4. Deploying to Model Serving

```python
from databricks.sdk import WorkspaceClient
from databricks.sdk.service.serving import EndpointCoreConfigInput, ServedEntityInput

w = WorkspaceClient()
w.serving_endpoints.create(
    name="infraops-iot-anomaly",
    config=EndpointCoreConfigInput(
        served_entities=[
            ServedEntityInput(
                entity_name="infraops.gold.iot_anomaly_model",
                entity_version="1",
                workload_size="Small",
                scale_to_zero_enabled=False,   # per Section 2 cost note — dev default True
                min_provisioned_concurrency=1,
                max_provisioned_concurrency=4,
            )
        ]
    ),
)
```

Document both configurations (dev/cost-safe vs. demo/low-latency) side by side in
`docs/iot-anomaly-model.md` — don't just show the production one.

---

## 5. Integration with `analyze_iot`

Update the existing tool (original spec Section 10) to a two-step flow:

```text
IoT event → feature extraction → Model Serving endpoint (score) →
  if score < threshold: no action, log score
  if score >= threshold: call LLM with the event + score + context →
    generate human-readable explanation → create_review (if severity high) → alert
```

```ts
async function analyzeIot(deviceId: string, windowMinutes: number): Promise<IotAnalysis> {
  const features = extractFeatures(deviceId, windowMinutes);
  const score = await scoreAnomaly(features); // calls Model Serving or heuristic, per flag
  if (score < ANOMALY_THRESHOLD) {
    return { deviceId, score, flagged: false };
  }
  const explanation = await llmExplainAnomaly(deviceId, features, score); // LLM call, low frequency
  return { deviceId, score, flagged: true, explanation };
}
```

`scoreAnomaly` respects `IOT_SCORING_BACKEND`:
- `model_serving`: calls `IOT_MODEL_ENDPOINT_URL` with the feature vector
- `heuristic`: falls back to the original simple threshold rule from the base spec

---

## 6. Data model

Extend `iot_events` (original spec Section 7) — no new table needed:

```sql
ALTER TABLE iot_events
  ADD COLUMN scoring_backend text NOT NULL DEFAULT 'heuristic',
  ADD COLUMN model_version text;
```

`anomaly_score` (already present) is populated by whichever backend scored the
event; `scoring_backend` and `model_version` make it clear which one did, which
matters for the demo narrative (Section 8).

---

## 7. Feature flag behavior

Same pattern as `RETRIEVAL_BACKEND` and `EVAL_BACKEND` from the other two specs —
consistent, not incidental. The system should be able to run entirely on the
heuristic path with zero Databricks dependency, and switch to `model_serving` when
the endpoint is deployed, without any code change beyond the env var.

---

## 8. Documentation

`docs/iot-anomaly-model.md` should cover:
- The feature engineering approach and why it's simple by design
- The model choice and training data (from the simulator's labeled anomalies)
- Both endpoint configurations (cost-safe dev vs. low-latency demo) with the actual
  YAML/Python config for each
- The two-step scoring → explanation flow, and why the LLM is reserved for
  explanation rather than detection
- Measured latency from an actual test run (even a handful of sample requests
  timed locally against the deployed endpoint) — real numbers, not the platform's
  published ceiling

Update `docs/architecture.md`'s IoT section to reflect the two-step flow.

---

## 9. Success checklist

- [ ] Classifier trained on simulator data, logged to MLflow, registered in Unity
      Catalog
- [ ] Model Serving endpoint deployed with both configs documented; **not** left
      running in the costly configuration unattended
- [ ] `analyze_iot` calls the model for scoring and the LLM only for explanation
      of flagged events
- [ ] `IOT_SCORING_BACKEND=heuristic` still works end-to-end with zero Databricks
      dependency
- [ ] `iot_events` records which backend and model version scored each event
- [ ] `docs/iot-anomaly-model.md` includes real measured latency, not just the
      platform's published numbers
- [ ] No changes made to agent orchestration, RAG, or the MLflow evaluation
      subsystem outside of what's described here
