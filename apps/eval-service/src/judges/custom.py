"""Domain-specific custom judges."""

from __future__ import annotations

import re
from typing import Any


CONTRACT_KEYWORDS = (
    "liability",
    "indemnity",
    "warranty",
    "termination",
    "payment",
    "clause",
    "obligation",
    "cap",
    "change order",
    "markup",
)


def run_custom_judges(trace: dict[str, Any]) -> dict[str, Any]:
    scores: dict[str, Any] = {}
    scores["contract_clause_fidelity"] = contract_clause_fidelity(trace)
    scores["iot_explanation_fidelity"] = iot_explanation_fidelity(trace)
    return scores


def contract_clause_fidelity(trace: dict[str, Any]) -> dict[str, Any]:
    """
    Verify contract-related claims in the answer appear in retrieved chunks.

    Instructions (verbatim for docs):
    Analyze the trace for a contract analysis agent response. Verify that every
    clause, obligation, or risk flag mentioned in the outputs is actually present
    in the source document chunks retrieved in the trace. Penalize any invented
    clause or obligation not found in the retrieved context.
    """
    question = (trace.get("question") or "").lower()
    answer = trace.get("answer") or ""
    chunks = trace.get("chunks") or []
    context = " ".join(c.get("content", "") for c in chunks).lower()

    is_contractish = any(
        k in question or k in answer.lower()
        for k in ("contract", "liability", "clause", "indemnity", "payment", "warranty")
    )
    if not is_contractish:
        return {
            "score": "pass",
            "rationale": "Not a contract-domain question; judge not applicable.",
            "value": 1.0,
        }

    mentioned = [k for k in CONTRACT_KEYWORDS if k in answer.lower()]
    if not mentioned:
        return {
            "score": "pass",
            "rationale": "No specific contract clauses asserted in the answer.",
            "value": 1.0,
        }

    supported = [k for k in mentioned if k in context]
    ratio = len(supported) / len(mentioned)
    passed = ratio >= 0.6
    return {
        "score": "pass" if passed else "fail",
        "rationale": (
            "Verify every clause/obligation in the answer is present in retrieved chunks. "
            f"Supported {len(supported)}/{len(mentioned)} keywords: {supported}"
        ),
        "value": ratio,
    }


def iot_explanation_fidelity(trace: dict[str, Any]) -> dict[str, Any]:
    """Check IoT explanations reference numeric readings rather than pure boilerplate."""
    answer = trace.get("answer") or ""
    meta = trace.get("metadata") or {}
    reading = meta.get("reading") or {}

    if not reading and "anomaly" not in answer.lower() and "sensor" not in answer.lower():
        return {
            "score": "pass",
            "rationale": "Not an IoT explanation trace.",
            "value": 1.0,
        }

    numbers_in_answer = set(re.findall(r"\d+(?:\.\d+)?", answer))
    reading_nums = {str(int(v)) if float(v).is_integer() else str(v) for v in reading.values()}
    # Also accept truncated forms
    reading_nums |= {str(round(float(v), 1)) for v in reading.values()}

    if not reading:
        has_number = bool(numbers_in_answer)
        return {
            "score": "pass" if has_number else "fail",
            "rationale": "IoT explanation should cite concrete readings."
            if has_number
            else "Explanation lacks numeric readings.",
            "value": 1.0 if has_number else 0.0,
        }

    overlap = numbers_in_answer & reading_nums
    # Soft match: any reading value appears as substring in answer
    soft = any(str(v) in answer for v in reading.values())
    ok = bool(overlap) or soft
    return {
        "score": "pass" if ok else "fail",
        "rationale": (
            "Anomaly explanations must reference actual reading values from the event."
            if ok
            else f"No reading values from {reading} found in explanation."
        ),
        "value": 1.0 if ok else 0.0,
    }
