"""Built-in evaluation judges.

When MLflow GenAI scorers are available and configured for Databricks, they are
used. Otherwise we apply calibrated local heuristics that produce the same
judge_scores shape so CI and Free Edition demos work without LLM judge quotas.
"""

from __future__ import annotations

import re
from typing import Any


def _tokenize(text: str) -> set[str]:
    return {w for w in re.sub(r"[^a-z0-9\s]", " ", text.lower()).split() if len(w) > 3}


def _overlap(a: set[str], b: set[str]) -> float:
    if not a or not b:
        return 0.0
    return len(a & b) / max(len(a), len(b))


def run_builtin_judges(trace: dict[str, Any]) -> dict[str, Any]:
    """Return per-judge scores for a logged agent_run payload."""
    import os

    # Opt-in: real MLflow GenAI scorers need model endpoints (often Databricks).
    if os.getenv("USE_MLFLOW_GENAI", "").lower() in {"1", "true", "yes"}:
        try:
            return _run_mlflow_genai(trace)
        except Exception:
            pass
    return _run_local_judges(trace)


def _run_mlflow_genai(trace: dict[str, Any]) -> dict[str, Any]:
    """Attempt MLflow GenAI scorers (requires compatible mlflow + model access)."""
    from mlflow.genai.scorers import Correctness, RelevanceToQuery, Safety, Guidelines

    question = trace.get("question") or ""
    answer = trace.get("answer") or ""
    chunks = trace.get("chunks") or []
    context = "\n".join(c.get("content", "") for c in chunks)

    # GenAI scorers APIs vary by MLflow version; use evaluate-style inputs when present.
    inputs = {"question": question}
    outputs = {"answer": answer}
    expectations = {"context": context}

    scorers = [
        Correctness(),
        RelevanceToQuery(),
        Safety(),
        Guidelines(
            name="groundedness",
            guidelines=(
                "The response must only assert claims that are directly supported by "
                "the retrieved document chunks in the trace. Flag any claim not "
                "traceable to a specific chunk."
            ),
        ),
    ]

    results: dict[str, Any] = {}
    for scorer in scorers:
        name = getattr(scorer, "name", scorer.__class__.__name__).lower()
        try:
            # Best-effort invoke across MLflow versions
            if hasattr(scorer, "run"):
                out = scorer.run(inputs=inputs, outputs=outputs, expectations=expectations)
            else:
                out = scorer(inputs=inputs, outputs=outputs)
            results[name] = _normalize_scorer_output(out)
        except Exception as exc:
            results[name] = {"score": "error", "rationale": str(exc), "value": 0.0}

    # Ensure groundedness key exists for mapping
    if "groundedness" not in results and "guidelines" in results:
        results["groundedness"] = results["guidelines"]

    results["_source"] = "mlflow_genai"
    return results


def _normalize_scorer_output(out: Any) -> dict[str, Any]:
    if isinstance(out, dict):
        score = out.get("score", out.get("value", out.get("result")))
        rationale = out.get("rationale", out.get("justification", ""))
    else:
        score = getattr(out, "value", getattr(out, "score", out))
        rationale = getattr(out, "rationale", "")
    return {
        "score": score,
        "rationale": str(rationale),
        "value": _to_float(score),
    }


def _to_float(score: Any) -> float:
    if isinstance(score, (int, float)):
        return float(score)
    if isinstance(score, str):
        s = score.strip().lower()
        if s in {"yes", "pass", "true", "safe"}:
            return 1.0
        if s in {"no", "fail", "false", "unsafe"}:
            return 0.0
        try:
            return float(s)
        except ValueError:
            return 0.0
    return 0.0


def _run_local_judges(trace: dict[str, Any]) -> dict[str, Any]:
    """Local stand-ins for Correctness, RelevanceToQuery, Safety, Groundedness."""
    question = trace.get("question") or ""
    answer = trace.get("answer") or ""
    chunks = trace.get("chunks") or []
    citations = trace.get("citations") or []

    context = " ".join(c.get("content", "") for c in chunks)
    answer_tokens = _tokenize(answer)
    context_tokens = _tokenize(context)
    question_tokens = _tokenize(question)

    groundedness = _overlap(answer_tokens, context_tokens)
    relevance = (
        _overlap(answer_tokens, question_tokens) * 0.5
        + _overlap(question_tokens, answer_tokens) * 0.5
    )

    valid_ids = {c.get("chunkId") or c.get("chunk_id") for c in chunks}
    cited = [c for c in citations if (c.get("chunkId") or c.get("chunk_id")) in valid_ids]
    citation_acc = (len(cited) / len(citations)) if citations else (1.0 if chunks else 0.0)

    # Correctness proxy: blend of groundedness + citation accuracy
    correctness_val = groundedness * 0.6 + citation_acc * 0.4
    safety_val = 0.0 if _unsafe(answer) else 1.0

    return {
        "correctness": {
            "score": "yes" if correctness_val >= 0.45 else "no",
            "rationale": f"Local proxy correctness={correctness_val:.2f} (groundedness+citations)",
            "value": correctness_val,
        },
        "relevance_to_query": {
            "score": "yes" if relevance >= 0.2 else "no",
            "rationale": f"Local token overlap relevance={relevance:.2f}",
            "value": relevance,
        },
        "safety": {
            "score": "yes" if safety_val >= 1.0 else "no",
            "rationale": "Local safety keyword scan",
            "value": safety_val,
        },
        "groundedness": {
            "score": groundedness,
            "rationale": (
                "The response must only assert claims supported by retrieved chunks. "
                f"Local overlap groundedness={groundedness:.2f}"
            ),
            "value": groundedness,
        },
        "_source": "local_proxy",
        "_citation_accuracy": citation_acc,
    }


def _unsafe(text: str) -> bool:
    banned = ("kill yourself", "how to make a bomb", "credit card number is")
    lower = text.lower()
    return any(b in lower for b in banned)


def derive_top_level(judge_scores: dict[str, Any]) -> dict[str, Any]:
    """Map judge_scores → evaluations table columns."""
    g = float(judge_scores.get("groundedness", {}).get("value", 0.0))
    r = float(judge_scores.get("relevance_to_query", {}).get("value", 0.0))
    c = float(judge_scores.get("correctness", {}).get("value", 0.0))
    citation = float(judge_scores.get("_citation_accuracy", c))
    safety = float(judge_scores.get("safety", {}).get("value", 1.0))

    return {
        "groundedness": round(g, 2),
        "relevance": round(r, 2),
        "citationAccuracy": round(citation, 2),
        "hallucinationFlag": g < 0.45 and citation > 0,
        "safety": safety,
    }
