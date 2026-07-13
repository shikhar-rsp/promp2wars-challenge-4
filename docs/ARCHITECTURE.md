# Architecture

ATLAS follows clean-architecture principles: dependencies point inward toward the domain, and infrastructure (AI vendors, transport, persistence) is swappable behind interfaces.

## System overview

```
┌────────────────────────────────────────────────────────────────────┐
│                          Browser (Next.js)                          │
│   Command Center  ·  Fan Copilot                                    │
│      │  HTTP (hydrate)      │  Socket.IO (live)      │  REST         │
└──────┼─────────────────────┼────────────────────────┼──────────────┘
       ▼                     ▼                        ▼
┌────────────────────────────────────────────────────────────────────┐
│                        Fastify API (@atlas/api)                     │
│  routes ─▶ services:  StadiumState  ·  DecisionEngine               │
│                       IncidentTriage · CopilotService              │
│  security: helmet · cors · rate-limit · zod · error handler        │
│                       │                                             │
│                       ▼  (depends only on the interface)           │
│              ┌──────────────────────────────┐                      │
│              │      AIService (@atlas/ai-core)                     │
│              │  failover · retry · cache · dedup · guard · metrics │
│              └──────────────────────────────┘                      │
│                 │        │        │        │        │              │
│           OpenRouter   Groq   Cerebras   Gemini   Simulator        │
└────────────────────────────────────────────────────────────────────┘
              ▲
              │  domain model · seed data · routing · simulation
        @atlas/shared  (zod schemas — single source of truth for types)
```

## Packages

### `@atlas/shared` — the domain
Zod schemas are the single source of truth for **both** compile-time types (`z.infer`) and runtime validation, shared verbatim by API and web — no drift. Contains:
- **Domain**: `Stadium`/`Zone`, `CrowdReading`, `Incident`, `Decision` (the signature primitive), `FanContext`/`Itinerary`.
- **Seed data**: a realistic MetLife Stadium zone graph (`METLIFE_STADIUM`), normalised to be bidirectional.
- **Routing**: `StadiumRouter` — congestion-aware Dijkstra with accessibility filtering and avoid-cordons.
- **Simulation**: `MatchSimulator` — deterministic (seeded) match-day crowd evolution + incident generation on the same schema real sensors would use.

### `@atlas/ai-core` — the AI layer
See below. Depends on nothing but `zod`.

### `@atlas/api` — orchestration
Thin routes → focused services. `StadiumState` owns the match clock + simulator and, each tick, refreshes crowd, triages new incidents through the AI, re-evaluates the decision engine and emits typed events to the realtime layer.

### `@atlas/web` — presentation
App Router, feature-sliced (`features/command-center`, `features/copilot`), reusable `components/ui` primitives, `hooks` for realtime and speech.

## AI core

The crown jewel. Business logic calls **only** `AIService`:

```
AIService.complete(req)
  ├─ PromptGuard.inspect            (injection + size limits)
  ├─ cache lookup (if cacheable & low-temp)
  ├─ RequestDeduplicator            (coalesce concurrent identical calls)
  └─ routeWithFailover
        for each configured, circuit-closed provider (in priority order):
          withRetry(exponential backoff, honours Retry-After)
            provider.complete()  ──▶ success ▶ record metrics, cache, return
          on failure ▶ trip breaker, record, fail over to next
        exhausted ▶ AllProvidersFailedError
```

- **`AIProvider`** interface: `isConfigured / complete / stream`. Concrete providers: three OpenAI-compatible (OpenRouter/Groq/Cerebras) share `OpenAICompatibleProvider`; Gemini implements the interface directly; `SimulatorProvider` is the always-on offline terminal.
- **`completeJSON`**: enforces JSON, strips code fences, validates with Zod, self-repairs once — this is why `DecisionEngine` and `IncidentTriage` can treat model output as trustworthy structured data.
- **Efficiency levers**: `ResponseCache` (LRU+TTL), `RequestDeduplicator`, temperature-gated caching, per-provider metrics surfaced to the ops dashboard.

### Decision engine — hybrid design
Detection is **deterministic** (threshold rules over crowd + incidents): reliable, testable, zero API cost. The AI only **phrases** the insight and actions, and that call is cached/deduped. If the model is unavailable or invalid, a **deterministic fallback draft** is used — so the Decision Feed never goes blank, online or offline.

## Realtime
`StadiumState extends EventEmitter`. The Socket.IO layer is a pure relay: new clients get a full snapshot for instant paint, then incremental `crowd` / `incident` / `decisions` / `clock` events. Simulation logic and transport are fully decoupled.

## Performance
- **Caching + dedup** collapse repeated AI work (the dominant cost).
- **Event-driven state**: one simulation loop updates in-memory state; HTTP/socket reads are O(1).
- **Client**: code splitting per route, `optimizePackageImports` for icons/motion, memoised selectors (`aggregate`, projection), snapshot-hydrate-then-stream so the first paint never waits on the socket.
- **Streaming** copilot responses over SSE for perceived latency.

## Extensibility
- **Persistence**: swap the in-memory arrays in `StadiumState` for Supabase behind the same methods.
- **New AI vendor**: add one `AIProvider` file and register it in the factory.
- **Real sensors**: feed `CrowdReading`/`Incident` from ingestion instead of `MatchSimulator` — identical schema.
