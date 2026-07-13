# Security

Security is treated as a first-class, medium-impact concern and implemented in depth rather than bolted on.

## Secret management
- **All AI provider keys and the Supabase service-role key live server-side only.** They are read through `apps/api/src/config.ts` and never imported into the web bundle.
- Only `NEXT_PUBLIC_*` variables reach the browser (enforced by Next.js). The web app never holds a provider key.
- Config is validated at boot with Zod; the process fails fast with a clear message on misconfiguration.
- Pino logger redacts `authorization` headers and any `*.apiKey` / `*.API_KEY` fields.

## Input validation
- **Every mutating endpoint validates its body with Zod** (`routes.ts`): incident reports, decision-status changes and copilot requests all have explicit schemas with length caps.
- Invalid input returns a structured `400 validation_error` — never a stack trace.

## Prompt-injection defense (`PromptGuard`)
Layered:
1. **Structural** — all untrusted free text (fan messages, incident reports) is wrapped in labelled `«FAN_MESSAGE … »` fences, and every system prompt instructs the model to treat fenced content as *data* and never as instructions. The wrapper strips fence characters from the payload so it cannot forge a boundary.
2. **Heuristic tripwire** — conservative regexes catch classic overrides ("ignore previous instructions", "reveal your system prompt", role-jailbreaks, delimiter escapes, secret-exfiltration) on untrusted roles only; system messages are trusted.
3. **Hard limits** — per-message and per-conversation size caps reject oversized/abusive input before it reaches a model.

## Transport & headers
- **Helmet** on the API; **security headers** on the web (`X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, a scoped `Permissions-Policy`).
- **CORS allowlist** — only the configured web origin(s) may call the API or open a socket.
- Socket.IO caps `maxHttpBufferSize` to blunt oversized frames.

## Rate limiting & abuse
- Fastify rate-limit (120 req/min/IP default) protects the AI-backed endpoints from quota-draining abuse; `trustProxy` is set for correct client attribution behind a proxy.
- The AI layer's **cache + dedup + circuit breakers** provide a second line of defence: even a burst of identical requests collapses to a single upstream call.

## Safe failure
- A single global error handler maps Zod errors to 400, rate limits to 429, and everything else to a generic `500 internal_error` with the detail logged server-side only.
- AI failures degrade gracefully (fallback decisions/triage, offline simulator) rather than surfacing internals or crashing.

## XSS / CSRF
- React escapes all rendered content; no `dangerouslySetInnerHTML` is used. Incident/copilot text is rendered as text, never HTML.
- The API is stateless/token-oriented (no cookie-based mutations in the demo), so CSRF surface is minimal; when Supabase Auth cookies are added, use `SameSite=Lax` + a CSRF token on state-changing routes.

## Recommended production hardening
- Terminate TLS at the edge; set HSTS.
- Move rate-limit + cache to Redis for multi-instance deployments.
- Add per-user auth (Supabase Auth) and role-based access (operator vs. fan surfaces).
- Enable a strict Content-Security-Policy once asset origins are fixed.
