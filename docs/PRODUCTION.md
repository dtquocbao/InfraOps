# Production Deployment Guide — InfraOps AI

Step-by-step instructions to deploy InfraOps AI to production using **Vercel (frontend)** and **Render (API + worker)**.

**Estimated time:** 45–60 minutes (first deploy, including database setup)

**Target topology:**

| Component | Platform | URL example |
|-----------|----------|-------------|
| Frontend | Vercel | `https://infraops.vercel.app` |
| API | Render Web Service | `https://infraops.onrender.com` |
| Worker | Render Background Worker | (internal — no public URL) |
| PostgreSQL + pgvector | Neon or Supabase | (connection string only) |
| Redis | Render Key Value or Upstash | (connection string only) |

---

## Before you start

### Prerequisites

- [ ] GitHub repo pushed (`dtquocbao/InfraOps` or your fork)
- [ ] [Vercel](https://vercel.com) account connected to GitHub
- [ ] [Render](https://render.com) account connected to GitHub
- [ ] [Neon](https://neon.tech) or [Supabase](https://supabase.com) account (Postgres **with pgvector**)

### Files in this repo (already configured)

| File | Purpose |
|------|---------|
| `vercel.json` | Monorepo frontend build for Vercel |
| `render.yaml` | Blueprint for API + worker on Render |
| `apps/api/Dockerfile` | API container (migrate → seed → start) |
| `apps/worker/Dockerfile` | BullMQ worker container |

---

## Phase 1 — Database (15 min)

### 1.1 Create Postgres with pgvector

**Neon (recommended):**

1. Create project → copy **connection string** (pooled or direct).
2. Open **SQL Editor** and run:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

3. Save connection string as `DATABASE_URL`:

```
postgresql://user:password@ep-xxx.region.aws.neon.tech/neondb?sslmode=require
```

**Supabase alternative:**

1. New project → **Settings → Database** → connection string (URI mode).
2. **Database → Extensions** → enable `vector`.

> **Do not use Render Postgres** for this app — it does not support the pgvector extension required for RAG.

### 1.2 Create Redis

**Option A — Render Key Value (same dashboard as API):**

1. Render → **New → Key Value** → create instance.
2. Copy **Internal Redis URL** (use internal URL for Render services).

**Option B — Upstash:**

1. Create database → copy `rediss://` URL.

Save as `REDIS_URL`.

---

## Phase 2 — Backend on Render (20 min)

### 2.1 Deploy via Blueprint (recommended)

1. Render Dashboard → **New → Blueprint**.
2. Connect GitHub repo `InfraOps`.
3. Render creates one service: **`infraops-api`** (web).
4. When prompted, enter:

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | Neon/Supabase connection string from Phase 1 |
| `REDIS_URL` | Redis URL from Phase 1 |
| `WEB_ORIGIN` | Your Vercel URL (set in Phase 3 if not ready — update later) |

5. Click **Apply**. Wait for build (5–10 min first time).

> **Render Free tier note:** Background Worker services are not available on the free plan. BullMQ processors (document upload, evaluation, feature tests) run **embedded inside the API container** automatically — no separate worker service needed.

### 2.2 Optional — dedicated worker (Render Starter+)

If you upgrade to a paid Render plan, you can deploy a separate worker:

| Setting | Value |
|---------|-------|
| Type | Background Worker |
| Dockerfile | `apps/worker/Dockerfile` |
| Docker context | `.` |

Use the same `DATABASE_URL`, `REDIS_URL`, and `JWT_SECRET` as the API. On paid plans you may remove the embedded worker from `apps/api/docker-entrypoint.sh` if you prefer split services.

### 2.3 Manual API setup (alternative)

**API service:**

| Setting | Value |
|---------|-------|
| Name | `infraops-api` |
| Runtime | **Docker** |
| Root Directory | *(leave empty — repo root)* |
| Dockerfile Path | `apps/api/Dockerfile` |
| Docker Context | `.` |
| Plan | Free or Starter |
| Health Check Path | `/api/health` |

**Environment variables:**

```env
NODE_ENV=production
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_SECRET=<generate-32+-char-random-string>
WEB_ORIGIN=https://your-app.vercel.app
```

Generate JWT secret (PowerShell):

```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }) -as [byte[]])
```

### 2.4 First deploy — what happens

The API container automatically:

1. Runs `prisma migrate deploy` (creates tables)
2. Runs `db:seed` (users, 15 documents, IoT devices, default settings)
3. Starts embedded BullMQ worker (background process in same container)
4. Starts NestJS on port `3000` (Render sets `PORT`)

**Watch logs** for:

```
Starting embedded BullMQ worker...
InfraOps worker started - document, IoT, evaluation, and feature-test processors active
Seed complete - demo users password: password123
```

Initial seed takes **2–5 minutes**. Health check may fail until seed completes — this is normal on first deploy.

### 2.5 Verify API

```bash
curl https://infraops.onrender.com/api/health
```

Expected:

```json
{
  "status": "ok",
  "database": "connected",
  "redis": "connected",
  "retrievalBackend": "pgvector"
}
```

---

## Phase 3 — Frontend on Vercel (10 min)

### 3.1 Import project

1. Vercel → **Add New → Project** → import GitHub repo.
2. **Do not** change Root Directory (keep repo root `.`).
3. Framework Preset: **Other** (uses `vercel.json` automatically).
4. Node.js Version: **20**.

### 3.2 Environment variables

Add before first deploy:

| Name | Value |
|------|-------|
| `VITE_API_URL` | `https://infraops.onrender.com` |

Rules:

- Use your **actual Render API URL**
- **No trailing slash**
- Must be set **before build** — changing it requires redeploy

### 3.3 Deploy

Click **Deploy**. Build command (from `vercel.json`):

```bash
npm ci --workspace=@infraops/web --workspace=@infraops/shared --include-workspace-root
npm run build -w @infraops/shared && npm run build -w @infraops/web
```

Output: `apps/web/dist`

### 3.4 Update CORS on Render

Copy your Vercel URL (e.g. `https://infraops-xxx.vercel.app`).

Render → **infraops-api → Environment** → set:

```env
WEB_ORIGIN=https://infraops-xxx.vercel.app
```

For production + preview deployments:

```env
WEB_ORIGIN=https://infraops.vercel.app,https://infraops-xxx.vercel.app
```

Save → Render redeploys API automatically.

---

## Phase 4 — Post-deploy configuration (10 min)

### 4.1 Login

Open Vercel URL → sign in:

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@meridiangrid.com` | `password123` |

> **Production security:** Change demo passwords or disable demo users before exposing to external users (see Phase 5).

### 4.2 Admin → Settings

Configure in the UI (stored in database — no redeploy needed):

| Setting | Production recommendation |
|---------|---------------------------|
| `RETRIEVAL_BACKEND` | `pgvector` (unless Databricks is fully configured) |
| `ANTHROPIC_API_KEY` | Your Claude API key (recommended) |
| `OPENAI_API_KEY` | For embeddings + LLM fallback |
| Databricks fields | Leave empty unless Gold layer is set up |

### 4.3 Run feature tests

**Admin → Feature Test Suite → Run All Tests**

All ~28 tests should pass. RAG tests use pgvector on Neon/Supabase.

If RAG tests fail with Databricks 404 errors → set `RETRIEVAL_BACKEND=pgvector` in Settings.

### 4.4 Optional — CLI evaluation

From your local machine (with `DATABASE_URL` pointing to production **read-only** is not recommended; use staging instead):

```bash
# Only against staging/local — not recommended on production DB
npm run eval
```

---

## Phase 5 — Production hardening

Complete before sharing with real users or executives.

### 5.1 Security checklist

- [ ] Replace demo passwords (`password123`) or remove demo users
- [ ] Use a strong `JWT_SECRET` (32+ chars, never committed to git)
- [ ] Set `WEB_ORIGIN` to exact production domain only (no wildcard in prod)
- [ ] Add LLM API keys via Admin → Settings (never in git or Vercel env for keys — API keys live in DB on Render)
- [ ] Confirm `NODE_ENV=production` on Render
- [ ] Enable Vercel **Production** domain with HTTPS
- [ ] Restrict Render dashboard access to ops team

### 5.2 Recommended upgrades (beyond free tier)

| Item | Why |
|------|-----|
| Render **Starter** plan for API | Avoid cold starts (~50s on free tier) |
| Neon **paid** or connection pooling | Stable connections under load |
| Custom domain on Vercel | Professional URL for demos |
| Separate **staging** environment | Test migrations before production |

### 5.3 Secrets summary

| Secret | Where it lives | Never put in |
|--------|----------------|--------------|
| `DATABASE_URL` | Render env | Git, Vercel |
| `REDIS_URL` | Render env | Git, Vercel |
| `JWT_SECRET` | Render env | Git, Vercel |
| `VITE_API_URL` | Vercel env | Not a secret — public API URL |
| LLM / Databricks keys | Postgres `system_settings` | Git, client-side |

---

## Phase 5b — CI/CD deploy gate (required)

Before treating a commit as production-ready, GitHub Actions must pass:

| Job | Checks |
|-----|--------|
| **Quality** | Lint, typecheck, unit tests, build |
| **Integration** | Migrate, seed, feature suite (~28 cases), HTTP smoke tests |
| **Deploy gate** | Both jobs green |

Details: [CI_CD.md](./CI_CD.md)

**Recommended:** enable branch protection on `main` requiring the **Deploy gate** status check.

```bash
# Run the same gates locally
npm run test
npm run test:features   # needs seeded Postgres + Redis
npm run test:smoke      # needs API + worker running
```

---

## Phase 6 — Verify production

### Smoke test script

Run through this checklist after every deploy:

| # | Test | Expected |
|---|------|----------|
| 1 | `GET /api/health` | `status: ok`, db + redis connected |
| 2 | Login on Vercel URL | Dashboard loads |
| 3 | AI Assistant: *"What is the lockout-tagout procedure?"* | Cited answer + intent badge |
| 4 | Documents page | 15 documents, status `ready` |
| 5 | Admin → Feature Test Suite | Run all → pass rate ≥ 80% |
| 6 | Upload a test document | Processing completes (requires worker) |
| 7 | Executive Dashboard | KPIs populated |

### URLs to bookmark

| Service | URL |
|---------|-----|
| App | `https://<your-vercel-domain>` |
| API | `https://<your-render-domain>/api/health` |
| Swagger | `https://<your-render-domain>/api/docs` |
| Render logs | Render Dashboard → infraops-api → Logs |
| Vercel deploys | Vercel Dashboard → Deployments |

---

## Updating production

### Frontend change only

Push to `main` → Vercel auto-deploys.

If API URL changed, update `VITE_API_URL` in Vercel and redeploy.

### Backend change

Push to `main` → Render auto-deploys API + worker.

API container re-runs migrate + seed on each deploy. Seed is idempotent (upserts).

### Database migration only

Migrations run automatically on API startup via:

```bash
npm run db:migrate -w @infraops/api
```

For breaking migrations, backup Neon database first.

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Vercel build fails at install | Ensure `vercel.json` exists at repo root; Node 20 |
| Blank page / API errors in browser | Set `VITE_API_URL`; redeploy Vercel |
| CORS blocked | Match `WEB_ORIGIN` exactly to Vercel URL |
| Render build fails | Docker context = `.`, Dockerfile = `apps/api/Dockerfile` |
| API crashes on start | Check logs — likely missing pgvector: run `CREATE EXTENSION vector;` |
| Health check timeout | Wait for seed; increase health check grace period to 300s |
| RAG returns 500 | Set `RETRIEVAL_BACKEND=pgvector` in Admin → Settings |
| Blueprint sync failed: worker plan error | Render Free has no Background Workers | Push latest `render.yaml` (API-only blueprint) |
| Upload stuck on `queued` | Redis misconfigured | Check `REDIS_URL` in API env; check API logs for embedded worker |
| Feature tests error on Databricks | Expected if Databricks not configured — use pgvector |
| Slow first request | Render free tier cold start — upgrade to Starter |

---

## Quick reference — all environment variables

### Vercel

```env
VITE_API_URL=https://infraops.onrender.com
```

### Render — infraops-api

```env
NODE_ENV=production
DATABASE_URL=postgresql://...@...neon.tech/...?sslmode=require
REDIS_URL=redis://...
JWT_SECRET=<random-32+-chars>
WEB_ORIGIN=https://your-app.vercel.app
```

### Render — infraops-api (worker embedded in same container)

```env
NODE_ENV=production
DATABASE_URL=<same as api>
REDIS_URL=<same as api>
JWT_SECRET=<same as api>
```

> On Render Free tier there is no separate worker service — BullMQ runs inside the API container.

### Admin → Settings (after login, not env vars)

```env
RETRIEVAL_BACKEND=pgvector
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
```

---

## Related docs

- [CI_CD.md](./CI_CD.md) — automated testing and deploy gate
- [DEPLOYMENT.md](./DEPLOYMENT.md) — condensed reference + architecture diagram
- [architecture.md](./architecture.md) — system design
- [governance.md](./governance.md) — RBAC and review rules
- [SUCCESS_CHECKLIST.md](./SUCCESS_CHECKLIST.md) — feature completeness checklist

---

*Last updated: July 2026 — InfraOps AI v0.5.x*
