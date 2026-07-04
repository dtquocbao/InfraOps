# Train IoT anomaly classifier - InfraOps AI
#
# Trains a small IsolationForest on simulator-style labeled readings, logs to MLflow,
# and registers the model in Unity Catalog for optional Model Serving.
#
# Cost note: do NOT leave a provisioned (no scale-to-zero) endpoint running unattended.
# Default deploy config uses scale_to_zero_enabled=True (see docs/iot-anomaly-model.md).
#
# Run after notebooks 01–03 if you want training data in Gold; otherwise uses synthetic
# in-notebook samples matching seed/iot/simulate.ts.

# COMMAND ----------

dbutils.widgets.text("catalog", "infraops")
dbutils.widgets.text("model_name", "iot_anomaly_model")
CATALOG = dbutils.widgets.get("catalog")
MODEL_NAME = dbutils.widgets.get("model_name")
UC_MODEL = f"{CATALOG}.gold.{MODEL_NAME}"

spark.sql(f"USE CATALOG {CATALOG}")

# COMMAND ----------

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
import mlflow
import mlflow.sklearn

# Feature columns must match packages/ai-tools/src/iot/features.ts field order per device type.
# Training uses a unified feature set for transformer (primary demo device).

FIELD_ORDER = ["temperature_c", "load_pct", "vibration_hz"]


def make_features(readings):
    """Simple per-row features: value + baseline deviation (midpoint of normal range)."""
    baselines = {
        "temperature_c": (40, 75),
        "load_pct": (20, 90),
        "vibration_hz": (5, 18),
    }
    rows = []
    for r in readings:
        feats = {}
        for f in FIELD_ORDER:
            v = float(r[f])
            lo, hi = baselines[f]
            mid = (lo + hi) / 2
            span = hi - lo
            feats[f"{f}_value"] = v
            feats[f"{f}_mean"] = v
            feats[f"{f}_std"] = 0.0
            feats[f"{f}_roc"] = 0.0
            feats[f"{f}_baseline_dev"] = (v - mid) / span
        rows.append(feats)
    return pd.DataFrame(rows)


def normal_reading(anomaly: bool):
    if anomaly:
        return {
            "temperature_c": 95 + np.random.rand() * 10,
            "load_pct": 98,
            "vibration_hz": 28,
        }
    return {
        "temperature_c": 55 + np.random.rand() * 15,
        "load_pct": 60 + np.random.rand() * 25,
        "vibration_hz": 10 + np.random.rand() * 5,
    }


# Labeled simulator data (matches seed/iot/simulate.ts injection pattern)
n_normal, n_anom = 400, 80
readings = [normal_reading(False) for _ in range(n_normal)] + [
    normal_reading(True) for _ in range(n_anom)
]
labels = np.array([0] * n_normal + [1] * n_anom)  # 1 = anomaly

X = make_features(readings)
y = labels

# IsolationForest: contamination ≈ anomaly rate
pipe = Pipeline(
    [
        ("scaler", StandardScaler()),
        (
            "clf",
            IsolationForest(
                n_estimators=100,
                contamination=n_anom / (n_normal + n_anom),
                random_state=42,
            ),
        ),
    ]
)
pipe.fit(X.values)

# Map decision_function to [0,1] anomaly score (higher = more anomalous)
raw = -pipe.decision_function(X.values)
score_min, score_max = raw.min(), raw.max()
scores = (raw - score_min) / (score_max - score_min + 1e-9)

# Simple threshold accuracy on training set
pred = (scores >= 0.75).astype(int)
acc = (pred == y).mean()
print(f"Train threshold accuracy @0.75: {acc:.3f}")
print(f"Mean score normal={scores[y==0].mean():.3f} anomaly={scores[y==1].mean():.3f}")

# COMMAND ----------

# Wrap model so serving returns a single anomaly probability in [0,1]


class AnomalyScorer(mlflow.pyfunc.PythonModel):
    def __init__(self, pipeline, score_min, score_max):
        self.pipeline = pipeline
        self.score_min = float(score_min)
        self.score_max = float(score_max)

    def predict(self, context, model_input):
        import pandas as pd
        import numpy as np

        if isinstance(model_input, pd.DataFrame):
            arr = model_input.values
        else:
            arr = np.asarray(model_input)
        raw = -self.pipeline.decision_function(arr)
        scores = (raw - self.score_min) / (self.score_max - self.score_min + 1e-9)
        return np.clip(scores, 0, 1)


mlflow.set_registry_uri("databricks-uc")
mlflow.set_experiment("/Shared/infraops-iot-anomaly")

with mlflow.start_run(run_name="iot-isolation-forest") as run:
    mlflow.log_param("model_type", "IsolationForest")
    mlflow.log_param("n_normal", n_normal)
    mlflow.log_param("n_anomaly", n_anom)
    mlflow.log_metric("train_acc_at_0_75", float(acc))

    model = AnomalyScorer(pipe, score_min, score_max)
    mlflow.pyfunc.log_model(
        artifact_path="model",
        python_model=model,
        registered_model_name=UC_MODEL,
        input_example=X.head(2),
    )
    print(f"Logged run {run.info.run_id}")
    print(f"Registered model: {UC_MODEL}")

# COMMAND ----------

print(
    """
Next steps (optional — cost-aware):
1. Deploy with scale_to_zero_enabled=True for day-to-day (see databricks/serving/iot_anomaly_endpoint.py)
2. Set Admin → Settings:
     IOT_SCORING_BACKEND=model_serving
     IOT_MODEL_ENDPOINT_URL=https://<workspace>/serving-endpoints/infraops-iot-anomaly/invocations
     IOT_MODEL_ENDPOINT_TOKEN=<PAT>
     IOT_MODEL_VERSION=1
3. Tear down or revert to scale-to-zero after demos — never leave provisioned concurrency unattended.
"""
)
