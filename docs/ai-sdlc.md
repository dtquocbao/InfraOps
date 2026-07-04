# AI SDLC - Living Status (Phase 5)

Lifecycle: **Discover → Design → Prototype → Evaluate → Pilot → Production → Monitor → Improve**

## Component maturity (as-built)

| Component | Stage | Evidence |
|-----------|-------|----------|
| Platform foundation | **Production** (demo) | Docker one-command boot, CI green |
| RAG Assistant | **Pilot** | 15 seed docs, cited answers, eval harness |
| Document pipeline | **Pilot** | Upload + seed + pgvector indexing |
| Human Review | **Pilot** | Rules table, approve/reject, audit trail |
| Evaluation harness | **Evaluate** | 15-question scorecard, MLflow optional |
| IoT monitoring | **Pilot** | Simulator, heuristic / Model Serving scoring, LLM explain on flags |
| Databricks pipeline | **Evaluate** | Notebooks + adapter; requires user workspace |
| Databricks retrieval | **Pilot** | Feature flag `RETRIEVAL_BACKEND=databricks` |
| Contract Agent | **Discover** | API stub; tool signatures in spec |
| Project Agent | **Discover** | API stub; Gold KPIs in notebooks |
| Observability | **Prototype** | Pino logs, health, admin metrics |
| Identity (Entra ID) | **Discover** | Stretch goal documented |

## Phase outcomes

| Phase | SDLC shift |
|-------|------------|
| 1 | Design → **Prototype** (runnable shell) |
| 2 | Prototype → **Evaluate** (RAG with metrics path) |
| 3 | Evaluate → **Pilot** (HITL + IoT + scorecard) |
| 4 | Pilot → **Pilot+** (Databricks governed retrieval) |
| 5 | **Production-ready demo** - stranger can run in 15 min |

## Monitoring & improvement loop

```
Agent run → async evaluation → Executive Dashboard
         → review trigger   → Human Review → user_rating feedback
         → npm run eval     → MLflow experiment (optional)
```

## Next improvements (stretch goals)

- MCP server exposing agent tools
- Azure Entra ID SSO
- Multi-agent collaboration
- Full Unity Catalog RBAC demo (Premium trial)
