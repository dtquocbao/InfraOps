# Success Checklist - InfraOps AI

Status after Phase 5 completion.

- [x] Full stack boots via `docker compose up --build`
- [x] RAG queries return grounded, cited answers from 15 seed documents
- [x] Human review approve/reject workflow with audit logging
- [x] `npm run eval` produces scorecard with 7 metrics (Section 16)
- [x] IoT simulator (`npm run iot:simulate`) triggers visible alerts
- [x] Databricks notebooks + retrieval adapter (`RETRIEVAL_BACKEND=databricks`)
- [x] `docs/architecture.md`, `docs/rag.md`, `docs/governance.md`, `docs/ai-sdlc.md`, `docs/evaluation.md` describe actual system
- [x] GitHub Actions CI: lint, typecheck, test, build
- [x] README 15-minute setup guide with demo walkthrough

## Verify locally

```bash
docker compose up --build
# → http://localhost:5173 - login, ask RAG question, check citations
npm run eval
npm run iot:simulate
```

## Optional Databricks verification

```bash
# After notebooks 01-04 (see databricks/README.md)
RETRIEVAL_BACKEND=databricks npm run eval
```
