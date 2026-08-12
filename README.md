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
│   ├── Dockerfile           # production image (Azure Container Apps / Render / Railway / Fly)
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

Split across two services: **Vercel** (frontend, static) and **Azure Container Apps** (backend —
needs a host that supports long-running processes, since chat streams over SSE; serverless
platforms like Vercel Functions or GitHub Pages can't run this backend at all).

Why Container Apps and not App Service: on a brand-new / free-trial Azure subscription, App
Service (every tier, including Free/F1) and Azure Database for PostgreSQL Flexible Server both
fail with a quota error — the default quota for VM-backed compute is 0 until you add a payment
method or get a quota increase approved in the Portal (no CLI/API path for that request exists).
Container Apps is consumption-based (a different quota family) and works out of the box on a
fresh free-trial subscription, with a real free monthly grant (~180K vCPU-seconds / 360K
GiB-seconds / 2M requests). Note: a free-trial subscription typically allows only **one** Container
Apps environment total (subscription-wide, not per-region) — if you ever need to recreate it,
delete the old one first; deletion can take several minutes and occasionally gets stuck, in which
case deleting and recreating the whole resource group is faster than waiting it out.

### 1. Database + backend — one script

`deploy/azure-provision.ps1` creates the resource group, the Container Apps environment, the
Container App, and wires up every environment variable the backend needs. Database defaults to
**SQLite on an Azure Files volume** mounted into the container at `/data` — genuinely free, zero
code changes (the app already fully supports SQLite for local dev). Worth knowing: SQLite on a
network filesystem (Azure Files is SMB) is outside SQLite's officially supported configurations —
locking guarantees aren't the same as local disk. The script hardcodes `-MaxReplicas 1` specifically
to avoid concurrent multi-writer corruption; for a single-user app with one replica this is a
widely-used pattern in practice, but it is not the same durability guarantee a managed database
gives you. Pass `-DbMode external -DatabaseUrl "postgresql+asyncpg://..."` (e.g. a free
[Neon](https://neon.tech) project) instead if you want a real client-server database with no
locking caveat — same zero-code-change path, since the app already speaks `postgresql+asyncpg`.

```powershell
# One-time setup:
winget install Microsoft.AzureCLI   # then reopen the terminal
az login

cd deploy
./azure-provision.ps1 -AppName "agent-marketplace-<something-unique>"
```

`AppName` must be globally unique within your region — it becomes the Container App name and part
of its auto-generated FQDN (`https://<AppName>.<random>.<region>.azurecontainerapps.io`). If it's
taken, Azure errors on that step; re-run with a different `-AppName`.

The script prints, at the end:
- the backend URL
- the exact next steps below, personalized with your resource names

It does **not** deploy your code — only the infrastructure and its config. See what it actually
runs before trusting it with your subscription: [`deploy/azure-provision.ps1`](deploy/azure-provision.ps1).

### 2. Wire up GitHub Actions to actually deploy code

Deploys authenticate via a resource-group-scoped Azure service principal (the script creates one
named `<AppName>-deploy` with `Contributor` on just that resource group, not the whole
subscription) rather than a publish profile, since Container Apps deploys go through `az
containerapp update`, not `azure/webapps-deploy`.

1. **GitHub repo → Settings → Secrets and variables → Actions**, add three repo secrets (the
   script prints the first two, and writes the third to `deploy/azure-credentials.json`):
   - `AZURE_CONTAINERAPP_NAME` — the Container App's name (your `-AppName`)
   - `AZURE_RESOURCE_GROUP` — the resource group it's in
   - `AZURE_CREDENTIALS` — the full contents of `deploy/azure-credentials.json`
   - **Delete `deploy/azure-credentials.json` locally right after** — it's a live credential,
     already git-ignored, but don't leave it sitting on disk longer than you need to.
2. **GitHub → Actions tab → "Deploy backend to Azure Container Apps" → Run workflow.** It builds
   the Docker image from `backend/Dockerfile`, pushes it to `ghcr.io` (using the repo's own
   `GITHUB_TOKEN`), logs into Azure with the service principal, and runs `az containerapp update`
   to point the Container App at the new image.
3. After the first push, make the GHCR package public: **repo → Packages →
   `agent-marketplace-backend` → Package settings → Change visibility → Public.** Otherwise
   Container Apps can't pull a private image without extra registry credentials wired in
   separately.
4. **Azure Portal → Container Apps → your app → Containers → Environment variables**, fill in the
   two values the script left blank (these are real secrets — set them here, never in GitHub or
   in code): `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY`.
5. Confirm: `https://<your-app>.<random>.<region>.azurecontainerapps.io/health` should return
   `{"status":"ok","azure_openai_configured":true}`.

### 3. Frontend — Vercel

1. Import the GitHub repo into a new Vercel project.
2. In the project's settings, set **Root Directory** to `frontend`.
3. Add an environment variable: `VITE_API_BASE_URL` = your Container App's URL from step 2 above
   (no trailing slash, no `/api` suffix — the frontend adds that itself).
4. Deploy. `frontend/vercel.json` handles the build command, output directory, and the SPA
   rewrite React Router needs for direct links to work (e.g. loading `/agents/12` directly).
5. Once you have the Vercel URL: **Azure Portal → Container Apps → your app → Containers →
   Environment variables**, update `CORS_ORIGINS` to `["https://your-app.vercel.app"]` — otherwise
   the browser blocks the frontend's API calls.

### Where secrets actually live

| Secret | Lives in | Why |
|---|---|---|
| `AZURE_OPENAI_API_KEY`, `DATABASE_URL` | Azure Container Apps → Containers → Environment variables | Only the running backend needs these; GitHub Actions only builds and ships the container, it never runs your app or needs your OpenAI key. |
| `AZURE_CREDENTIALS` | GitHub repo secret | A resource-group-scoped service principal, used only to authenticate the deploy step — not your OpenAI key, and can't touch anything outside this one resource group. |
| `VITE_API_BASE_URL` | Vercel project → Environment Variables | Not sensitive — it's just your backend's public URL, baked into the frontend build. |

Nothing above should ever be pasted into this chat or committed to the repo — `backend/.env`,
`deploy/azure-credentials.json`, and `deploy/publish-profile.xml` are already git-ignored, and
`backend/.env.example` only holds placeholder values.

## Notes & known limitations

- Single implicit local user, no accounts yet — "installing" an agent or creating one adds it to the one shared library.
- Of the ~21 seeded skills, 5 are real callable tools (calculator, current date/time, unit converter, text analyzer, web search via DuckDuckGo); the rest are catalog entries meant to be filled in with real implementations under `backend/app/skills_impl/` + `backend/app/services/tool_registry.py`.
- Chat is one agent per conversation (no group/multi-agent collaboration yet).
