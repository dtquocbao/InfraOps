"""On-demand scorecard for a list of already-run RAG results."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from judges.builtin import derive_top_level, run_builtin_judges
from judges.custom import run_custom_judges
from tracing import log_agent_trace


def run_harness(items: list[dict[str, Any]], min_pass_rate: float = 0.6) -> dict[str, Any]:
    """
    items: [{ id, question, answer, chunks, citations, latencyMs }]
    """
    results = []
    for item in items:
        payload = {
            "agentRunId": item.get("id") or item.get("agentRunId"),
            "question": item.get("question"),
            "answer": item.get("answer"),
            "chunks": item.get("chunks") or [],
            "citations": item.get("citations") or [],
            "latencyMs": item.get("latencyMs"),
            "agentType": "rag",
        }
        run_id = log_agent_trace(payload)
        judges = {**run_builtin_judges(payload), **run_custom_judges(payload)}
        top = derive_top_level(judges)
        passed = top["groundedness"] >= 0.3 and top["citationAccuracy"] >= 0.5
        results.append(
            {
                "id": item.get("id"),
                "question": item.get("question"),
                "mlflowRunId": run_id,
                "pass": passed,
                **top,
                "judgeScores": {k: v for k, v in judges.items() if not k.startswith("_")},
                "latencyMs": item.get("latencyMs"),
            }
        )

    pass_count = sum(1 for r in results if r["pass"])
    n = len(results) or 1

    def avg(key: str) -> float:
        return sum(float(r[key]) for r in results) / n

    summary = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "evalBackend": "mlflow",
        "passCount": pass_count,
        "totalCount": len(results),
        "passRate": pass_count / n,
        "avgGroundedness": round(avg("groundedness"), 2),
        "avgCitationAccuracy": round(avg("citationAccuracy"), 2),
        "avgRelevance": round(avg("relevance"), 2),
        "hallucinationRate": sum(1 for r in results if r["hallucinationFlag"]) / n,
        "meetsThreshold": (pass_count / n) >= min_pass_rate,
        "results": results,
    }

    out_dir = Path(__file__).resolve().parents[1] / "harness-results"
    out_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    path = out_dir / f"{stamp}.json"
    path.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    summary["artifactPath"] = str(path)

    return summary
