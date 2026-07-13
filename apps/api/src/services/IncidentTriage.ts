import type { AIService } from '@atlas/ai-core';
import { IncidentSeveritySchema, type Incident, type Zone } from '@atlas/shared';
import { z } from 'zod';
import { logger } from '../logger.js';
import { incidentTriagePrompt } from './prompts.js';

const TriageSchema = z.object({
  detectedLanguage: z.string(),
  summary: z.string(),
  recommendedAction: z.string(),
  severity: IncidentSeveritySchema,
});

/**
 * Normalises a raw, possibly multilingual, human incident report into a
 * structured English triage using the LLM — no dedicated translation API
 * required (multilingual prompting handles it). Falls back to the original text
 * so an AI outage never blocks incident handling.
 */
export class IncidentTriage {
  constructor(private readonly ai: AIService) {}

  async triage(incident: Incident, zone: Zone | undefined): Promise<Incident> {
    try {
      const { data, response } = await this.ai.completeJSON(
        {
          messages: incidentTriagePrompt(incident, zone),
          temperature: 0.1,
          maxTokens: 220,
          cacheNamespace: 'triage',
        },
        TriageSchema,
        { repairAttempts: 1 },
      );
      return {
        ...incident,
        severity: data.severity,
        aiSummary: data.summary,
        aiRecommendedAction: data.recommendedAction,
        detectedLanguage: data.detectedLanguage,
        updatedAt: Date.now(),
        generatedBy: response.provider,
      } as Incident & { generatedBy: string };
    } catch (error) {
      logger.warn({ err: (error as Error).message, id: incident.id }, 'triage.fallback');
      return {
        ...incident,
        aiSummary: incident.raw.slice(0, 140),
        aiRecommendedAction: 'Manual review required (AI triage unavailable).',
      };
    }
  }
}
