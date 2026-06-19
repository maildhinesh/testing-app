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

| Part | Service | Free-tier reality |
|---|---|---|
| **Database** | [Neon](https://neon.tech) (serverless Postgres) | Generous; auto-suspends when idle, wakes in ~1s |
| **Backend** (FastAPI) | [Render](https://render.com) Web Service | Spins down after ~15 min idle → ~50s cold start |
| **Frontend** (static) | [Vercel](https://vercel.com) / [Netlify](https://netlify.com) / [Cloudflare Pages](https://pages.cloudflare.com) | Truly free, fast CDN |
| **Email** (magic links) | [Resend](https://resend.com) (~3k/mo) or [Brevo](https://brevo.com) (300/day) | Required in production — see below |

**Backend alternatives** if Render's cold start is a problem: **Koyeb** (one always-on
free service) or **Fly.io** (small free allowance).

## Honest caveats about "free"

- **Render cold starts** — fine for casual use, but on an actual exam day the first
  student hits a ~50s delay while the service wakes. Koyeb avoids this.
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
| `frontend/netlify.toml`, `frontend/vercel.json` | Build config + **SPA `/index.html` fallback** + an optional `/api/*` → backend rewrite (commented/placeholder). |
| `backend/runtime.txt`, `backend/.python-version` | Pin Python to **3.12.8** (better wheel coverage than 3.14, avoids source builds). |
| `backend/Procfile` | `web: uvicorn app.main:app --host 0.0.0.0 --port $PORT` for Procfile-based hosts. |
| `backend/.env.example` | Documents all env vars incl. the new `ENVIRONMENT`. |
| `.gitignore` | Keeps `.env`, `.venv/`, `node_modules/`, `dist/` out of version control. |

**Production secret guard:** set `ENVIRONMENT=production` on the backend. The app then
**refuses to boot** if `JWT_SECRET` is still `change-me` or `ADMIN_PASSWORD` is still
`admin12345`. Locally (`ENVIRONMENT=development`, the default) it only logs a warning.

**Start command** (configuration only): `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
Tables auto-create and the admin auto-bootstraps on first boot via the `lifespan` hook,
so there is **no separate migration step** to run.

**Choose how the frontend reaches the API:**
- **Option A (same-origin, no CORS):** keep the relative `/api` and add a host rewrite
  forwarding `/api/*` → your backend URL (templates in `netlify.toml` / `vercel.json`).
- **Option B (cross-origin):** set `VITE_API_BASE_URL=https://<backend>/api` at build
  time; CORS is handled by `FRONTEND_BASE_URL` on the backend.

## Step-by-step

### 1. Database — Neon

1. Create a Neon project and a database.
2. Copy the connection string and convert it to the SQLAlchemy + psycopg2 form:

   ```
   postgresql+psycopg2://USER:PASSWORD@HOST/DBNAME?sslmode=require
   ```

   (Neon gives you `postgresql://...`; add `+psycopg2` and keep `?sslmode=require`.)

### 2. Backend — Render

New **Web Service** → connect the repo, set **Root Directory** to `backend/`:

- **Build command:** `pip install -r requirements.txt`
- **Start command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- **Environment variables:**

  | Variable | Value |
  |---|---|
  | `ENVIRONMENT` | `production` (enables the default-secret guard) |
  | `DATABASE_URL` | the Neon string from step 1 |
  | `JWT_SECRET` | a long random string |
  | `ADMIN_EMAIL` | your admin login email |
  | `ADMIN_PASSWORD` | a strong password |
  | `ADMIN_NAME` | admin display name |
  | `FRONTEND_BASE_URL` | your deployed frontend URL (from step 3) |
  | `BACKEND_BASE_URL` | this service's URL |
  | `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD` / `SMTP_FROM` | from step 4 |
  | `SMTP_USE_TLS` | `true` |

After the first deploy, the backend creates its tables and bootstraps the admin account
automatically. To load demo content you can run `python -m app.seed` once (e.g. via the
Render shell), or add questions through the admin console.

### 3. Frontend — Vercel / Netlify / Cloudflare Pages

New static site → **Root Directory** `frontend/`:

- **Build command:** `npm run build`
- **Output directory:** `dist`
- **SPA fallback:** route all paths to `/index.html` (required for client-side routing).
- **API access:** apply the choice from
  [Required code changes](#required-code-changes-before-deploying):
  - *Option A* — add a rewrite, e.g. on **Netlify** (`netlify.toml`):

    ```toml
    [[redirects]]
      from = "/api/*"
      to = "https://<your-backend>.onrender.com/api/:splat"
      status = 200
      force = true

    [[redirects]]
      from = "/*"
      to = "/index.html"
      status = 200
    ```

    or on **Vercel** (`vercel.json`):

    ```json
    {
      "rewrites": [
        { "source": "/api/(.*)", "destination": "https://<your-backend>.onrender.com/api/$1" },
        { "source": "/(.*)", "destination": "/index.html" }
      ]
    }
    ```

  - *Option B* — set the build-time env var `VITE_API_BASE_URL=https://<your-backend>.onrender.com/api`
    (the bundled `netlify.toml` / `vercel.json` already configure the SPA `/index.html` fallback).

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
