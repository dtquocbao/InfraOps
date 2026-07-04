from judges.builtin import derive_top_level, run_builtin_judges
from judges.custom import contract_clause_fidelity, run_custom_judges


def test_local_judges_grounded_answer():
    trace = {
        "question": "What is the lockout-tagout procedure?",
        "answer": "Follow lockout tagout steps for electrical isolation and apply locks.",
        "chunks": [
            {
                "chunkId": "c1",
                "content": "Lockout tagout procedure requires electrical isolation and applying locks.",
            }
        ],
        "citations": [{"chunkId": "c1"}],
    }
    scores = run_builtin_judges(trace)
    assert "groundedness" in scores
    assert "correctness" in scores
    assert "relevance_to_query" in scores
    assert "safety" in scores
    top = derive_top_level(scores)
    assert top["groundedness"] > 0.2
    assert top["citationAccuracy"] == 1.0


def test_contract_clause_fidelity_pass():
    trace = {
        "question": "What liability cap applies under the contract?",
        "answer": "The liability cap is one million dollars per the indemnity clause.",
        "chunks": [
            {
                "chunkId": "c1",
                "content": "Liability cap and indemnity clause limit damages to one million dollars.",
            }
        ],
    }
    result = contract_clause_fidelity(trace)
    assert result["score"] == "pass"


def test_custom_judges_bundle():
    trace = {
        "question": "hello",
        "answer": "hi",
        "chunks": [],
    }
    scores = run_custom_judges(trace)
    assert "contract_clause_fidelity" in scores
    assert "iot_explanation_fidelity" in scores
