# Deploying InfraOps AI — Vercel (frontend) + Render (backend)

> **Full runbook:** [PRODUCTION.md](./PRODUCTION.md) — step-by-step production instructions.

Split deployment: **React on Vercel**, **NestJS API + BullMQ worker on Render**.

> **Important:** Build failures on Vercel/Render are usually **missing config or wrong Docker context**, not the pgvector fallback runtime fix. Follow this guide exactly.

---

## Architecture

```
Vercel (static)          Render (Docker)
┌─────────────────┐      ┌──────────────────┐
│  apps/web       │ JWT  │  apps/api        │
│  VITE_API_URL ──┼─────▶│  + Postgres      │
└─────────────────┘      │  + Redis         │
                         │  apps/worker     │
                         └──────────────────┘
```

---

## 1. Database & Redis (required before Render)

### Postgres **with pgvector**

Render's default Postgres **does not include pgvector**. Use one of:

| Provider | Notes |
|----------|-------|
| [Neon](https://neon.tech) | Free tier; enable `vector` extension in SQL editor: `CREATE EXTENSION IF NOT EXISTS vector;` |
| [Supabase](https://supabase.com) | Enable pgvector in dashboard |
| Self-hosted | `pgvector/pgvector:pg16` image |

Copy the connection string → `DATABASE_URL`.

### Redis

| Provider | Notes |
|----------|-------|
| [Render Key Value](https://render.com/docs/key-value) | Redis-compatible, same dashboard |
| [Upstash](https://upstash.com) | Serverless Redis |

Copy URL → `REDIS_URL` (format: `redis://...` or `rediss://...`).

---

## 2. Render — API (embedded worker)

### Option A: Blueprint (recommended)

1. Push this repo to GitHub (includes `render.yaml`).
2. Render Dashboard → **New → Blueprint** → connect repo.
3. Set sync=false env vars when prompted:
   - `DATABASE_URL` — Neon/Supabase URL with pgvector
   - `REDIS_URL` — Redis URL
   - `WEB_ORIGIN` — your Vercel URL (see section 3)
4. Deploy **`infraops-api`** only (worker runs inside the API container on Free tier).

### Option B: Manual web service

| Setting | Value |
|---------|-------|
| **Runtime** | Docker |
| **Dockerfile path** | `apps/api/Dockerfile` |
| **Docker context** | `.` (repository root — **not** `apps/api`) |
| **Health check path** | `/api/health` |

**Environment variables (API):**

| Variable | Example |
|----------|---------|
| `DATABASE_URL` | `postgresql://user:pass@host/db?sslmode=require` |
| `REDIS_URL` | `redis://red-xxx:6379` |
| `JWT_SECRET` | random 32+ char string |
| `NODE_ENV` | `production` |
| `WEB_ORIGIN` | `https://your-app.vercel.app` |

The API container runs migrate → seed → embedded worker → start. Initial seed processes 15 documents (~2–5 min). Watch logs for `Seed complete`.

### Retrieval backend on cloud

Default is **`pgvector`** (correct for Neon/Supabase). In Admin → Settings:

- Keep `RETRIEVAL_BACKEND=pgvector` unless Databricks is fully configured.
- Do **not** set Databricks unless Vector Search is working — the API falls back to pgvector automatically.

---

## 3. Vercel — Frontend

### Project settings

| Setting | Value |
|---------|-------|
| **Root Directory** | `.` (repo root — leave default) |
| **Framework Preset** | Other (uses root `vercel.json`) |
| **Node.js Version** | 20 |

The repo includes `vercel.json` with the correct monorepo build:

```bash
npm ci --workspace=@infraops/web --workspace=@infraops/shared --include-workspace-root
npm run build -w @infraops/shared && npm run build -w @infraops/web
# output: apps/web/dist
```

### Environment variables (Vercel)

| Variable | Value |
|----------|-------|
| `VITE_API_URL` | `https://infraops.onrender.com` (your Render API URL, **no trailing slash**) |

Redeploy after setting `VITE_API_URL` — Vite bakes this in at **build time**.

### CORS on Render

Set `WEB_ORIGIN` on the API to match Vercel exactly:

```
WEB_ORIGIN=https://your-app.vercel.app
```

Multiple origins (preview + production):

```
WEB_ORIGIN=https://your-app.vercel.app,https://your-app-*.vercel.app
```

---

## 4. Verify deployment

1. **API health:** `https://infraops.onrender.com/api/health` → `"status":"ok"`
2. **Vercel app:** login as `admin@meridiangrid.com` / `password123`
3. **AI Assistant:** ask a safety question → cited answer (uses pgvector on Neon)
4. **Admin → Feature Test Suite → Run All Tests** → should pass with `pgvector` or `databricks+pgvector-fallback`

---

## 5. Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Vercel fails at "Installing dependencies" | Monorepo install without workspace filter | Use repo `vercel.json` (already added) |
| Vercel build OK but API calls fail | Missing `VITE_API_URL` | Set env var; redeploy Vercel |
| CORS error in browser | `WEB_ORIGIN` mismatch | Set to exact Vercel URL on Render |
| Render Docker build fails immediately | Wrong Docker context | Context must be `.`, Dockerfile `apps/api/Dockerfile` |
| Render deploy OK then crashes | No pgvector on Postgres | Use Neon/Supabase; run `CREATE EXTENSION vector;` |
| Render health check fails | Still seeding | Wait for seed logs; increase health check start period |
| Feature tests fail on RAG | Databricks configured but broken | Set `RETRIEVAL_BACKEND=pgvector` in Admin → Settings |
| Worker jobs never run | Redis misconfigured or API not restarted | Check `REDIS_URL`; redeploy API; look for worker log line in API container |
| Blueprint sync failed on worker | Free plan lacks Background Workers | Use updated `render.yaml` (API only, embedded worker) |
| Render free tier slow | Cold start | First request after idle takes ~50s |

---

## 6. Environment checklist

### Vercel
- [ ] `VITE_API_URL=https://<render-api-host>`

### Render API
- [ ] `DATABASE_URL` (pgvector-enabled Postgres)
- [ ] `REDIS_URL`
- [ ] `JWT_SECRET` (16+ chars)
- [ ] `WEB_ORIGIN=https://<vercel-host>`
- [ ] `NODE_ENV=production`

> Worker runs embedded in API container on Render Free tier — no separate worker service.

### Optional (Admin → Settings after login)
- [ ] `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` for real LLM quality
- [ ] `RETRIEVAL_BACKEND=pgvector` (recommended for cloud demo)

---

## 7. Local vs cloud differences

| Concern | Local (`docker compose`) | Cloud |
|---------|--------------------------|-------|
| Postgres | pgvector image bundled | External Neon/Supabase |
| Redis | Bundled container | Render Key Value / Upstash |
| Frontend | `:5173` | Vercel CDN |
| API | `:3000` | Render web service |
| Config | Admin → Settings + `.env` bootstrap | Same; bootstrap env on Render only |
