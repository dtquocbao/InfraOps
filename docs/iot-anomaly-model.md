# IoT Anomaly Model — InfraOps AI

Two-step anomaly path: a **small classifier** scores every event; the **LLM explains** only when the score crosses the alert threshold.

This replaces the anti-pattern of routing the high-frequency IoT stream through a full LLM call for detection.

---

## Flow

```
IoT event
  → extractFeatures (rolling window: mean, std, rate-of-change, baseline deviation)
  → scoreAnomaly (heuristic | Model Serving)
  → if score < threshold: store event, no LLM
  → if score ≥ threshold: LLM explanation → audit alert → IoT Monitor UI
```

| Step | Frequency | Implementation |
|------|-----------|----------------|
| Feature extraction | Every event | `packages/ai-tools/src/iot/features.ts` |
| Scoring | Every event | Heuristic rules or Databricks Model Serving |
| Explanation | Flagged only | `createLlmAdapter` (Claude / OpenAI / stub) |

---

## Feature engineering (simple by design)

Per device field (e.g. `temperature_c`, `load_pct`, `vibration_hz` for transformers):

| Feature | Meaning |
|---------|---------|
| `*_value` | Current reading |
| `*_mean` | Mean over last ≤5 readings |
| `*_std` | Std deviation over window |
| `*_roc` | Rate of change vs previous sample |
| `*_baseline_dev` | Deviation from device baseline midpoint / span |

Baselines live in `IOT_BASELINES` (`packages/shared`). The model is intentionally small and explainable — not SOTA anomaly detection.

---

## Model choice & training data

| Item | Choice |
|------|--------|
| Algorithm | Isolation Forest (scikit-learn) in a StandardScaler pipeline |
| Labels | Simulator injections from `seed/iot/simulate.ts` (`--anomaly-rate`) |
| Training notebook | `databricks/notebooks/05_train_iot_anomaly_model.py` |
| Registry | Unity Catalog `infraops.gold.iot_anomaly_model` via MLflow |

Training generates normal vs injected-anomaly readings matching the simulator, fits IsolationForest, and logs a `pyfunc` wrapper that returns an anomaly score in `[0, 1]`.

---

## Feature flag

| Setting | Values | Behavior |
|---------|--------|----------|
| `IOT_SCORING_BACKEND` | `heuristic` (default) | Local baseline rules — **zero Databricks dependency** |
| | `model_serving` | POST feature vector to `IOT_MODEL_ENDPOINT_URL` |
| `IOT_MODEL_ENDPOINT_URL` | Serving invocations URL | Required for `model_serving` |
| `IOT_MODEL_ENDPOINT_TOKEN` | PAT / bearer | Falls back to `DATABRICKS_TOKEN` if empty |
| `IOT_MODEL_VERSION` | e.g. `1` | Stored on each `iot_events` row |

If Model Serving is selected but the endpoint is missing or errors, the worker **falls back to heuristic** and records `model_version=heuristic-fallback`.

Configure under **Admin → Settings → IoT Anomaly Scoring**.

---

## Endpoint configurations

Deploy script: `databricks/serving/iot_anomaly_endpoint.py`

### Dev / cost-safe (default)

```python
ServedEntityInput(
    entity_name="infraops.gold.iot_anomaly_model",
    entity_version="1",
    workload_size="Small",
    scale_to_zero_enabled=True,   # idle → no billable compute
)
```

```bash
python databricks/serving/iot_anomaly_endpoint.py --mode dev
```

### Demo / low-latency (time-boxed only)

```python
ServedEntityInput(
    entity_name="infraops.gold.iot_anomaly_model",
    entity_version="1",
    workload_size="Small",
    scale_to_zero_enabled=False,
    min_provisioned_concurrency=1,
    max_provisioned_concurrency=4,
)
```

```bash
python databricks/serving/iot_anomaly_endpoint.py --mode demo
# After demo:
python databricks/serving/iot_anomaly_endpoint.py --mode delete
# or --mode dev to revert to scale-to-zero
```

**Never leave the demo config running unattended** — provisioned concurrency is always-on billable compute and is not Free Edition–friendly.

---

## Data model

`iot_events` columns:

| Column | Purpose |
|--------|---------|
| `anomaly_score` | Score from whichever backend ran |
| `scoring_backend` | `heuristic` or `model_serving` |
| `model_version` | e.g. `heuristic-v1`, `1`, `heuristic-fallback` |
| `explanation` | LLM text when flagged (nullable) |

---

## Measured latency (local heuristic path)

Timed on developer workstation (Node, heuristic backend, no Model Serving):

| Path | Samples | p50 | Notes |
|------|---------|-----|-------|
| Feature extract + heuristic score | 100 | **&lt; 1 ms** | In-process, no network |
| + stub LLM explanation (flagged only) | 20 | **~2–5 ms** | Stub adapter; real Claude/OpenAI adds network RTT |

Model Serving latency is dominated by cold start when `scale_to_zero_enabled=true` (seconds on first request after idle). Warm invoke overhead on Databricks is typically tens of ms when provisioned; measure against your endpoint during a demo window and record here:

| Path | Samples | p50 | Environment |
|------|---------|-----|-------------|
| Model Serving invoke (warm) | — | *run during demo* | Premium / provisioned endpoint |
| Model Serving invoke (cold) | — | *run during demo* | scale-to-zero |

---

## Build vs buy

| Piece | Decision |
|-------|----------|
| Feature logic + training | **Build** (domain baselines, simulator labels) |
| Serving / autoscaling | **Buy** (Databricks Model Serving) |
| Natural-language explanation | **Buy** (Claude / OpenAI API), low frequency |

---

## Related

- [architecture.md](./architecture.md) — system context
- `databricks/notebooks/05_train_iot_anomaly_model.py`
- `databricks/serving/iot_anomaly_endpoint.py`
- `packages/ai-tools/src/iot/`
