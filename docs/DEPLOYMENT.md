# Deployment

ATLAS is 12-factor: configuration comes from the environment, and it runs identically with or without AI keys (offline simulator fallback).

## Local (no Docker)

```bash
pnpm install
pnpm dev            # api :4000, web :3000
```

## Docker Compose (recommended)

```bash
# optional: export any provider key to enable live AI
export OPENROUTER_API_KEY=sk-...
docker compose up --build
```
- Web → <http://localhost:3000>, API → <http://localhost:4000>
- The API image ships a `HEALTHCHECK` hitting `/health`.
- `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_SOCKET_URL` are baked into the web image at build time via compose `args`; change them for non-localhost hosts.

## Building images individually

```bash
docker build -f apps/api/Dockerfile -t atlas-api .
docker build -f apps/web/Dockerfile \
  --build-arg NEXT_PUBLIC_API_URL=https://api.example.com \
  --build-arg NEXT_PUBLIC_SOCKET_URL=https://api.example.com \
  -t atlas-web .
```
> Build context is the **repo root** (both images need the workspace packages).

## Environment variables

| Var | Scope | Default | Notes |
| --- | --- | --- | --- |
| `API_PORT` / `API_HOST` | api | `4000` / `0.0.0.0` | |
| `CORS_ORIGINS` | api | `http://localhost:3000` | comma-separated allowlist |
| `SESSION_SECRET` | api | dev default | set ≥16 chars in prod |
| `OPENROUTER_API_KEY` … `GEMINI_API_KEY` | api | — | any/all optional; priority order |
| `*_MODEL` | api | sensible defaults | per-provider model override |
| `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_SOCKET_URL` | web (build) | `http://localhost:4000` | inlined at build |

## Split deploy: Vercel (web) + container host (api)

The web app and API deploy **separately** — this is the recommended production topology.

### Web → Vercel
The API is a long-lived Fastify + Socket.IO process and **cannot run on Vercel serverless functions**. Deploy only `apps/web` to Vercel:

1. Import the repo in Vercel and set **Root Directory = `apps/web`** (Project → Settings → General). This is the critical step — pointing Vercel at the repo root or `apps/api` will try to build the wrong package.
2. Vercel auto-detects Next.js; keep the default build command. It resolves the pnpm workspace (including `@atlas/shared`) automatically.
3. Add environment variables:
   - `NEXT_PUBLIC_API_URL` = your deployed API URL (e.g. `https://atlas-api.onrender.com`)
   - `NEXT_PUBLIC_SOCKET_URL` = same URL
4. Deploy.

### API → Render / Fly.io / Railway / Cloud Run
Use the provided `apps/api/Dockerfile` (build context = repo root). A one-click **Render blueprint** is included at [`render.yaml`](../render.yaml): set `CORS_ORIGINS` to your Vercel web origin, optionally add a provider key, deploy. The API runs fully in offline simulator mode with no keys.

> After both are up, set the API's `CORS_ORIGINS` to the Vercel origin and the web's `NEXT_PUBLIC_API_URL`/`NEXT_PUBLIC_SOCKET_URL` to the API origin.

## Production notes
- Put the API behind a TLS-terminating proxy; keep `trustProxy` on for correct rate-limit attribution.
- For multiple API instances, externalise cache + rate-limit to Redis and use the Socket.IO Redis adapter so realtime fans out across nodes.
- Add Supabase (URL + keys) to enable persistence and Auth — the state interface is already abstracted for it.
- Suggested hosts: web on Vercel, API on Fly.io/Render/Cloud Run. The API is a long-lived process (it owns the simulation loop + sockets), so use a container host, not serverless functions.

## CI outline
```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm --filter @atlas/web build
pnpm --filter @atlas/web exec playwright install --with-deps
pnpm test:e2e
```
