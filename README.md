# Tamil Knowledge Test

An online adaptive testing application for assessing students' Tamil knowledge.

- **Backend** — Python + FastAPI + SQLAlchemy, PostgreSQL. Adaptive engine drives a
  student through 6 categories with per-user question randomization, difficulty
  carry-over, server-authoritative timers, and scoring.
- **Frontend** — React + Vite + TypeScript SPA (public registration, student test-taking,
  and an admin console).

## Project layout

```
testing-app/
├── backend/          FastAPI app (app/), seed script, requirements.txt
│   └── app/
│       ├── main.py           app entrypoint (auto-creates tables, bootstraps admin)
│       ├── config.py         settings, all read from environment variables
│       ├── adaptive.py       the adaptive test engine
│       ├── routers/          public, student, and admin endpoints
│       └── ...
└── frontend/         React + Vite SPA (src/), package.json
    └── src/
        ├── api/client.ts     axios client + typed API wrappers
        └── pages/            public / admin / test-taking screens
```

## Local development

**Prerequisites:** Python 3.12+, Node 18+, a running PostgreSQL instance.

### Backend

```bash
cd backend
python -m venv .venv
.venv/Scripts/python.exe -m pip install -r requirements.txt   # Windows
# source .venv/bin/activate && pip install -r requirements.txt  # macOS/Linux

# Create the database, then copy .env.example -> .env and edit the values.
.venv/Scripts/python.exe -m app.seed          # optional: seed a demo test
.venv/Scripts/python.exe -m uvicorn app.main:app --port 8000
```

