# CI/CD & Pre-Production Assurance

Automated testing runs on every push and pull request to `main` / `master`. Production deploys (Vercel + Render) should only proceed when the **Deploy gate** job is green.

## Pipeline stages

```
┌─────────────┐     ┌──────────────────┐     ┌──────────────┐
│  Quality    │────▶│  Integration     │────▶│ Deploy gate  │
│  lint       │     │  migrate + seed  │     │ all green?   │
│  typecheck  │     │  feature suite   │     │ → promote    │
│  unit tests │     │  HTTP smoke      │     └──────────────┘
│  build      │     └──────────────────┘
└─────────────┘
```

| Job | What it proves |
|-----|----------------|
| **Quality** | Code compiles, types check, unit tests pass |
| **Integration** | Seeded stack works: platform, auth, data, RAG, workflows |
| **Deploy gate** | Both prior jobs succeeded — safe to ship |

## Tests run in CI

### Unit tests (`npm run test`)

Jest suites in `@infraops/ai-tools` (chunking, retriever factory).

### Feature suite (`npm run test:features`)

Runs the same registry as **Admin → Feature Test Suite** (~28 cases):

- Platform (DB, Redis)
- Auth (admin login)
- Data (documents, chunks, projects, IoT)
- RAG (intent, retrieval, 15 eval questions)
- Workflow (reviews, audit log)
- Settings

**Pass rules:**

1. Any failure outside `rag.eval.*` → **fail** (critical)
2. Overall pass rate must be ≥ `FEATURE_TEST_MIN_PASS_RATE` (default **80%**)

Report artifact: `feature-test-report.json`

### HTTP smoke tests (`npm run test:smoke`)

Against a live API + worker:

| Check | Endpoint |
|-------|----------|
| Health | `GET /api/health` |
| Database / Redis | health checks |
| Login | `POST /api/auth/login` |
| Documents | `GET /api/documents` |
| RAG query | `POST /api/agents/rag/query` |
| Executive dashboard | `GET /api/dashboard/executive` |

## Local commands

```bash
# Unit tests only
npm run test

# Full feature suite (requires Postgres + Redis, migrated + seeded)
docker compose up postgres redis -d
npm run db:migrate && npm run build -w @infraops/api && npm run db:seed
npm run test:features

# Smoke tests (API + worker must be running)
npm run start -w @infraops/api &
npm run start -w @infraops/worker &
npm run test:smoke
```

## Production deploy policy

1. **Branch protection** (GitHub → Settings → Branches → `main`):
   - Require status check: **Deploy gate**
   - Require branches to be up to date before merge

2. **Vercel / Render**: deploy only from `main` (default for connected repos).

3. Do **not** promote a commit if Deploy gate is red — even if Vercel/Render auto-deployed a preview.

## Environment variables (CI)

| Variable | Default | Purpose |
|----------|---------|---------|
| `FEATURE_TEST_MIN_PASS_RATE` | `0.8` | Minimum feature suite pass rate |
| `FEATURE_TEST_REPORT_PATH` | `feature-test-report.json` | Artifact path |
| `SMOKE_API_URL` | `http://127.0.0.1:3000` | Smoke test target |

## Adding new automated tests

1. Register the case in `packages/shared/src/feature-tests/registry.ts`
2. Implement executor in `packages/ai-tools/src/feature-tests/suite.ts`
3. CI picks it up automatically on the next push

For HTTP-level checks, extend `scripts/ci/smoke-api.mjs`.

## Related

- [PRODUCTION.md](./PRODUCTION.md) — cloud deploy runbook
- [evaluation.md](./evaluation.md) — RAG scorecard metrics
