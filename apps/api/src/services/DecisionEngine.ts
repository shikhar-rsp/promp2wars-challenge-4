import type { AIService } from '@atlas/ai-core';
import {
  AIDecisionDraftSchema,
  SEVERITY_WEIGHT,
  type AIDecisionDraft,
  type CrowdReading,
  type Decision,
  type DecisionCategory,
  type Incident,
  type Zone,
} from '@atlas/shared';
import { logger } from '../logger.js';
import { decisionPrompt } from './prompts.js';

interface Trigger {
  /** Stable identity so the same condition isn't re-decided every tick. */
  signature: string;
  category: DecisionCategory;
  trigger: string;
  zone: Zone | undefined;
  facts: string[];
  basePriority: number;
  /** Deterministic draft used offline or if the model output is unusable. */
  fallback: AIDecisionDraft;
}

/**
 * Turns raw operational state into ranked, explainable Decisions.
 *
 * Design: detection is DETERMINISTIC (threshold rules over crowd + incidents) —
 * reliable, testable and free of API cost. The AI is used only to PHRASE the
 * insight and recommend actions, and that call is cached and de-duplicated by
 * the AIService. If the model is unavailable or returns something invalid, a
 * deterministic fallback draft is used, so the Decision Feed never goes blank.
 */
export class DecisionEngine {
  private readonly emitted = new Map<string, Decision>();

  constructor(private readonly ai: AIService) {}

  /**
   * Evaluate current state and return the active decision set (new + still-open
   * ones), sorted by priority. Only NEW trigger signatures incur an AI call.
   */
  async evaluate(
    readings: CrowdReading[],
    incidents: Incident[],
    zoneIndex: ReadonlyMap<string, Zone>,
    now: number,
  ): Promise<Decision[]> {
    const triggers = this.detect(readings, incidents, zoneIndex);
    const activeSignatures = new Set(triggers.map((t) => t.signature));

    // Drop decisions whose trigger has cleared and weren't actioned.
    for (const [sig, decision] of this.emitted) {
      if (!activeSignatures.has(sig) && decision.status === 'proposed') {
        this.emitted.delete(sig);
      }
    }

    for (const trigger of triggers) {
      if (this.emitted.has(trigger.signature)) continue;
      const decision = await this.materialize(trigger, now);
      this.emitted.set(trigger.signature, decision);
    }

    return [...this.emitted.values()].sort((a, b) => b.priority - a.priority);
  }

  /** Update a decision's lifecycle status (accept/dismiss). */
  setStatus(id: string, status: Decision['status']): Decision | undefined {
    for (const decision of this.emitted.values()) {
      if (decision.id === id) {
        decision.status = status;
        return decision;
      }
    }
    return undefined;
  }

  current(): Decision[] {
    return [...this.emitted.values()].sort((a, b) => b.priority - a.priority);
  }

  // --- deterministic detection ----------------------------------------------

  private detect(
    readings: CrowdReading[],
    incidents: Incident[],
    zoneIndex: ReadonlyMap<string, Zone>,
  ): Trigger[] {
    const triggers: Trigger[] = [];

    // 1) Crowd-safety: any zone at/over the "crowded" threshold.
    for (const reading of readings) {
      if (reading.density < 0.9) continue;
      const zone = zoneIndex.get(reading.zoneId);
      const pct = Math.round(reading.density * 100);
      triggers.push({
        signature: `crowd:${reading.zoneId}:${reading.level}`,
        category: 'crowd-safety',
        trigger: `High crowd density in ${zone?.name ?? reading.zoneId}`,
        zone,
        basePriority: reading.level === 'critical' ? 95 : 82,
        facts: [
          `Density at ${pct}% of capacity (${reading.occupancy}/${reading.capacity})`,
          `Flow rate ${reading.flowRate > 0 ? '+' : ''}${reading.flowRate}/min`,
          reading.predictedDensity15m
            ? `Predicted ${Math.round(reading.predictedDensity15m * 100)}% in 15 min`
            : 'Trend rising',
        ],
        fallback: {
          category: 'crowd-safety',
          title: `Relieve congestion at ${zone?.name ?? reading.zoneId}`,
          insight: `${zone?.name ?? 'Zone'} is at ${pct}% capacity and rising. Proactively redirect inbound flow to prevent a dangerous bottleneck.`,
          priority: reading.level === 'critical' ? 95 : 82,
          confidence: 0.9,
          signals: [
            { label: 'Density', value: `${pct}%`, ...(zone ? { zoneId: zone.id } : {}) },
            { label: 'Flow', value: `${reading.flowRate}/min` },
          ],
          actions: [
            { label: 'Deploy stewards to meter inflow', assignTo: 'stewards', etaMinutes: 3, primary: true },
            { label: 'Open alternate concourse route', assignTo: 'facilities', etaMinutes: 5, primary: false },
          ],
        },
      });
    }

    // 2) Incident-driven: each open, medium+ incident becomes a decision.
    for (const incident of incidents) {
      if (incident.status === 'resolved') continue;
      if (SEVERITY_WEIGHT[incident.severity] < 2) continue;
      const zone = zoneIndex.get(incident.zoneId);
      const category = this.categoryFor(incident);
      triggers.push({
        signature: `incident:${incident.id}`,
        category,
        trigger: `${incident.type} incident (${incident.severity})`,
        zone,
        basePriority: 60 + SEVERITY_WEIGHT[incident.severity] * 9,
        facts: [
          incident.aiSummary ?? incident.raw,
          `Reported by ${incident.reportedBy}`,
          zone ? `At ${zone.name}` : 'Location pending',
        ],
        fallback: {
          category,
          title: `${this.titleCase(incident.type)} response at ${zone?.name ?? 'venue'}`,
          insight:
            incident.aiSummary ??
            `A ${incident.severity} ${incident.type} incident was reported. Dispatch the appropriate team and confirm on scene.`,
          priority: 60 + SEVERITY_WEIGHT[incident.severity] * 9,
          confidence: 0.85,
          signals: [
            { label: 'Type', value: incident.type, ...(zone ? { zoneId: zone.id } : {}) },
            { label: 'Severity', value: incident.severity },
          ],
          actions: [this.actionFor(incident)],
        },
      });
    }

    // 3) Transport egress: rail plaza saturating during egress.
    const rail = readings.find((r) => r.zoneId === 'transport-rail');
    if (rail && rail.density >= 0.85) {
      const zone = zoneIndex.get(rail.zoneId);
      triggers.push({
        signature: `transport:rail-surge:${rail.level}`,
        category: 'transport',
        trigger: 'Rail plaza approaching capacity',
        zone,
        basePriority: 78,
        facts: [
          `Rail plaza at ${Math.round(rail.density * 100)}% capacity`,
          'Post-match egress in progress',
        ],
        fallback: {
          category: 'transport',
          title: 'Stagger egress toward rail plaza',
          insight:
            'The NJ Transit rail plaza is nearing capacity during egress. Hold and stagger outflow from upper bowls to smooth passenger loading.',
          priority: 78,
          confidence: 0.88,
          signals: [
            { label: 'Rail load', value: `${Math.round(rail.density * 100)}%`, zoneId: rail.zoneId },
          ],
          actions: [
            { label: 'Announce staggered egress by section', assignTo: 'stewards', etaMinutes: 2, primary: true },
            { label: 'Request additional shuttle capacity', assignTo: 'transport', etaMinutes: 8, primary: false },
          ],
        },
      });
    }

    return triggers;
  }

