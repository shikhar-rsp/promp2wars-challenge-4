import type { AIDecisionDraft, CrowdReading, DecisionCategory, Incident, Zone } from '@atlas/shared';

/**
 * A detected operational condition worth deciding on. Detection is
 * deterministic; the AI only phrases the final decision from this evidence.
 */
export interface Trigger {
  /** Stable identity so the same condition isn't re-decided every tick. */
  signature: string;
  category: DecisionCategory;
  /** Short natural-language description of what fired, fed to the AI. */
  trigger: string;
  zone: Zone | undefined;
  facts: string[];
  /** Deterministic draft used offline or if the model output is unusable. */
  fallback: AIDecisionDraft;
}

/** Read-only view of current venue state passed to every detector. */
export interface DetectionContext {
  readings: CrowdReading[];
  incidents: Incident[];
  zoneIndex: ReadonlyMap<string, Zone>;
}

/**
 * A pure function that inspects venue state and emits zero or more triggers.
 *
 * This is the extension point: adding a new class of decision means adding one
 * detector to the registry — no existing code changes (open/closed principle).
 */
export type TriggerDetector = (context: DetectionContext) => Trigger[];
