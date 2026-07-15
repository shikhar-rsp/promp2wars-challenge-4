import type { AIService } from '@atlas/ai-core';
import {
  AIDecisionDraftSchema,
  type AIDecisionDraft,
  type CrowdReading,
  type Decision,
  type Incident,
  type Zone,
} from '@atlas/shared';
import { logger } from '../logger.js';
import { detectTriggers } from './decisions/detectors.js';
import type { Trigger } from './decisions/types.js';
import { decisionPrompt } from './prompts.js';

/**
 * Turns raw operational state into ranked, explainable Decisions.
 *
 * Design: detection is DETERMINISTIC and lives in the pluggable detector
 * registry (`./decisions/detectors`) — reliable, testable and free of API cost.
 * The AI is used only to PHRASE the insight and recommend actions, and that
 * call is cached and de-duplicated by the AIService. If the model is
 * unavailable or returns something invalid, a deterministic fallback draft is
 * used, so the Decision Feed never goes blank.
 *
 * The engine itself is now a thin lifecycle coordinator: detect → materialize
 * (once per new trigger) → cache → rank.
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
    const triggers = detectTriggers({ readings, incidents, zoneIndex });
    this.evictClearedTriggers(new Set(triggers.map((t) => t.signature)));

    for (const trigger of triggers) {
      if (this.emitted.has(trigger.signature)) continue;
      this.emitted.set(trigger.signature, await this.materialize(trigger, now));
    }
    return this.ranked();
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
    return this.ranked();
  }

  // --- internals -------------------------------------------------------------

  private ranked(): Decision[] {
    return [...this.emitted.values()].sort((a, b) => b.priority - a.priority);
  }

  /** Drop still-proposed decisions whose triggering condition has cleared. */
  private evictClearedTriggers(active: ReadonlySet<string>): void {
    for (const [signature, decision] of this.emitted) {
      if (!active.has(signature) && decision.status === 'proposed') {
        this.emitted.delete(signature);
      }
    }
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
      actions: draft.actions.map((action, i) => ({ ...action, id: `act-${i}` })),
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
      return { ...data, actions: ensureOnePrimary(data.actions), generatedBy: response.provider };
    } catch (error) {
      logger.warn({ err: (error as Error).message, sig: trigger.signature }, 'decision.fallback');
      return { ...trigger.fallback, generatedBy: 'deterministic-fallback' };
    }
  }
}

/** Guarantee exactly one action is marked primary (defaults to the first). */
function ensureOnePrimary(actions: AIDecisionDraft['actions']): AIDecisionDraft['actions'] {
  if (actions.some((a) => a.primary)) return actions;
  return actions.map((a, i) => ({ ...a, primary: i === 0 }));
}