The API serves at `http://localhost:8000` (interactive docs at `/docs`). On first boot it
creates all tables and bootstraps the admin account from `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

> **Local email:** when SMTP is unconfigured, email sending "fails" by design and the
> verification / magic links are written to the **backend console** so you can proceed
> without a mail server. This fallback is fine for development but **not** for production.

### Frontend

```bash
cd frontend
npm install
npm run dev      # http://localhost:5173, proxies /api -> http://127.0.0.1:8000
```

Default dev admin login: `admin@example.com` / `admin12345`.

---

# Deployment

This guide deploys the app to a **free** hosting stack. The app is **deployment-ready**:
`config.py` reads everything from environment variables, CORS honors `FRONTEND_BASE_URL`,
the frontend API base URL is configurable, Python is pinned to 3.12, and the backend
refuses to boot in production with default secrets. The code changes that used to be
required are now in the repo (see [Deployment files](#deployment-files-already-in-the-repo));
deploying is now pure configuration.

> **Prerequisite:** all three free hosts deploy from a Git remote, so the project must be
> pushed to **GitHub** (or GitLab) first. This repo is not yet under version control.

## Recommended free stack (2026)

The repo is set up to deploy **both the backend and the frontend on [Vercel](https://vercel.com)**
as two separate projects from the same Git repo (backend as a Python serverless function,
frontend as a static SPA). This is the path the step-by-step below follows.

| Part | Service | Free-tier reality |
|---|---|---|
| **Database** | [Neon](https://neon.tech) (serverless Postgres) | Generous; auto-suspends when idle, wakes in ~1s. **Use the pooled connection string** (see below) |
| **Backend** (FastAPI) | [Vercel](https://vercel.com) Python serverless function | No always-on server; each request is a short-lived invocation. 60s max per request on the free plan |
| **Frontend** (static) | [Vercel](https://vercel.com) (or [Netlify](https://netlify.com) / [Cloudflare Pages](https://pages.cloudflare.com)) | Truly free, fast CDN |
| **Email** (magic links) | [Resend](https://resend.com) (~3k/mo) or [Brevo](https://brevo.com) (300/day) | Required in production — see below |

**Backend alternatives** if you'd rather run a long-lived server than serverless:
**[Render](https://render.com)** Web Service (spins down after ~15 min idle → ~50s cold
start), **Koyeb** (one always-on free service), or **Fly.io** (small free allowance). The
`backend/Procfile` and `backend/runtime.txt` support these without code changes.

## Honest caveats about "free"

- **Serverless has no warm process.** On Vercel the backend is a function, not a running
  server, so there is no in-process connection pool and no background work between requests.
  The app already handles this: `database.py` uses SQLAlchemy `NullPool` (one connection per
  request, closed on release). **You must pair it with Neon's _pooled_ connection string**
  (the host contains `-pooler`) so PgBouncer does the real pooling — otherwise concurrent
  invocations will exhaust Postgres connections.
- **Cold starts.** The first request after an idle period pays a short function cold-start;
  a long-lived host (Render/Koyeb) avoids this if it matters for an exam day.
- **Email is not optional in production.** The console-log fallback only works locally;
  deployed students can't see backend logs, so without a real SMTP provider they will
  never receive their verification or magic links.
- **Change the defaults** — never deploy with the default `admin12345` password or the
  `change-me` JWT secret. Set strong values via environment variables.

## Deployment files (already in the repo)

These were added to make the app deploy without further code edits:

| File | Purpose |
|---|---|
| `frontend/src/api/client.ts` | API base URL is now `import.meta.env.VITE_API_BASE_URL ?? "/api"` — set `VITE_API_BASE_URL` at build time for cross-origin hosting, or leave it unset and use a host rewrite. |
| `frontend/.env.example` | Documents `VITE_API_BASE_URL`. |
| `frontend/netlify.toml`, `frontend/vercel.json` | Build config + **SPA `/index.html` fallback** + an `/api/*` → backend rewrite. `vercel.json` currently points at `https://YOUR-BACKEND-PROJECT.vercel.app/api/$1` — replace that with your real backend URL. |
| `backend/api/index.py` | **Vercel serverless entrypoint** — re-exports the ASGI `app` from `app.main` so Vercel's Python runtime can serve it. |
| `backend/vercel.json` | Vercel backend config: routes all paths to the `api/index` function and sets `maxDuration` to 60s. |
| `backend/app/database.py` | Uses SQLAlchemy `NullPool` so the engine works correctly under serverless (one connection per request). Requires Neon's **pooled** connection string. |
| `backend/runtime.txt`, `backend/.python-version` | Pin Python to **3.12.8** (better wheel coverage than 3.14, avoids source builds). Vercel reads these to pick the runtime. |
| `backend/Procfile` | `web: uvicorn app.main:app --host 0.0.0.0 --port $PORT` for Procfile-based hosts (Render/Koyeb/Fly). Not used by Vercel. |
| `backend/.env.example` | Documents all env vars incl. the new `ENVIRONMENT`. |
| `.gitignore` | Keeps `.env`, `.venv/`, `node_modules/`, `dist/` out of version control. |

**Production secret guard:** set `ENVIRONMENT=production` on the backend. The app then
**refuses to boot** if `JWT_SECRET` is still `change-me` or `ADMIN_PASSWORD` is still
`admin12345`. Locally (`ENVIRONMENT=development`, the default) it only logs a warning.

**No start command on Vercel** — the platform invokes the ASGI `app` exported by
`backend/api/index.py` directly. (On a long-lived host the start command is
`uvicorn app.main:app --host 0.0.0.0 --port $PORT`.) Tables auto-create and the admin
auto-bootstraps on first boot via the `lifespan` hook, so there is **no separate migration
step** to run.

**Choose how the frontend reaches the API:**
- **Option A (same-origin, no CORS):** keep the relative `/api` and add a host rewrite
  forwarding `/api/*` → your backend URL (templates in `netlify.toml` / `vercel.json`).
- **Option B (cross-origin):** set `VITE_API_BASE_URL=https://<backend>/api` at build
  time; CORS is handled by `FRONTEND_BASE_URL` on the backend.

## Step-by-step

### 1. Database — Neon

1. Create a Neon project and a database.
2. Copy the **pooled** connection string (Neon's dashboard offers both — pick the one whose
   host contains `-pooler`; serverless requires it, see the caveats above) and convert it to
   the SQLAlchemy + psycopg2 form:

   ```
   postgresql+psycopg2://USER:PASSWORD@HOST-pooler.REGION.aws.neon.tech/DBNAME?sslmode=require
   ```

   (Neon gives you `postgresql://...`; add `+psycopg2` and keep `?sslmode=require`.)

### 2. Backend — Vercel (serverless)

New **Project** → import the repo, set **Root Directory** to `backend/`. Vercel detects
the Python function at `api/index.py` and the config in `backend/vercel.json`; there is **no
build or start command to set**.

- **Environment variables:**

  | Variable | Value |
  |---|---|
  | `ENVIRONMENT` | `production` (enables the default-secret guard) |
  | `DATABASE_URL` | the Neon **pooled** string from step 1 |
  | `JWT_SECRET` | a long random string |
  | `ADMIN_EMAIL` | your admin login email |
  | `ADMIN_PASSWORD` | a strong password |
  | `ADMIN_NAME` | admin display name |
  | `FRONTEND_BASE_URL` | your deployed frontend URL (from step 3) |
  | `BACKEND_BASE_URL` | this project's URL (e.g. `https://your-backend.vercel.app`) |
  | `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD` / `SMTP_FROM` | from step 4 |
  | `SMTP_USE_TLS` | `true` |

After the first deploy, the backend creates its tables and bootstraps the admin account on
the first request via the `lifespan` hook. To load demo content, run `python -m app.seed`
once locally against the same `DATABASE_URL`, or add questions through the admin console
(serverless has no persistent shell).

> Note your backend project's URL — you need it for the frontend rewrite in step 3.

### 3. Frontend — Vercel (or Netlify / Cloudflare Pages)

New **Project** → import the same repo, set **Root Directory** to `frontend/`. Vercel uses
`frontend/vercel.json`: build command `npm run build`, output `dist`, the SPA `/index.html`
fallback, and the `/api/*` → backend rewrite.

- **One required edit:** in `frontend/vercel.json`, replace the placeholder backend host with
  your real backend URL from step 2:

  ```json
  {
    "rewrites": [
      { "source": "/api/(.*)", "destination": "https://your-backend.vercel.app/api/$1" },
      { "source": "/(.*)", "destination": "/index.html" }
    ]
  }
  ```

  This keeps the frontend same-origin (the client calls the relative `/api`, no CORS needed).

- **Alternatives:**
  - *Cross-origin instead of the rewrite* — set the build-time env var
    `VITE_API_BASE_URL=https://your-backend.vercel.app/api`; CORS is then handled by
    `FRONTEND_BASE_URL` on the backend.
  - *Netlify* — `netlify.toml` is already bundled; point its `/api/*` redirect at your
    backend URL:

    ```toml
    [[redirects]]
      from = "/api/*"
      to = "https://your-backend.vercel.app/api/:splat"
      status = 200
      force = true

    [[redirects]]
      from = "/*"
      to = "/index.html"
      status = 200
    ```

### 4. Email — Resend / Brevo

Create an account, verify a sending domain (or use the provider's sandbox/test address),
and set the SMTP credentials as backend environment variables (`SMTP_HOST`, `SMTP_PORT`,
`SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, `SMTP_USE_TLS`). Send a test registration to
confirm the verification email arrives.

## Post-deploy checklist

- [ ] Backend `/api/health` returns `{"status":"ok"}`.
- [ ] `FRONTEND_BASE_URL` on the backend matches the real frontend origin (for CORS).
- [ ] Admin login works with your configured credentials (not the defaults).
- [ ] A test registration delivers a real verification email.
- [ ] After approval + release, the magic link in the email opens the test.