  private async materialize(trigger: Trigger, now: number): Promise<Decision> {
    const draft = await this.draft(trigger);
    return {
      // The signature is already unique + stable per trigger, so deriving the
      // id from the FULL signature keeps ids unique (no prefix collisions) and
      // stable across re-evaluations of the same condition.
      id: `dec-${trigger.signature.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`,
      category: draft.category,
      title: draft.title,
      insight: draft.insight,
      priority: Math.round(draft.priority),
      confidence: draft.confidence,
      status: 'proposed',
      createdAt: now,
      ...(trigger.zone ? { zoneId: trigger.zone.id } : {}),
      signals: draft.signals,
      actions: draft.actions.map((a, i) => ({ ...a, id: `act-${i}` })),
      generatedBy: draft.generatedBy ?? 'unknown',
    };
  }

  /** Get an AI-phrased draft, falling back to the deterministic template. */
  private async draft(trigger: Trigger): Promise<AIDecisionDraft & { generatedBy?: string }> {
    try {
      const { data, response } = await this.ai.completeJSON(
        {
          messages: decisionPrompt({
            trigger: trigger.trigger,
            category: trigger.category,
            zone: trigger.zone,
            facts: trigger.facts,
          }),
          temperature: 0.2,
          maxTokens: 400,
          cacheNamespace: 'decision',
        },
        AIDecisionDraftSchema,
        { repairAttempts: 1 },
      );
      // Guarantee exactly one primary action.
      this.normalizeActions(data);
      return { ...data, generatedBy: response.provider };
    } catch (error) {
      logger.warn({ err: (error as Error).message, sig: trigger.signature }, 'decision.fallback');
      return { ...trigger.fallback, generatedBy: 'deterministic-fallback' };
    }
  }

  private normalizeActions(draft: AIDecisionDraft): void {
    if (!draft.actions.some((a) => a.primary) && draft.actions[0]) {
      draft.actions[0].primary = true;
    }
  }

  private categoryFor(incident: Incident): DecisionCategory {
    switch (incident.type) {
      case 'medical':
        return 'medical';
      case 'crowd-surge':
        return 'crowd-safety';
      case 'transport':
        return 'transport';
      case 'accessibility':
        return 'accessibility';
      case 'security':
        return 'security';
      default:
        return 'guest-experience';
    }
  }

  private actionFor(incident: Incident): AIDecisionDraft['actions'][number] {
    const map: Record<string, AIDecisionDraft['actions'][number]> = {
      medical: { label: 'Dispatch nearest paramedic team', assignTo: 'medical', etaMinutes: 3, primary: true },
      'crowd-surge': { label: 'Deploy stewards to meter flow', assignTo: 'stewards', etaMinutes: 2, primary: true },
      'lost-child': { label: 'Escort to Accessibility/Family desk & broadcast', assignTo: 'volunteers', etaMinutes: 4, primary: true },
      security: { label: 'Send security to assess and cordon', assignTo: 'security', etaMinutes: 3, primary: true },
      accessibility: { label: 'Dispatch facilities to restore access', assignTo: 'facilities', etaMinutes: 6, primary: true },
      transport: { label: 'Coordinate with transport control', assignTo: 'transport', etaMinutes: 5, primary: true },
    };
    return map[incident.type] ?? { label: 'Investigate and confirm', assignTo: 'stewards', etaMinutes: 5, primary: true };
  }

  private titleCase(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, ' ');
  }
}
