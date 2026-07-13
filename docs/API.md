# API reference

Base URL: `http://localhost:4000`. All bodies are JSON. Mutating endpoints validate with Zod and return `400 validation_error` on bad input.

## REST

### `GET /health`
Liveness + AI mode.
```json
{ "status": "ok", "aiLive": false, "time": "2026-07-13T16:00:00.000Z" }
```

### `GET /api/stadium`
Full snapshot for first paint.
```json
{ "stadium": { … }, "phase": "pre-match", "minutesToKickoff": 90,
  "readings": [ … ], "incidents": [ … ], "decisions": [ … ], "updatedAt": 0 }
```

### `GET /api/crowd`
`{ "readings": CrowdReading[] }` — current density per zone.

### `GET /api/incidents`
`{ "incidents": Incident[] }` — most recent first, AI-triaged.

### `POST /api/incidents`
Report an incident (fan/volunteer/staff). Triaged through the AI before it is stored.
```jsonc
// body
{ "type": "medical", "zoneId": "seating-100-south",
  "reportedBy": "volunteer", "raw": "Person fainted near aisle 12" }
// 201 → { "incident": Incident }   // includes aiSummary, aiRecommendedAction, detectedLanguage
```

### `GET /api/decisions`
`{ "decisions": Decision[] }` — ranked by priority.

### `POST /api/decisions/:id/status`
Accept or dismiss a decision.
```jsonc
{ "status": "accepted" }        // "proposed" | "accepted" | "dismissed" | "auto-resolved"
// → { "decision": Decision }   // 404 if unknown id
```

### `POST /api/copilot`
Context-grounded, multilingual answer.
```jsonc
// body
{ "question": "¿Dónde está el baño accesible más cercano?",
  "fan": { "fanId": "f1", "currentZoneId": "gate-a", "seatZoneId": "seating-100-north",
           "accessibilityNeeds": ["wheelchair"], "minutesToKickoff": 35 } }
// → { "answer": "…", "provider": "groq", "cached": false, "route": { … } }
```

### `POST /api/copilot/stream`
Same body; responds as **Server-Sent Events** (`text/event-stream`) with `{ "delta": "…", "done": false }` frames for a live typing effect.

### `GET /api/metrics`
AI resilience + efficiency.
```json
{ "providers": [ { "provider": "openrouter", "requests": 12, "failures": 1,
                   "cacheHits": 5, "totalTokens": 4200, "avgLatencyMs": 380,
                   "circuit": "closed" } ],
  "cache": { "hits": 40, "misses": 12, "hitRate": 0.77, "size": 33 } }
```

## Socket.IO

Connect to the API origin. On connect the server emits a full snapshot, then incremental events:

| Event | Payload | Meaning |
| --- | --- | --- |
| `snapshot` | `StadiumSnapshot` | Full state on connect |
| `crowd` | `CrowdReading[]` | New density readings (every tick) |
| `incident` | `Incident` | A new (triaged) incident |
| `decisions` | `Decision[]` | Re-ranked decision set |
| `clock` | `{ phase, minutesToKickoff }` | Match-clock advance |

All payload shapes are the Zod-inferred types exported from `@atlas/shared`.
