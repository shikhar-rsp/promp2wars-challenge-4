/**
 * Tunable thresholds for deterministic decision detection. Centralised and
 * named so the rules read declaratively and can be adjusted in one place —
 * no magic numbers scattered through the detectors.
 */

/** Density ratios (0..1) at which a condition becomes decision-worthy. */
export const DENSITY = {
  /** A zone at/over this is flagged for crowd-safety action. */
  crowdedZone: 0.9,
  /** Rail plaza load at/over this triggers egress staggering. */
  railSurge: 0.85,
} as const;

/** Base priority scores (0..100) per trigger class. */
export const PRIORITY = {
  crowdCritical: 95,
  crowdHigh: 82,
  transportRail: 78,
  /** Incident priority = base + weight × per-severity step. */
  incidentBase: 60,
  incidentPerSeverityStep: 9,
} as const;

/** Model-confidence defaults for the deterministic fallback drafts. */
export const CONFIDENCE = {
  crowd: 0.9,
  incident: 0.85,
  transport: 0.88,
} as const;

/** Only incidents at or above this severity weight become decisions. */
export const MIN_INCIDENT_SEVERITY_WEIGHT = 2;

/** Well-known zone id the transport detector watches. */
export const RAIL_ZONE_ID = 'transport-rail';
