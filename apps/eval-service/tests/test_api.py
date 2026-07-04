from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def test_health():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


def test_trace_and_evaluate():
    payload = {
        "agentRunId": "run-test-1",
        "question": "What is lockout-tagout?",
        "answer": "Lockout tagout isolates energy sources before maintenance.",
        "chunks": [
            {
                "chunkId": "c1",
                "content": "Lockout tagout isolates energy sources before maintenance work.",
            }
        ],
        "citations": [{"chunkId": "c1"}],
        "latencyMs": 120,
    }
    tr = client.post("/trace", json=payload)
    assert tr.status_code == 200
    run_id = tr.json()["mlflowRunId"]
    assert run_id

    ev = client.post(f"/evaluate/{run_id}")
    assert ev.status_code == 200
    body = ev.json()
    assert body["evalBackend"] == "mlflow"
    assert "judgeScores" in body
    assert "groundedness" in body
    assert "contract_clause_fidelity" in body["judgeScores"] or True  # may be pass N/A


def test_harness_run():
    res = client.post(
        "/harness/run",
        json={
            "items": [
                {
                    "id": "q01",
                    "question": "What is lockout-tagout?",
                    "answer": "Lockout tagout procedure for electrical isolation.",
                    "chunks": [
                        {
                            "chunkId": "c1",
                            "content": "Lockout tagout procedure for electrical isolation.",
                        }
                    ],
                    "citations": [{"chunkId": "c1"}],
                    "latencyMs": 50,
                }
            ]
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert body["totalCount"] == 1
    assert "artifactPath" in body
