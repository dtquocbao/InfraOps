# InfraOps AI

Enterprise Agentic RAG platform for **Meridian Grid Services** - a fictional energy-infrastructure EPC company. Built as a portfolio-grade demo of governed RAG, human-in-the-loop review, Databricks medallion architecture, and real evaluation metrics.

## What you get

- **15 synthetic domain documents** (engineering, safety, contracts, project reports)
- **Grounded RAG** with hybrid search and structured citations
- **Human review workflow** with configurable trigger rules
- **IoT anomaly simulation** with live dashboard alerts
- **Databricks Bronze → Silver → Gold** notebooks + retrieval adapter
- **`npm run eval`** - 15-question RAG scorecard with MLflow logging

## Prerequisites

| Requirement | Version |
|-------------|---------|
| Docker Desktop | Running |
| Node.js (local dev only) | 20+ |
| Git | any |

Optional: Anthropic/OpenAI API keys for real LLM responses; Databricks Free Edition for Gold-layer retrieval.

---

## 15-minute quick start

### Step 1 - Clone & configure (2 min)

```bash
git clone <repo-url> infraops-ai
cd infraops-ai
cp .env.example .env
```

Bootstrap `.env` only needs database, Redis, and JWT - API keys and Databricks config are managed in **Admin → Settings** after login.

```bash
docker compose up --build
```

Wait until you see API logs: `Seed complete` and worker `document, IoT, and evaluation processors active`.

| Service | URL |
|---------|-----|
| **Web dashboard** | http://localhost:5173 |
| API + Swagger | http://localhost:3000/api/docs |
| Health check | http://localhost:3000/api/health |

### Step 3 - Login & configure (2 min)

Open http://localhost:5173 and sign in as **admin** to configure LLM keys and retrieval backend under **Admin → Settings**.

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@meridiangrid.com` | `password123` |

Other roles:

| Role | Email | Password |
|------|-------|----------|
| Engineer | `engineer@meridiangrid.com` | `password123` |
| Safety (reviewer) | `safety@meridiangrid.com` | `password123` |

### Step 4 - Demo walkthrough (5 min)

1. **Executive Dashboard** - live KPIs: 15 indexed documents, retrieval backend status
2. **AI Assistant** - ask: *"What is the lockout-tagout procedure?"* → cited answer
3. **Human Review** - login as `safety@…`, approve a flagged safety response
4. **IoT Monitor** - in a second terminal: `npm run iot:simulate` → watch alerts appear
5. **Admin** - audit log, queue metrics, evaluation summary

### Step 5 - Run evaluation scorecard (2 min)

With the stack running (Postgres seeded):

```bash
cp .env.example .env   # if not done
npm run eval
```

See [docs/evaluation.md](docs/evaluation.md) for interpreting results.

---

## Screenshots

Capture these after `docker compose up` for portfolio/README use:

| File | What to capture |
|------|-----------------|
| `docs/screenshots/01-login.png` | Login page |
| `docs/screenshots/02-assistant-citations.png` | AI Assistant with citation tags |
| `docs/screenshots/03-review-queue.png` | Human Review pending item |
| `docs/screenshots/04-executive-dashboard.png` | Executive Dashboard with charts |
| `docs/screenshots/05-iot-alerts.png` | IoT Monitor with anomaly alert |
| `docs/screenshots/06-eval-scorecard.png` | Terminal output of `npm run eval` |

See [docs/screenshots/README.md](docs/screenshots/README.md) for capture instructions.

---

## Local development (without full Docker rebuild)

```bash
npm install
cp .env.example .env

# Infrastructure only
docker compose up postgres redis -d

npm run db:generate -w @infraops/api
npm run db:migrate -w @infraops/api
npm run build -w @infraops/shared -w @infraops/ai-tools -w @infraops/api
npm run db:seed -w @infraops/api

# Three terminals
npm run dev -w @infraops/api
npm run dev -w @infraops/worker
npm run dev -w @infraops/web
```

---

## Production deployment

Deploy frontend to **Vercel** and backend to **Render**:

→ **[docs/PRODUCTION.md](docs/PRODUCTION.md)** — full step-by-step runbook (~45 min)

Quick summary: Neon (pgvector) + Redis → Render API/worker → Vercel with `VITE_API_URL`.

**CI/CD:** every push runs quality + integration + deploy gate. Only promote when the gate is green — see **[docs/CI_CD.md](docs/CI_CD.md)**.

---

## Databricks integration (optional)

1. Sign up: [Databricks Free Edition](https://www.databricks.com/learn/free-edition)
2. Follow [databricks/README.md](databricks/README.md) - run notebooks 01→04
3. In **Admin → Settings**, set `RETRIEVAL_BACKEND` to `databricks` and fill Databricks fields
4. Restart is not required - new RAG queries use updated settings immediately

---

## Monorepo structure

```
apps/web          React 18 dashboard (Vite + Tailwind + Recharts)
apps/api          NestJS API gateway + agent orchestrator
apps/worker       BullMQ processors + eval harness
packages/shared   Zod schemas, env validation, review rules
packages/ai-tools LLM/embedding adapters, retrieval, scoring
databricks/       Medallion notebooks + Unity Catalog setup
seed/             15 documents + IoT simulator
docs/             Architecture, RAG, governance, evaluation
```

## Scripts

| Command | Description |
|---------|-------------|
| `docker compose up --build` | Full stack (recommended) |
| `npm run build` | Build all workspaces |
| `npm run typecheck` | Type-check all workspaces |
| `npm run test` | Run unit tests |
| `npm run eval` | RAG evaluation scorecard (15 questions) |
| `npm run iot:simulate` | Stream IoT events with anomalies |
| `npm run db:seed` | Re-seed documents + users |

## Documentation

| Doc | Contents |
|-----|----------|
| [docs/architecture.md](docs/architecture.md) | As-built diagrams, build vs buy |
| [docs/rag.md](docs/rag.md) | RAG pipeline + Databricks medallion |
| [docs/evaluation.md](docs/evaluation.md) | Metrics + scorecard |
| [docs/governance.md](docs/governance.md) | RBAC, review rules, audit |
| [docs/ai-sdlc.md](docs/ai-sdlc.md) | Component maturity stages |
| [docs/PRODUCTION.md](docs/PRODUCTION.md) | **Production deploy** — Vercel + Render step-by-step |
| [docs/CI_CD.md](docs/CI_CD.md) | **CI/CD gates** — automated tests before production |
| [docs/iot-anomaly-model.md](docs/iot-anomaly-model.md) | IoT scoring: heuristic / Model Serving + LLM explain |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Cloud deployment reference + troubleshooting |

## Build phases (complete)

| Phase | Status |
|-------|--------|
| 1 Foundation | ✅ Docker, auth, dashboard |
| 2 Document RAG | ✅ pgvector, citations, seed data |
| 3 Review + Eval + IoT | ✅ HITL, scorecard, simulator |
| 4 Databricks | ✅ Medallion + retrieval adapter |
| 5 Polish | ✅ This README + architecture docs |

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Port 5432 in use | Stop local Postgres or change docker-compose port |
| Docker daemon not running | Start Docker Desktop |
| Empty RAG answers | Wait for seed to finish; check Documents page shows `ready` |
| `npm run eval` fails | Ensure bootstrap `.env` has `DATABASE_URL`; Postgres must be seeded |
| No LLM quality | Set `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` in Admin → Settings |

## License

Portfolio / demonstration project - synthetic data only.
