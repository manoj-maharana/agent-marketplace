# Agent Marketplace

A from-scratch AI agent marketplace, skills marketplace, and multi-agent chat app.
React + TypeScript frontend, FastAPI backend, PostgreSQL, and Azure OpenAI for the LLM layer.

- **Agent Marketplace** — browse, search, and filter ready-made agents by category; add any of them to your personal library with one click.
- **Skill Marketplace** — browse tools ("skills") agents can call mid-conversation. Skills tagged **Live** are wired up end to end (calculator, web search, unit converter, text analyzer, current date/time); the rest are catalog entries you can extend.
- **Chat** — pick any agent from your library and chat with it. Responses stream token-by-token; when an agent has Live skills enabled, it can call them mid-answer (Azure OpenAI function/tool calling) and you'll see the tool call happen live.
- **Create Agent** — define your own agent: name, avatar, category, system prompt, temperature, and which skills it can use. It's chat-ready immediately.

No user accounts in v1 — it's a single-user local app. Auth can be layered on later.

## Tech stack

- **Backend**: FastAPI, SQLAlchemy 2.0 (async), PostgreSQL (via Docker) or SQLite (zero-setup local dev), the `openai` SDK in Azure mode for streaming + tool calling.
- **Frontend**: Vite, React 19, TypeScript, React Router, TanStack Query, Zustand-ready, Tailwind CSS v4, lucide-react.

## Project structure

```
agent-marketplace/
├── docker-compose.yml       # Postgres + backend
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI app
│   │   ├── models.py        # SQLAlchemy models
│   │   ├── routers/         # agents, skills, categories, chat, mcp, experimental/*
│   │   ├── framework/       # Agent/BaseSkill runtime, skill_loader, agent_group_runner
│   │   ├── skills/          # one self-contained package per skill: SKILL.md (+ tool.py)
│   │   ├── locales/en-US/   # seed content: one JSON file per agent category, plus MCP
│   │   └── seed.py          # loads locales/<locale>/ + skills/ into the DB on first boot
│   ├── Dockerfile           # production image (Azure App Service / Render / Railway / Fly)
│   └── tests/                # pytest smoke tests (sqlite, no Docker needed)
└── frontend/
    └── src/
        ├── api/              # react-query hooks + SSE chat client
        ├── components/       # AgentCard, SkillCard, ChatMessage, ui/...
        └── pages/            # AgentMarketplace, SkillMarketplace, Chat, CreateAgent
```

## Running it

### 1. Backend

**Option A — Docker (Postgres, matches production):**

```bash
cp backend/.env.example backend/.env   # fill in your Azure OpenAI credentials
docker compose up --build
```

Backend is now on `http://localhost:8000`.

**Option B — zero-setup local dev (SQLite, no Docker):**

```bash
cd backend
python -m venv .venv
.venv/Scripts/activate        # Windows; use `source .venv/bin/activate` on macOS/Linux
pip install -r requirements.txt
cp .env.example .env
```

Then edit `backend/.env`:
```
DATABASE_URL=sqlite+aiosqlite:///./dev.db
```

```bash
uvicorn app.main:app --reload --port 8000
```

Either way, the database auto-seeds itself with sample categories/agents/skills on first boot — no manual migration step needed.

### 2. Azure OpenAI

Chat won't work until you fill these into `backend/.env`:

```
AZURE_OPENAI_ENDPOINT=https://YOUR-RESOURCE-NAME.openai.azure.com
AZURE_OPENAI_API_KEY=your-azure-openai-key
AZURE_OPENAI_API_VERSION=2024-10-21
AZURE_OPENAI_DEPLOYMENT=gpt-4o   # your Azure *deployment* name, not the base model name
```

Restart the backend after editing. Until it's configured, chat still works end-to-end but returns a clear inline message telling you what to set.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. The dev server proxies `/api` to `http://localhost:8000`.

### Tests

```bash
cd backend
pytest
```

Runs against an isolated SQLite file — no Postgres/Docker required.

## Deployment

