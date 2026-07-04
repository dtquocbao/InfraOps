"""InfraOps eval-service — internal MLflow evaluation sidecar."""

from __future__ import annotations

from typing import Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from harness import run_harness
from judges.builtin import derive_top_level, run_builtin_judges
from judges.custom import run_custom_judges
from tracing import get_cached_trace, log_agent_trace

app = FastAPI(title="InfraOps Eval Service", version="0.6.0")


class TraceRequest(BaseModel):
    agentRunId: str | None = None
    agent_run_id: str | None = None
    question: str
    answer: str
    chunks: list[dict[str, Any]] = Field(default_factory=list)
    citations: list[dict[str, Any]] = Field(default_factory=list)
    toolCalls: list[dict[str, Any]] = Field(default_factory=list)
    latencyMs: float | None = None
    agentType: str = "rag"
    traceId: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class HarnessRequest(BaseModel):
    items: list[dict[str, Any]]
    minPassRate: float = 0.6


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "infraops-eval-service"}


@app.post("/trace")
def create_trace(body: TraceRequest) -> dict[str, str]:
    payload = body.model_dump()
    payload["agentRunId"] = body.agentRunId or body.agent_run_id
    run_id = log_agent_trace(payload)
    return {"mlflow_run_id": run_id, "mlflowRunId": run_id}


@app.post("/evaluate/{mlflow_run_id}")
def evaluate_trace(mlflow_run_id: str) -> dict[str, Any]:
    trace = get_cached_trace(mlflow_run_id)
    if not trace:
        raise HTTPException(status_code=404, detail=f"Trace not found: {mlflow_run_id}")

    judges = {**run_builtin_judges(trace), **run_custom_judges(trace)}
    # Strip internal keys from stored judge_scores but keep for derive
    public_judges = {k: v for k, v in judges.items() if not k.startswith("_")}
    top = derive_top_level(judges)

    return {
        "mlflowRunId": mlflow_run_id,
        "evalBackend": "mlflow",
        "judgeScores": public_judges,
        "groundedness": top["groundedness"],
        "citationAccuracy": top["citationAccuracy"],
        "relevance": top["relevance"],
        "hallucinationFlag": top["hallucinationFlag"],
        "judgeSource": judges.get("_source", "unknown"),
    }


@app.post("/harness/run")
def harness_run(body: HarnessRequest) -> dict[str, Any]:
    return run_harness(body.items, min_pass_rate=body.minPassRate)
