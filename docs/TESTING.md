# Testing

```bash
pnpm test          # all Vitest suites across packages (47 tests)
pnpm typecheck     # strict TS, every package
pnpm test:e2e      # Playwright (see note below)
```

## What is covered

### `@atlas/ai-core` (24 tests)
The reliability-critical core:
- **Failover** — first healthy provider wins; fails over on rate limit; fails over past non-retryable request errors (bad key); skips unconfigured providers; `AllProvidersFailedError` when all fail.
- **Caching & dedup** — identical cacheable requests served from cache; high-temperature requests bypass cache; concurrent identical requests coalesce to one upstream call.
- **Retry** — retryable failures retry the same provider before failover.
- **`completeJSON`** — parses fenced JSON, validates a Zod schema, self-repairs malformed JSON, throws when never valid.
- **Prompt safety** — injection attempts blocked before any provider call.
- **Metrics** — per-provider request/failure/cache-hit accounting.

### `@atlas/shared` (11 tests)
- Seed-data integrity: schema validity, fully-connected graph, **symmetric** connectivity.
- `densityLevel` band mapping.
- `StadiumRouter`: finds paths, enforces accessibility, routes around avoid-cordons, handles unknown zones.
- `MatchSimulator`: **determinism** by seed, arrival surge behaviour, phase mapping.

### `@atlas/api` (6 tests)
- `DecisionEngine`: emits crowd-safety decisions above threshold; silent when calm; incident-driven decisions ranked with critical highest; **stable** (no duplicate decisions on re-evaluation); **deterministic fallback** when the model can't produce a valid decision; lifecycle status updates.

### `@atlas/web` (6 tests)
- `utils`: class merging, duration + match-clock formatting.
- `DecisionFeed`: empty state, card render with insight + primary action, dispatched status.

## E2E (Playwright)
`apps/web/e2e/smoke.spec.ts` drives the real flows against both servers (offline mode, no keys needed): landing value prop, Command Center hydration + live map, and a Fan Copilot round-trip. Playwright boots the API and web via `webServer`.

First run needs browsers:
```bash
pnpm --filter @atlas/web exec playwright install
pnpm test:e2e
```

## Philosophy
Tests target behaviour that matters operationally (failover, determinism, fallback, validation) rather than implementation detail, and use injected clocks/PRNGs/fetch so they run in milliseconds with no network.