Split across three services: **Vercel** (frontend, static), **Azure App Service** (backend,
a Linux container — needs a host that supports long-running processes, since chat streams over
SSE; serverless platforms like Vercel Functions or GitHub Pages can't run this backend at all),
and a **hosted Postgres** (SQLite only ever worked for local dev — there's no shared disk across
a multi-instance/serverless deployment).

### 1. Database — Neon or Supabase (either works; steps below use Neon)

1. Create a free project at [neon.tech](https://neon.tech). Copy the connection string it gives you.
2. Adjust it for SQLAlchemy's async driver: change `postgresql://` to `postgresql+asyncpg://`.
   If the string has a `?sslmode=require` suffix, drop it — asyncpg doesn't parse libpq-style
   `sslmode`; if the connection then fails to negotiate SSL, check Neon's asyncpg-specific
   connection docs for the right query param (this varies by asyncpg version, hasn't been
   tested against a live Neon instance here).
3. Keep the resulting URL somewhere safe — it goes into Azure App Service's settings in step 2,
   never into git.

### 2. Backend — Azure App Service

1. **Azure Portal → Create a resource → Web App**: Publish = *Docker Container*, OS = *Linux*,
   pick a region and plan (B1 Basic is a reasonable starting size).
2. Once created: **App Service → Overview → Get publish profile** (downloads an XML file).
3. **GitHub repo → Settings → Secrets and variables → Actions**, add two repo secrets:
   - `AZURE_WEBAPP_NAME` — the App Service's name
   - `AZURE_WEBAPP_PUBLISH_PROFILE` — the full contents of the downloaded XML file
4. **App Service → Configuration → Application settings** — add these directly in Azure
   (this is where your real secrets live, not in GitHub or in code):
   - `DATABASE_URL` — the `postgresql+asyncpg://...` string from step 1
   - `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_API_VERSION`, `AZURE_OPENAI_DEPLOYMENT`
   - `AZURE_OPENAI_EMBEDDING_DEPLOYMENT` (optional, only needed for the knowledge-base feature)
   - `CORS_ORIGINS` — `["https://your-app.vercel.app"]` (fill in once you have the Vercel URL from step 3)
   - `WEBSITES_PORT` — `8000` (tells App Service which port the container listens on)
5. **GitHub → Actions tab → "Deploy backend to Azure App Service" → Run workflow.** It builds
   the Docker image from `backend/Dockerfile`, pushes it to `ghcr.io` (using the repo's own
   `GITHUB_TOKEN`, no extra registry credentials needed), and deploys it to your App Service.
6. Confirm: `https://<your-app-name>.azurewebsites.net/health` should return
   `{"status":"ok","azure_openai_configured":true}`.

### 3. Frontend — Vercel

1. Import the GitHub repo into a new Vercel project.
2. In the project's settings, set **Root Directory** to `frontend`.
3. Add an environment variable: `VITE_API_BASE_URL` = `https://<your-app-name>.azurewebsites.net`
   (no trailing slash, no `/api` suffix — the frontend adds that itself).
4. Deploy. `frontend/vercel.json` handles the build command, output directory, and the SPA
   rewrite React Router needs for direct links to work (e.g. loading `/agents/12` directly).
5. Once you have the Vercel URL, go back to Azure App Service's `CORS_ORIGINS` setting, add it,
   and restart the App Service — otherwise the browser will block the frontend's API calls.

### Where secrets actually live

| Secret | Lives in | Why |
|---|---|---|
| `AZURE_OPENAI_API_KEY`, `DATABASE_URL` | Azure App Service → Configuration | Only the running backend needs these; GitHub Actions only builds and ships the container, it never runs your app or needs your OpenAI key. |
| `AZURE_WEBAPP_PUBLISH_PROFILE` | GitHub repo secret | Azure's own deploy credential, used only to authenticate the deploy step — not your OpenAI key. |
| `VITE_API_BASE_URL` | Vercel project → Environment Variables | Not sensitive — it's just your backend's public URL, baked into the frontend build. |

Nothing above should ever be pasted into this chat or committed to the repo — `backend/.env` is
already git-ignored, and `backend/.env.example` only holds placeholder values.

## Notes & known limitations

- Single implicit local user, no accounts yet — "installing" an agent or creating one adds it to the one shared library.
- Of the ~21 seeded skills, 5 are real callable tools (calculator, current date/time, unit converter, text analyzer, web search via DuckDuckGo); the rest are catalog entries meant to be filled in with real implementations under `backend/app/skills_impl/` + `backend/app/services/tool_registry.py`.
- Chat is one agent per conversation (no group/multi-agent collaboration yet).
