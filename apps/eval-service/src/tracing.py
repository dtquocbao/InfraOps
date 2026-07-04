"""Log agent_run payloads as MLflow runs/traces."""

from __future__ import annotations

import json
import os
import tempfile
import time
from pathlib import Path
from typing import Any

import mlflow


def configure_mlflow() -> str:
    """Configure tracking URI and experiment; return experiment name."""
    tracking = os.getenv("MLFLOW_TRACKING_URI", "").strip()
    experiment = os.getenv("MLFLOW_EXPERIMENT_PATH", "/Shared/infraops-ai-eval")

    # Newer MLflow versions disable the file store unless opted in.
    os.environ.setdefault("MLFLOW_ALLOW_FILE_STORE", "true")

    if tracking:
        mlflow.set_tracking_uri(tracking)
        # Databricks auth via env: DATABRICKS_HOST, DATABRICKS_TOKEN
    else:
        local_dir = Path(tempfile.gettempdir()) / "infraops-mlflow"
        local_dir.mkdir(parents=True, exist_ok=True)
        # Prefer SQLite backend for local/CI (portable, no Databricks required)
        db_path = (local_dir / "mlflow.db").as_posix()
        mlflow.set_tracking_uri(f"sqlite:///{db_path}")

    try:
        mlflow.set_experiment(experiment)
    except Exception:
        # Local file store may not like leading slash paths
        fallback = experiment.strip("/").replace("/", "-") or "infraops-ai-eval"
        mlflow.set_experiment(fallback)
        experiment = fallback

    return experiment


def log_agent_trace(payload: dict[str, Any]) -> str:
    """
    Create an MLflow run representing one agent_run trace.
    Returns mlflow_run_id.
    """
    configure_mlflow()
    agent_run_id = payload.get("agentRunId") or payload.get("agent_run_id") or "unknown"
    run_name = f"agent-run-{agent_run_id}"

    with mlflow.start_run(run_name=run_name) as run:
        run_id = run.info.run_id

        mlflow.set_tags(
            {
                "agent_run_id": str(agent_run_id),
                "agent_type": str(payload.get("agentType") or payload.get("agent_type") or "rag"),
                "trace_id": str(payload.get("traceId") or payload.get("trace_id") or ""),
            }
        )

        mlflow.log_param("question", (payload.get("question") or "")[:250])
        mlflow.log_param("chunk_count", len(payload.get("chunks") or []))
        mlflow.log_param("citation_count", len(payload.get("citations") or []))
        if payload.get("latencyMs") is not None:
            mlflow.log_metric("latency_ms", float(payload["latencyMs"]))

        # Manual span-like artifact: full payload for judges
        artifact = {
            "question": payload.get("question"),
            "answer": payload.get("answer"),
            "chunks": payload.get("chunks") or [],
            "citations": payload.get("citations") or [],
            "toolCalls": payload.get("toolCalls") or payload.get("tool_calls") or [],
            "metadata": payload.get("metadata") or {},
            "logged_at": time.time(),
        }
        tmp = Path(tempfile.mkdtemp()) / "trace.json"
        tmp.write_text(json.dumps(artifact, default=str), encoding="utf-8")
        mlflow.log_artifact(str(tmp), artifact_path="trace")

        # Also store under run data for evaluate endpoint (in-process cache key = run_id)
        _TRACE_CACHE[run_id] = artifact

    return run_id


_TRACE_CACHE: dict[str, dict[str, Any]] = {}


def get_cached_trace(mlflow_run_id: str) -> dict[str, Any] | None:
    if mlflow_run_id in _TRACE_CACHE:
        return _TRACE_CACHE[mlflow_run_id]

    # Reload from artifact if process restarted
    try:
        configure_mlflow()
        client = mlflow.tracking.MlflowClient()
        arts = client.list_artifacts(mlflow_run_id, path="trace")
        for art in arts:
            if art.path.endswith("trace.json"):
                local = client.download_artifacts(mlflow_run_id, art.path)
                data = json.loads(Path(local).read_text(encoding="utf-8"))
                _TRACE_CACHE[mlflow_run_id] = data
                return data
    except Exception:
        return None
    return None
