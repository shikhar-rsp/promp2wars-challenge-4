# Contributing to ATLAS

Thanks for your interest. This guide keeps the codebase consistent and the
quality bar high.

## Prerequisites
- Node ≥ 20, pnpm ≥ 9
- `pnpm install` at the repo root

## Workflow
1. Branch from `main`.
2. Make your change in the smallest reasonable scope.
3. Run the full quality gate locally before pushing:
   ```bash
   pnpm lint        # ESLint (flat config, TS + react-hooks)
   pnpm typecheck   # strict TypeScript, all packages
   pnpm test        # Vitest suites
   pnpm --filter @atlas/web build
   ```
   CI runs the same steps on every PR (`.github/workflows/ci.yml`) and must be green.
4. Open a PR against `main` with a clear description.

## Conventions
- **Architecture**: business logic depends only on `@atlas/ai-core`'s `AIService`
  and `@atlas/shared`'s domain types — never on a vendor SDK. See
  [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
- **Types**: strict TypeScript, no `any` (a warning-level lint rule guards this).
  Domain shapes live as zod schemas in `@atlas/shared` and are inferred, not
  hand-duplicated.
- **Formatting** is owned by Prettier (`pnpm format`); linting by ESLint. They
  don't overlap.
- **Commits**: conventional-commit style prefixes (`feat:`, `fix:`, `docs:`,
  `refactor:`, `test:`, `chore:`).
- **Tests**: add/adjust tests for behaviour changes. Prefer injected
  clocks/PRNGs/fetch so tests are deterministic and fast.

## Adding an AI provider
Implement the `AIProvider` interface in `packages/ai-core/src/providers/`, then
register it in `factory.ts`. No caller changes are needed — that's the point of
the abstraction.
