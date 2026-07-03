---
title: "InfraOps AI Platform - Coding Agent Build Instructions"
subtitle: "Enterprise Agentic RAG + Databricks + Modern Software Architecture"
author: "Bao Dang"
date: "`r Sys.Date()`"
output:
  github_document:
    toc: true
    toc_depth: 3
---

# 0. Read This First - Agent Operating Instructions

You are building **InfraOps AI**, a portfolio-grade enterprise AI platform. This document is
your spec. Treat it as a contract, not a suggestion - follow the architecture, naming, and
phase order exactly unless a section explicitly says "your discretion."

**Operating rules:**

1. **Build in phases (Section 20), in order.** Do not start Phase 2 work until Phase 1's
   Definition of Done is met. After each phase, produce a short status report: what was
   built, what was skipped, what's broken, what's next.
2. **Every phase must end in a runnable state.** `docker compose up` (or documented
   equivalent) must start the stack without errors at the end of every phase, even if
   later-phase features are stubbed.
3. **Do not silently change the architecture.** If something in this spec is infeasible
   (e.g., a package is deprecated, a service doesn't support a feature), stop and report
   the conflict with a proposed alternative - do not substitute silently.
4. **Prefer real integrations over mocks once Phase 4 begins.** Mocked Databricks calls
   are acceptable in Phases 1–3 (behind an interface), but Phase 4 must connect to a real
   Databricks Free Edition workspace - see Section 8.
5. **Write as you go, not at the end**: unit tests for business logic, a short `docs/`
   entry for every new subsystem, and a CHANGELOG entry per phase.
6. **This is demo data, not real QISG data.** Use the synthetic dataset defined in Section
   2. Never fabricate or reference real QISG documents, employees, or internal systems.

---

# 1. Why This Project Exists (context for the agent)

This platform is a technical research piece built to demonstrate readiness of an internal
AI capability with this operating model, which this platform should visibly mirror:

| Their model | What this platform must demonstrate |
|---|---|
| **AI maturity levels 1–4** (self-service → standalone apps/MCP → integrated apps → complex enterprise programs) | The platform itself *is* a Level 3/4 example: integrated, governed, enterprise-data-backed AI application |
| **Databricks medallion architecture** (Bronze → Silver → Gold) governed by Unity Catalog | Real Bronze/Silver/Gold pipeline, not a diagram - see Section 8 |
| **Forward-deployed engineering pattern**: partner with a business unit, ship a production-grade custom solution | Each "agent" (RAG, Contract, Project, IoT) should read like a solution shipped for a specific business unit (engineering, legal, PM, field ops) |
| **Human-in-the-loop by default** for high-risk or irreversible outputs | Every generative output that could be published or acted on must route through a review state - see Section 14 |
| **Build vs. buy discipline** | Architecture doc must show where "buy" (off-the-shelf model APIs, managed vector search) was chosen over "build," and why |
| **AI evaluation as a first-class concern** | Real evaluation harness with groundedness/citation/hallucination metrics - see Section 16, not just a slide |
| **Production hardening**: CI/CD, observability, governance | Real GitHub Actions pipeline, real structured logging, real audit table - see Sections 12, 17, 18 |

**Domain framing:** build for a fictional energy-infrastructure EPC company called
**"Meridian Grid Services."** Do not use any real company's name, logo, or data.

---

# 2. Domain & Synthetic Seed Data

Create a `seed/` directory with fabricated but domain-realistic content. Do not scrape or
reproduce copyrighted material - write original synthetic content.

**Seed documents (`seed/documents/`), minimum 15 files:**
- 5 engineering documents (substation design notes, transmission line specs, material
  standards) - plain text or markdown, 300–800 words each, with realistic section
  headers, revision numbers, and approval status metadata
- 4 safety procedures / SOPs (lockout-tagout, arc flash protocol, confined space entry,
  incident reporting) with numbered steps
- 3 contracts/RFP excerpts (synthetic, with clauses on liability, payment terms, change
  orders) - invented company names only
- 3 project status reports (budget, schedule, risk register) with tabular data

**Seed metadata schema** (`seed/documents/manifest.json`): for each document -
`id, title, doc_type, project_id, discipline, revision, approval_status, department,
security_level, created_date`. This metadata is what Section 7's Silver layer normalizes
and what Section 9's retrieval filters on - do not skip it, it's the difference between a
toy RAG demo and an enterprise one.

**Seed IoT data (`seed/iot/`):** a generator script producing simulated sensor readings
for 4 device types (transformer, generator, temperature sensor, weather station) - see
Section 13 for schema.

---

# 3. High-Level Architecture

```text
                     Users
      Engineers | PM | Safety | Executive
                     │
                     ▼
              React Dashboard
                     │
             API Gateway (NestJS)
                     │
             Agent Orchestrator
      ┌─────────┬──────────┬──────────┬──────────┐
      │         │          │          │
      ▼         ▼          ▼          ▼
   RAG      Contract     Project      IoT
 Assistant   Agent        Agent      Agent
                     │
            Queue Processing Layer (BullMQ)
      ┌────────────┬─────────────┬─────────────┐
      │            │             │
Document      Embedding      IoT Processing
Processing      Jobs            Jobs
                     │
             Databricks Platform
     Bronze → Silver → Gold → Vector Search
        (governed by Unity Catalog)
                     │
          MLflow + Monitoring + Audit
```

**Architectural principles the agent must uphold throughout:**
- Retrieval only ever reads from **Gold-layer, governed data** - never index Bronze or
  Silver directly. This is a hard rule, not a preference.
- Every agent action that writes, publishes, or recommends a decision is logged with a
  trace ID that ties request → retrieval → generation → (optional) human review.
- No secrets in code. No client-side API keys. All LLM calls happen server-side.

---

# 4. Technology Stack & Version Pins

| Layer | Choice | Notes |
|---|---|---|
| Frontend | React 18 + TypeScript + Vite | TailwindCSS + shadcn/ui + Recharts + TanStack Query |
| Backend API | NestJS (Node 20 LTS) | Modular: `auth`, `documents`, `agents`, `review`, `iot` |
| Primary DB | PostgreSQL 16 | via Prisma or TypeORM (agent's choice, document which) |
| Cache/Queue broker | Redis 7 | |
| Job queue | BullMQ | |
| LLM provider | Claude (Anthropic API) as primary, OpenAI as fallback/comparison | Use an adapter interface - never call the SDK directly from business logic |
| Vector search | Databricks Vector Search (Phase 4) - **local fallback**: pgvector extension on Postgres for Phases 1–3 | This lets the app run fully local before Databricks is wired in |
| Data platform | Databricks Free Edition (see Section 8) | |
| Evaluation/experiment tracking | MLflow (Databricks-hosted in Phase 4; local MLflow server acceptable earlier) | |
| Observability | OpenTelemetry + structured JSON logs (pino) | |
| CI/CD | GitHub Actions | lint → typecheck → test → build on every PR |
| Containerization | Docker + docker-compose for local dev | |
| Auth (MVP) | Simple email/password + JWT, roles: `engineer, pm, safety, executive, admin` | Azure Entra ID is a documented stretch goal, not MVP - do not attempt SSO in Phase 1–4 |

---

# 5. Repository Structure

```text
infraops-ai/
├── apps/
│   ├── web/                    # React dashboard
│   ├── api/                    # NestJS gateway + agent orchestrator
│   └── worker/                 # BullMQ job processors
│
├── packages/
│   ├── shared/                 # shared types, zod schemas, constants
│   └── ai-tools/                # agent tool implementations, LLM adapter
│
├── databricks/
│   ├── notebooks/
│   │   ├── 01_bronze_ingest.py
│   │   ├── 02_silver_transform.py
│   │   ├── 03_gold_curate.py
│   │   └── 04_vector_index.py
│   └── unity_catalog/setup.sql
│
├── seed/
│   ├── documents/
│   └── iot/
│
├── docs/
│   ├── architecture.md
│   ├── rag.md
│   ├── governance.md
│   ├── ai-sdlc.md
│   └── evaluation.md
│
├── .github/workflows/ci.yml
├── docker-compose.yml
├── .env.example
└── README.md
```

---

# 6. Environment & Secrets (`.env.example`)

```bash
# LLM
ANTHROPIC_API_KEY=
OPENAI_API_KEY=

# Postgres
DATABASE_URL=postgresql://infraops:infraops@localhost:5432/infraops

# Redis
REDIS_URL=redis://localhost:6379

# Databricks (Phase 4+)
DATABRICKS_HOST=
DATABRICKS_TOKEN=
DATABRICKS_CATALOG=infraops
DATABRICKS_SCHEMA_BRONZE=bronze
DATABRICKS_SCHEMA_SILVER=silver
DATABRICKS_SCHEMA_GOLD=gold

# App
JWT_SECRET=
NODE_ENV=development
```

Agent: never commit `.env`. Validate required vars at startup and fail fast with a clear
error listing which are missing.

---

# 7. Data Model (Postgres - operational store, distinct from Databricks analytical store)

Minimum tables (write as Prisma/TypeORM models, this is the logical schema):

```sql
users(id, email, name, role, created_at)
projects(id, name, discipline, status, created_at)
documents(id, project_id, title, doc_type, revision, approval_status,
          department, security_level, storage_uri, created_at)
document_chunks(id, document_id, content, embedding vector(1536), metadata jsonb, chunk_index)
agent_runs(id, user_id, agent_type, input, output, tool_calls jsonb,
           citations jsonb, trace_id, latency_ms, token_count, cost_usd, created_at)
reviews(id, agent_run_id, reviewer_id, status, comments, decided_at)
iot_devices(id, project_id, device_type, name, location)
iot_events(id, device_id, reading jsonb, anomaly_score, created_at)
evaluations(id, agent_run_id, groundedness, citation_accuracy, hallucination_flag,
            relevance, user_rating, evaluated_at)
audit_log(id, user_id, action, resource_type, resource_id, metadata jsonb, created_at)
```

`document_chunks.embedding` uses `pgvector` for local dev; in Phase 4 retrieval switches
to Databricks Vector Search via the adapter interface (Section 9), but this table remains
as the operational cache/fallback.

---

# 8. Databricks Setup (Phase 4 - do not skip, this is the centerpiece)

1. **Sign up for Databricks Free Edition** at `databricks.com/learn/free-edition`
   (this replaced the old "Community Edition," which is retired - do not follow
   instructions referencing Community Edition). Free Edition is serverless-only and
   quota-limited but supports real Delta tables and governance concepts.
2. **Create catalog/schema structure** matching `.env`:
   `infraops.bronze`, `infraops.silver`, `infraops.gold`.
3. **Bronze layer** (`01_bronze_ingest.py`): load raw seed documents and IoT events
   as-is into Delta tables, immutable, with ingestion timestamp and source metadata.
   No cleaning here - that's the point of Bronze.
4. **Silver layer** (`02_silver_transform.py`): parse documents (chunking, OCR if
   needed), normalize IoT events, deduplicate, validate against the manifest schema
   from Section 2, and conform types.
5. **Gold layer** (`03_gold_curate.py`): business-ready tables -
   `gold.document_chunks` (chunk text + metadata, ready for embedding),
   `gold.project_kpis`, `gold.risk_scores`, `gold.iot_daily_rollup`.
6. **Vector index** (`04_vector_index.py`): build a Databricks Vector Search index on
   `gold.document_chunks`. If Free Edition quota blocks this, document the limitation
   and fall back to the pgvector path - do not silently skip.
7. **Document every notebook's purpose and schema in `docs/rag.md`.**
8. Wire the app's retrieval adapter (Section 9) to call Databricks Vector Search
   instead of pgvector once this is live, behind a feature flag
   (`RETRIEVAL_BACKEND=databricks|pgvector`) so both remain demonstrable.

---

# 9. Agentic RAG Pipeline

```text
Question → Intent Detection → Tool Selection → Retriever → Vector Search →
Relevant Chunks (with metadata filters: project, discipline, security_level) →
LLM (with retrieved context + system prompt) → Grounded Response with Citations →
[Human Review if flagged] → Logging (agent_runs + evaluations)
```

**Implementation requirements:**
- Retrieval must support **hybrid search** (keyword + vector) and **metadata filtering**,
  not vector-only similarity.
- Every response must carry structured citations (`document_id`, `chunk_id`, `title`,
  `revision`) - never return prose-only answers for document-grounded questions.
- The retrieval adapter must be swappable (pgvector ↔ Databricks) via one interface -
  see Section 8, point 8.
- Log every step's latency and token usage to `agent_runs`.

---

# 10. Agent Tools (implement as typed functions in `packages/ai-tools`)

```ts
search_project_documents(query: string, filters: {projectId?, discipline?, docType?}): ChunkResult[]
query_project_status(projectId: string): ProjectStatus
analyze_contract(documentId: string): ContractAnalysis   // clauses, risk flags, obligations
draft_rfi(context: string, projectId: string): RfiDraft
analyze_iot(deviceId: string, windowMinutes: number): IotAnalysis  // anomaly detection
create_review(agentRunId: string, reason: string): ReviewTicket
```

Each tool: typed input/output (zod schema in `packages/shared`), unit-tested independently
of the LLM, and callable directly via a `/tools/:name/test` debug endpoint in dev mode.

---

# 11. Backend API Contract (core endpoints - extend as needed, keep this shape)

| Method | Path | Purpose |
|---|---|---|
| POST | `/auth/login` | JWT auth |
| POST | `/documents/upload` | Upload → enqueue processing job |
| GET | `/documents/:id` | Document detail + processing status |
| POST | `/agents/rag/query` | Ask a question, returns grounded response + citations |
| POST | `/agents/contract/analyze` | Contract analysis agent |
| POST | `/agents/project/query` | Project status agent |
| GET | `/agents/runs/:id` | Full trace of an agent run |
| POST | `/reviews/:runId/decide` | Approve/reject/edit a pending review |
| GET | `/iot/devices/:id/events` | Recent IoT events + anomaly flags |
| GET | `/evaluations/summary` | Aggregate eval metrics for the dashboard |
| GET | `/admin/audit-log` | Audit trail (admin only) |

All endpoints: request/response validated with zod, documented via OpenAPI/Swagger
auto-generated from NestJS decorators.

---

# 12. Queue Jobs (BullMQ)

```text
upload_document → parse_document → chunk_document → generate_embedding →
create_vector_index_entry → ready
process_iot_event → detect_anomaly → (if anomaly) create_alert
evaluate_response  (async, runs after every agent_run)
```

Each job: idempotent, retried up to 3x with exponential backoff, dead-letter queue for
failures, and a `queue_metrics` view exposed on the admin dashboard.

---

# 13. IoT Simulation

**Devices:** transformer, generator, temperature sensor, weather station.

**Event schema:**
```json
{
  "device_id": "TXF-014",
  "device_type": "transformer",
  "reading": { "temperature_c": 68.2, "load_pct": 82, "vibration_hz": 12.1 },
  "timestamp": "2026-07-02T14:00:00Z"
}
```

Build a simulator script (`seed/iot/simulate.ts`) that streams synthetic events at a
configurable interval, injecting occasional anomalies (temperature spikes, load surges)
so the anomaly-detection path has something real to catch.

Flow: `IoT Event → Queue → Databricks Bronze → Silver → Gold → AI Agent → Alert → Dashboard`

---

# 14. Human-in-the-Loop Workflow

**Trigger conditions requiring review** (encode as a rules table, not hardcoded ifs):
contract summaries, safety recommendations, executive reports, RFI drafts, any response
with low retrieval confidence, any IoT anomaly alert above severity threshold.

**State machine:**
```text
draft → pending_review → approved → published
                        → rejected → (back to draft with reviewer comments)
```

Every transition writes to `reviews` and `audit_log`. The reviewer's decision and comments
must feed back into `evaluations` as a labeled data point - this is what makes the
feedback loop real instead of decorative.

---

# 15. Frontend Pages

1. **Executive Dashboard** - portfolio-level KPIs, AI adoption metrics, evaluation scores
2. **Projects** - list/detail, linked documents, status
3. **AI Assistant** - chat interface with citations, source preview panel
4. **Documents** - upload, processing status, metadata browser
5. **Human Review** - queue of pending reviews, approve/edit/reject UI
6. **IoT Monitor** - live device readings, anomaly alerts, simple charts
7. **Admin** - users, audit log, queue metrics, evaluation summary

Visual direction: "enterprise AI command center" - dark-mode-capable, data-dense but
clean, not consumer-chatbot styling. Reuse the design language from the QISG presentation
deck already built for this job search (dark charcoal + orange accent) if a cohesive
personal brand across portfolio artifacts is desired - agent's discretion, document the
choice either way.

---

# 16. AI Evaluation Framework

Implement real, not aspirational, scoring for every `agent_run`:

| Metric | Method |
|---|---|
| Groundedness | LLM-as-judge: does the response only assert what's in retrieved chunks? |
| Citation accuracy | Do cited chunk IDs actually support the claim? |
| Relevance | Does the response address the actual question? |
| Hallucination flag | Boolean, derived from groundedness below threshold |
| Retrieval hit rate | Did retrieval return at least one chunk above similarity threshold? |
| Latency / cost | Captured automatically per run |
| User rating | Thumbs up/down captured in UI, stored in `evaluations` |

Build a small eval harness (`apps/worker/eval/`) that runs a fixed set of ~15 test
questions against the RAG pipeline on demand (`npm run eval`) and outputs a scorecard -
this is the artifact to show in an interview, not just a metrics table.

---

# 17. Observability

Structured JSON logs (pino) for every request, tagged with `trace_id`. Capture: prompt
(redacted of secrets), token usage, retrieval results, queue job status, errors. Wire
OpenTelemetry spans across API → agent orchestrator → tool calls → queue jobs so a single
trace_id can be followed end-to-end. MLflow tracks experiment runs for the evaluation
harness specifically (Section 16).

---

# 18. Security & Governance (MVP scope - do not over-build)

- RBAC via the `role` field on `users`, enforced with NestJS guards per endpoint
- Document-level `security_level` respected in retrieval filters - a user should never
  receive citations from documents above their clearance
- `audit_log` for every write action and every review decision
- Document versioning implied by `revision` field on `documents`
- **Explicitly out of scope for MVP:** Azure Entra ID SSO, per-field encryption, formal
  compliance certifications - note these in `docs/governance.md` as roadmap items,
  do not attempt to build them now

---

# 19. AI SDLC (document, don't just diagram)

Maintain `docs/ai-sdlc.md` describing the actual lifecycle this repo follows:
`Discover → Design → Prototype → Evaluate → Pilot → Production → Monitor → Improve`.
Update it at the end of every phase in Section 20 with what stage each agent/feature is
actually at - this becomes a living project-management artifact, not a static diagram.

---

# 20. Build Order - Phases & Definition of Done

**Phase 1 - Foundation**
Build: React shell, NestJS API skeleton, Postgres + Prisma/TypeORM models, Redis + BullMQ
wired up, JWT auth, Docker Compose for local dev, CI pipeline (lint/typecheck/test/build).
*DoD: `docker compose up` boots all services; login works; empty dashboard renders.*

**Phase 2 - Document RAG (local, pgvector)**
Build: document upload → queue → parse → chunk → embed (pgvector) → RAG query endpoint →
chat UI with citations. Use seed documents from Section 2.
*DoD: uploading a seed doc and asking a grounded question returns a cited answer.*

**Phase 3 - Human Review + Evaluation + IoT simulation**
Build: review workflow end-to-end, evaluation harness (Section 16) runnable via `npm run
eval`, IoT simulator + anomaly detection + alert path, admin dashboard with queue/audit
visibility.
*DoD: a flagged agent output can be approved/rejected by a reviewer; `npm run eval`
produces a scorecard; a simulated IoT anomaly produces a visible alert.*

**Phase 4 - Databricks integration (the centerpiece)**
Build: Section 8 in full - real Free Edition workspace, Bronze/Silver/Gold notebooks
against the seed dataset, retrieval adapter switched to Databricks Vector Search behind
the feature flag, MLflow tracking wired to the eval harness.
*DoD: `RETRIEVAL_BACKEND=databricks` produces cited answers sourced from real Gold-layer
Databricks tables, demonstrable end-to-end.*

**Phase 5 - Polish & narrative**
Build: `docs/architecture.md` finalized with real (not aspirational) diagrams, README with
setup instructions and screenshots/GIF, `docs/evaluation.md` with actual scorecard results,
executive dashboard populated with real metrics from the running system.
*DoD: a stranger can clone the repo, follow the README, and get the full stack running
locally within 15 minutes; the eval scorecard and architecture doc reflect what's actually
built, not what was planned.*

Stretch goals (Section 22) are only attempted after Phase 5's DoD is met.

---

# 21. Interview Narrative Cheatsheet (for Bao, not the agent)

Once built, the story to tell is: *"I built this to go deeper than a diagram - real
Bronze/Silver/Gold in Databricks, real retrieval against governed Gold-layer data, real
human-in-the-loop review, and a real evaluation harness with groundedness and citation
accuracy scoring, not just a chat demo."* Be ready to walk through Section 3's diagram
from memory and explain one deliberate build-vs-buy decision (e.g., Claude API vs.
self-hosted model; Databricks Vector Search vs. a standalone vector DB).

---

# 22. Stretch Goals (after Phase 5 only)

- MCP server exposing the agent tools (Section 10) for external clients
- Multi-agent collaboration (agents calling other agents)
- Full Databricks Premium trial for real Unity Catalog RBAC demo
- Azure Entra ID authentication
- Power BI / Genie-style natural language analytics integration
- Slack/Teams notification integration for review approvals

---

# 23. Success Checklist

- [ ] Full stack boots via one documented command
- [ ] RAG queries return grounded, cited answers from real seed data
- [ ] At least one review has gone through the full approve/reject lifecycle
- [ ] `npm run eval` produces a real scorecard with all 7 metrics from Section 16
- [ ] IoT simulator has triggered at least one real anomaly alert
- [ ] Databricks Free Edition workspace has real Bronze/Silver/Gold tables populated
      from the seed dataset, and the app can retrieve from Gold via the feature flag
- [ ] `docs/architecture.md`, `docs/rag.md`, `docs/governance.md`, `docs/ai-sdlc.md`,
      `docs/evaluation.md` all exist and describe the *actual* system
- [ ] CI pipeline is green on the final commit
- [ ] README lets a stranger run the whole thing in under 15 minutes
