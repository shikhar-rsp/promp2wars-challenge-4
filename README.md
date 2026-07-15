# ATLAS — Stadium Intelligence & Decision Platform

![CI](https://github.com/shikhar-rsp/promp2wars-challenge-4/actions/workflows/ci.yml/badge.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6)
![Tests](https://img.shields.io/badge/tests-54_passing-2ea44f)
![License](https://img.shields.io/badge/license-MIT-blue)

> An AI **chief-of-staff** for FIFA World Cup 2026 stadium operations. Not a chatbot — a live stream of ranked, explainable operational **decisions**.

ATLAS ingests crowd, incident and transport signals and turns them into a **Decision Feed**: each card is `Signal → Insight → Recommended Action → one-tap dispatch`, every recommendation shows the evidence that triggered it, and every AI output is auditable. Alongside it runs a context-aware, multilingual **Fan Copilot** and an **AI-resilience** layer that survives provider rate limits without human intervention.

Built for the Google Prompt2Wars challenge and modelled on **MetLife Stadium**, host of the 2026 Final.

---

## Why this, and not a chatbot

Every candidate feature — lost-child reunification, transport surge, sustainability, volunteer dispatch — is a *symptom* of one root problem: **operators drown in signals but starve for decisions.** ATLAS unifies them under one novel primitive, the Decision Feed, so operators *act* instead of scroll. See the [idea evaluation](#appendix--concept-selection) at the bottom.

## Highlights

| Area | What ATLAS does |
| --- | --- |
| **Real-time decision support** | Deterministic trigger detection + AI phrasing → ranked, explainable decisions with one-tap dispatch |
| **Crowd management** | Live density map, 15-min congestion forecast, congestion-aware routing |
| **Navigation & accessibility** | Congestion- and accessibility-aware shortest-path routing (Dijkstra over the zone graph) |
| **Multilingual assistance** | Fan Copilot + incident triage in any language via LLM prompting — **no** paid translation API |
| **Operational intelligence** | Incident triage/normalisation, live ops KPIs, AI-provider resilience panel |
| **Resilience & efficiency** | 4-provider failover, response caching, request dedup, circuit breakers, prompt-injection defense |

## Tech stack

**Frontend** Next.js 15 · React 19 · TypeScript (strict) · TailwindCSS · Framer Motion · Socket.IO client
**Backend** Node.js · TypeScript · Fastify 5 · Socket.IO · Zod · Pino
**AI** Provider-pattern core (OpenRouter → Groq → Cerebras → Gemini → offline Simulator)
**Tooling** pnpm workspaces · Vitest · Playwright · Docker

---

## Monorepo layout

```
atlas/
├── apps/
│   ├── api/           # Fastify API: decision engine, triage, copilot, realtime
│   └── web/           # Next.js app: Command Center + Fan Copilot
├── packages/
│   ├── ai-core/       # Provider-pattern AI layer (failover, cache, dedup, safety)
│   └── shared/        # Domain model (zod), seed data, routing, simulation
├── docker-compose.yml
└── docs/              # Architecture, security, API, deployment
```

Each module has a single responsibility. Business logic depends only on `@atlas/ai-core`'s `AIService` and `@atlas/shared`'s domain types — never on a vendor SDK. Full walkthrough in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## Quick start

Requires **Node ≥ 20** and **pnpm ≥ 9**. **No API keys are required** — ATLAS runs fully in an offline deterministic simulator mode, so it is always demonstrable.

```bash
pnpm install
cp .env.example .env          # optional: add any AI provider key to go live
pnpm dev                      # API on :4000, web on :3000
```

Open <http://localhost:3000> → **Command Center** and **Fan Copilot**.

### One-command Docker

```bash
docker compose up --build     # web on :3000, api on :4000
```

### Enable live AI (optional)

Set **any one** of these in `.env` — ATLAS uses whichever are present, in priority order:

```
OPENROUTER_API_KEY=...   # primary
GROQ_API_KEY=...         # fallback
CEREBRAS_API_KEY=...     # fallback
GEMINI_API_KEY=...       # last resort
```

---

## The AI core (the part engineers should read first)

`packages/ai-core` is a self-contained, vendor-agnostic AI layer. Callers only ever touch `AIService`:

```ts
const ai = createAIServiceFromEnv(process.env);
const { data } = await ai.completeJSON(messages, MyZodSchema); // typed, validated
```

Behind that single call:

- **Provider pattern** — every vendor implements one `AIProvider` interface. Adding a provider is one file.
- **Automatic failover** — `OpenRouter → Groq → Cerebras → Gemini → Simulator`. A rate-limited or failing provider is skipped transparently.
- **Retry with full-jitter exponential backoff**, honouring `Retry-After`.
- **Circuit breakers** — a dead provider is short-circuited for a cooldown, then probed.
- **Response cache** (LRU + TTL) and **request deduplication** — identical/concurrent requests never hit a provider twice. This is the main defence against quota exhaustion under heavy judging traffic.
- **Structured output** — `completeJSON` enforces JSON, strips fences, validates against a Zod schema and self-repairs once.
- **Prompt-injection defense** — untrusted text is wrapped in labelled fences the system prompt treats as data, plus a heuristic tripwire and size limits.
- **Offline Simulator** — deterministic, network-free provider so everything works with zero keys.

Details in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#ai-core).

---

## Features in depth

### Command Center (`/command-center`)
- **Decision Feed** — ranked cards, expandable evidence, confidence, provider provenance, accept/dismiss with optimistic dispatch.
- **Live crowd map** — a self-contained SVG tactical view of the real zone graph, coloured by live density, critical zones pulsing, click-to-inspect. (MapLibre + OSM overlay is a documented option; the tactical view is offline, CSP-safe and reads like a real ops display.)
- **Incident stream** — AI-normalised English summaries with the *detected source language*, original text preserved for audit.
- **AI resilience panel** — per-provider request/failure counts, circuit state, cache hit rate.

### Fan Copilot (`/copilot`)
- Answers in **any language** (LLM-detected), grounded in the fan's live context (location, seat, accessibility needs, time to kickoff).
- **Accessibility-aware routing** — wheelchair users only get step-free paths.
- **Voice input** via the browser-native Web Speech API (no paid STT).

---

## Security

Input validation (Zod on every endpoint), prompt-injection defense, security headers (Helmet + Next headers), CORS allowlist, rate limiting, secret isolation (all keys server-side; only `NEXT_PUBLIC_*` reach the browser), and safe error handling that never leaks internals. Full model in [docs/SECURITY.md](docs/SECURITY.md).

## Performance & efficiency

Response caching + request dedup + conversation-scoped prompts minimise API spend; streaming responses; code splitting and `optimizePackageImports`; memoised selectors; virtualised-friendly feeds; the in-memory event-driven state loop avoids per-request recompute. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#performance).

## Testing

```bash
pnpm test            # all Vitest unit/integration suites (47 tests)
pnpm test:e2e        # Playwright smoke flows (run `pnpm --filter @atlas/web exec playwright install` first)
pnpm typecheck       # strict TS across every package
```

Coverage spans the failover/cache/dedup/guard core, the domain model & router, the decision engine (incl. deterministic fallback), and web components. See [docs/TESTING.md](docs/TESTING.md).

## Accessibility

WCAG-minded: full keyboard navigation, visible focus rings, skip link, ARIA labels on the map and controls, colour-blind-safe density ramp, `prefers-reduced-motion` support, semantic landmarks, and light/dark/high-contrast-friendly themes. See [docs/ACCESSIBILITY.md](docs/ACCESSIBILITY.md).

## Deployment

Docker images for API and web, `docker-compose up`, health checks, and 12-factor config. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## API

REST + Socket.IO reference in [docs/API.md](docs/API.md).

---

## Roadmap

- Supabase persistence + Auth behind the existing state interface (already abstracted).
- Real sensor ingestion (turnstile / Wi-Fi / CCTV people-counting) replacing the simulator — same schema, no downstream change.
- MapLibre + OSM geographic overlay toggle on the tactical map.
- Predictive evacuation planning using the existing avoid-cordon routing.
- Multi-venue tenancy and a tournament-wide operations view.

## Appendix — concept selection

Seven concepts were scored across Originality, Practicality, AI usefulness, Feasibility, Scalability, Wow and Judging potential. The **Ops Command Center / Decision Feed** won decisively because it reframes many symptom-features into one root capability (decisions, not messages), maximises the High-impact rubric axes (Code Quality + Problem Alignment), and delivers the memorable "operators watch decisions arrive" moment. Full table in the submission notes.

## License

MIT.
