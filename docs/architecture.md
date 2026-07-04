# Architecture - InfraOps AI

> As-built documentation reflecting the implemented system (Phases 1–5).

## System context

InfraOps AI is an enterprise agentic RAG platform for **Meridian Grid Services**, a fictional energy-infrastructure EPC company. It demonstrates AI maturity Level 3/4 patterns: governed data, human-in-the-loop review, evaluation harness, and Databricks medallion architecture.

```mermaid
flowchart TB
    subgraph Users
        ENG[Engineers]
        PM[Project Managers]
        SAF[Safety Officers]
        EXEC[Executives]
    end

    subgraph Frontend["apps/web - React 18"]
        DASH[Executive Dashboard]
        ASST[AI Assistant]
        DOCS[Documents]
        REV[Human Review]
        IOT[IoT Monitor]
        ADM[Admin]
    end

    subgraph API["apps/api - NestJS"]
        AUTH[JWT Auth + RBAC]
        AGENT[Agent Orchestrator]
        INTENT[Intent Classifier]
        RET[Tri-Hybrid Retriever]
        QUEUE_PROD[BullMQ Producer]
    end

    subgraph Worker["apps/worker - BullMQ"]
        DOC_W[Document Processor]
        IOT_W[IoT analyze_iot]
        EVAL_W[Evaluation Scorer]
    end

    subgraph DataLocal["Operational Store"]
        PG[(PostgreSQL 16 + pgvector)]
        REDIS[(Redis 7)]
    end

    subgraph DataLake["Databricks - Analytical"]
        BRONZE[bronze.*]
        SILVER[silver.*]
        GOLD[gold.*]
        VS[Vector Search Index]
        MS[Model Serving<br/>iot-anomaly]
    end

    subgraph External["Managed Services"]
        LLM[Claude / OpenAI]
        MLF[MLflow Tracking]
    end

    Users --> Frontend
    Frontend --> API
    API --> AUTH
    API --> AGENT
    AGENT --> INTENT
    INTENT --> RET
    RET -->|RETRIEVAL_BACKEND=pgvector| PG
    RET -->|RETRIEVAL_BACKEND=databricks| VS
    VS --> GOLD
    GOLD --> SILVER --> BRONZE
    API --> QUEUE_PROD --> REDIS
    REDIS --> Worker
    Worker --> PG
    AGENT --> LLM
    DOC_W --> PG
    EVAL_W --> PG
    EVAL_W -.-> MLF
    IOT_W -->|IOT_SCORING_BACKEND=heuristic| IOT_W
    IOT_W -->|IOT_SCORING_BACKEND=model_serving| MS
    IOT_W -->|flagged only| LLM
```

## IoT anomaly scoring (two-step)

```mermaid
sequenceDiagram
    participant S as Simulator / Device
    participant A as API
    participant W as Worker
    participant H as Heuristic / Model Serving
    participant L as LLM

    S->>A: POST /api/iot/events
    A->>W: process_iot_event
    W->>W: extractFeatures (rolling window)
    W->>H: scoreAnomaly
    H-->>W: score + backend + model_version
    alt score below threshold
        W->>W: persist iot_events (no LLM)
    else score flagged
        W->>L: explain anomaly (low frequency)
        L-->>W: explanation
        W->>W: persist + audit alert
    end
```

See [iot-anomaly-model.md](./iot-anomaly-model.md).

## Request flow - RAG query

```mermaid
sequenceDiagram
    participant U as User
    participant W as Web UI
    participant A as NestJS API
    participant I as Intent Classifier
    participant R as Tri-Hybrid Retriever
    participant L as LLM Adapter
    participant Q as BullMQ
    participant DB as PostgreSQL

    U->>W: Ask question
    W->>A: POST /api/agents/rag/query
    A->>I: classifyQueryIntent(question)
    I-->>A: intent profile + keyword expansion
    A->>R: semantic + keyword + intent search
    alt pgvector
        R->>DB: 50% vector + 30% FTS + 20% intent SQL
    else databricks
        R->>DB: Vector Search + intent re-rank
    end
    R-->>A: chunks + metadata
    A->>L: context + question
    L-->>A: grounded answer
    A->>DB: agent_runs + citations + detectedIntent
    A->>Q: evaluate_response job
    A->>A: review trigger rules
    A-->>W: answer + citations + intent label
    Q->>DB: evaluations scores
```

## Tri-hybrid retrieval architecture

```mermaid
flowchart LR
    Q[User Question] --> IC[Intent Classifier]
    Q --> EMB[Query Embedding]
    IC --> IP[Intent Profile<br/>doc types + keywords]
    EMB --> SEM[Semantic Search<br/>50% weight]
    Q --> KW[Keyword FTS<br/>30% weight]
    IP --> INT[Intent Alignment<br/>20% weight]
    SEM --> MERGE[Score Fusion]
    KW --> MERGE
    INT --> MERGE
    MERGE --> RBAC[RBAC + metadata filters]
    RBAC --> TOPK[Top-K chunks]
    TOPK --> LLM[Grounded generation]
```

