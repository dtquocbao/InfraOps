# Changelog

## [0.5.0] - 2026-07-02 - Phase 5 Polish & Narrative

### Added
- Executive dashboard API (`GET /api/dashboard/executive`) with live KPI aggregation
- Enhanced Executive Dashboard UI with Recharts (eval metrics, doc types, recent runs, IoT alerts)
- `ExecutiveSummary` TypeScript types in web client
- `docs/SUCCESS_CHECKLIST.md` - Section 23 success criteria
- `docs/screenshots/README.md` - portfolio screenshot capture guide
- `docs/eval-results/` - scorecard output directory

### Changed
- `docs/architecture.md` - rewritten with as-built mermaid diagrams and build vs buy table
- `README.md` - full 15-minute onboarding guide with demo walkthrough and troubleshooting
- `docs/evaluation.md` - sample scorecard format and reproduction instructions
- `docs/ai-sdlc.md` - Phase 5 component maturity status

## [0.4.0] - 2026-07-02 - Phase 4 Databricks Integration

### Added
- Databricks medallion pipeline notebooks (Bronze → Silver → Gold → Vector Search)
- Unity Catalog setup SQL for `infraops.bronze/silver/gold`
- `DatabricksVectorRetriever` with Vector Search API and Gold SQL fallback
- `createRetriever()` factory - `RETRIEVAL_BACKEND=pgvector|databricks` feature flag
- MLflow experiment tracking in eval harness (`infraops-rag-eval`)
- Env vars: `DATABRICKS_VECTOR_INDEX`, `DATABRICKS_WAREHOUSE_ID`, `MLFLOW_TRACKING_URI`
- Health endpoint reports active retrieval backend
- `databricks/README.md` setup guide

## [0.3.0] - 2026-07-02 - Phase 3 Review, Evaluation & IoT

### Added
- Human-in-the-loop review workflow with configurable trigger rules table
- Review approve/reject API with audit logging and evaluation feedback
- Async evaluation worker (groundedness, citation accuracy, relevance, hallucination flag)
- `npm run eval` RAG scorecard harness with 15 test questions
- IoT device seed data, event ingestion, anomaly detection, and alerts
- `seed/iot/simulate.ts` streaming simulator with configurable anomaly rate
- Admin dashboard: audit log, BullMQ queue metrics, evaluation summary
- Human Review, IoT Monitor, and Admin web pages
- Executive dashboard populated with live system metrics
- `docs/evaluation.md` and `docs/governance.md`

## [0.2.0] - 2026-07-02 - Phase 2 Document RAG

### Added
- 15 synthetic seed documents with `manifest.json` metadata schema
- Document processing pipeline: parse → chunk → embed → pgvector index
- BullMQ worker for async upload processing; sync ingest via `db:seed`
- Hybrid retrieval (65% vector + 35% keyword FTS) with metadata and RBAC filters
- `POST /api/agents/rag/query` with structured citations and `agent_runs` logging
- `POST /api/documents/upload`, `GET /api/documents`, `GET /api/documents/:id`
- LLM adapters: Anthropic Claude, OpenAI, context-aware stub fallback
- OpenAI embedding adapter with hash-based dev fallback
- AI Assistant chat UI with citation preview panel
- Documents page with upload and processing status
- JWT auth guards on all protected endpoints
- `docs/rag.md` pipeline documentation
- Unit tests for document chunking

## [0.1.0] - 2026-07-02 - Phase 1 Foundation

### Added
- Monorepo with React web, NestJS API, BullMQ worker, shared packages
- PostgreSQL + pgvector schema (Prisma) covering full operational data model
- JWT authentication with 5 demo roles
- Docker Compose stack (postgres, redis, api, worker, web)
- GitHub Actions CI pipeline
- Executive dashboard shell with dark enterprise UI
- Health endpoint with database and Redis checks
- Build log and architecture documentation
