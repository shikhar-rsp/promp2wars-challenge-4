/**
 * Re-export the shared domain types for the client, plus a couple of
 * transport-shaped types that mirror the API responses. The client depends on
 * the SAME domain model as the server — no drift.
 */
export type {
  CrowdReading,
  Decision,
  DecisionCategory,
  Incident,
  IncidentSeverity,
  IncidentType,
  FanContext,
  AccessibilityNeed,
  Route,
  RouteStep,
  Stadium,
  Zone,
  MatchPhase,
  DensityLevel,
} from '@atlas/shared';

import type {
  CrowdReading,
  Decision,
  Incident,
  MatchPhase,
  Stadium,
} from '@atlas/shared';

/** Mirrors the API's /api/stadium payload. */
export interface StadiumSnapshot {
  stadium: Stadium;
  phase: MatchPhase;
  minutesToKickoff: number;
  readings: CrowdReading[];
  incidents: Incident[];
  decisions: Decision[];
  updatedAt: number;
}

/** Mirrors a provider metrics row from /api/metrics. */
export interface ProviderMetricsLike {
  provider: string;
  requests: number;
  failures: number;
  cacheHits: number;
  totalTokens: number;
  avgLatencyMs: number;
  circuit: 'closed' | 'open' | 'half-open';
}