| Signal | Purpose | Example |
|--------|---------|---------|
| Semantic | Meaning similarity via embeddings | "LOTO steps" matches "lockout-tagout procedure" |
| Keyword | Exact term matching via FTS | "Helix Power" matches contract clause |
| Intent | Domain routing to doc types | Safety question boosts `safety_sop` documents |

## Monorepo layout

| Path | Role |
|------|------|
| `apps/web` | React dashboard - 7 pages, dark enterprise UI |
| `apps/api` | NestJS gateway, JWT, OpenAPI, agent orchestration |
| `apps/worker` | BullMQ processors + eval harness |
| `packages/shared` | Zod schemas, env validation, review rules |
| `packages/ai-tools` | LLM adapters, retrieval, chunking, scoring |
| `databricks/` | Bronze/Silver/Gold notebooks, Unity Catalog SQL |
| `seed/` | 15 synthetic documents + IoT simulator |

## Technology stack (pinned)

| Layer | Technology | Version |
|-------|------------|---------|
| Frontend | React + Vite + Tailwind + Recharts | 18 / 6 |
| Backend | NestJS + Prisma | 11 / 6 |
| Database | PostgreSQL + pgvector | 16 |
| Queue | BullMQ + Redis | 5 / 7 |
| LLM | Anthropic Claude → OpenAI → stub | API |
| Embeddings | OpenAI text-embedding-3-small | 1536-dim |
| Data platform | Databricks Free Edition | Delta + UC |
| Eval tracking | MLflow REST API | optional |
| CI | GitHub Actions | Node 20 |

## Data architecture

### Operational (PostgreSQL)

Single source of truth for **application state**: users, documents, chunks (pgvector cache), agent_runs, reviews, evaluations, IoT events, audit_log.

Retrieval rule: pgvector reads local `document_chunks` when `RETRIEVAL_BACKEND=pgvector`.

### Analytical (Databricks medallion)

| Layer | Tables | Purpose |
|-------|--------|---------|
| Bronze | `documents_raw`, `iot_events_raw` | Immutable ingest |
| Silver | `documents_parsed`, `document_chunks`, `iot_events` | Parsed, chunked, validated |
| Gold | `document_chunks`, `project_kpis`, `risk_scores`, `iot_daily_rollup` | Business-ready |
| Index | `document_chunks_index` | Vector Search (optional) |

Retrieval rule: **Gold layer only** when `RETRIEVAL_BACKEND=databricks` - never Bronze/Silver directly.

## Build vs. buy decisions

| Capability | Decision | Rationale |
|------------|----------|-----------|
| LLM generation | **Buy** - Claude/OpenAI API | Quality, speed-to-market; adapter allows swap |
| Vector search (prod demo) | **Buy** - Databricks Vector Search | Aligns with org data platform; governed Gold data |
| Vector search (local dev) | **Build** - pgvector | Zero cloud dependency for CI and offline demo |
| Agent orchestration | **Build** | Domain-specific review rules, citations, RBAC, intent classifier |
| Evaluation harness | **Build** | Portfolio artifact; 15-question scorecard |
| Human review workflow | **Build** | Configurable trigger rules table |
| IoT anomaly scoring | **Build** features + **Buy** Model Serving | Small classifier for high-frequency events; LLM only explains flags |
| Identity (MVP) | **Build** - JWT | Entra ID documented as stretch goal |

## Security & governance (implemented)

- RBAC: `engineer`, `pm`, `safety`, `executive`, `admin`
- Document `security_level` enforced at retrieval via `ROLE_CLEARANCE` map
- Review decisions → `audit_log` + `evaluations.user_rating`
- All LLM calls server-side; no client API keys
- See [governance.md](./governance.md)

## Observability

- Structured JSON logs via Pino (`trace_id` on agent runs)
- Health endpoint: DB, Redis, retrieval backend status
- Admin: queue metrics, audit log, evaluation summary
- MLflow experiment `infraops-rag-eval` for harness runs

## Deployment topologies

### Local (15-minute demo)

```bash
docker compose up --build
```

Boots: postgres, redis, api (migrate + seed), worker, web.

### Databricks-connected

1. Run notebooks `01` → `04` ([databricks/README.md](../databricks/README.md))
2. Set `RETRIEVAL_BACKEND=databricks` in `.env`
3. Restart API - health shows `retrievalBackend: databricks`

## API surface (implemented)

| Method | Path | Auth |
|--------|------|------|
| POST | `/api/auth/login` | Public |
| GET | `/api/health` | Public |
| GET | `/api/dashboard/executive` | JWT |
| POST | `/api/agents/rag/query` | JWT |
| POST | `/api/documents/upload` | JWT |
| GET | `/api/reviews/pending` | JWT |
| POST | `/api/reviews/:runId/decide` | JWT + role |
| GET | `/api/evaluations/summary` | JWT |
| GET | `/api/admin/audit-log` | JWT + admin/exec |
| POST | `/api/iot/events` | JWT |

Full OpenAPI: http://localhost:3000/api/docs

## Related docs

- [RAG pipeline](./rag.md)
- [IoT anomaly model](./iot-anomaly-model.md)
- [Evaluation framework](./evaluation.md)
- [Governance](./governance.md)
- [AI SDLC status](./ai-sdlc.md)
