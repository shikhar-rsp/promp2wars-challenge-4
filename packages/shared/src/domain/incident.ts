import { z } from 'zod';

export const IncidentTypeSchema = z.enum([
  'medical',
  'crowd-surge',
  'lost-child',
  'security',
  'infrastructure',
  'weather',
  'transport',
  'accessibility',
]);
export type IncidentType = z.infer<typeof IncidentTypeSchema>;

export const IncidentSeveritySchema = z.enum(['info', 'low', 'medium', 'high', 'critical']);
export type IncidentSeverity = z.infer<typeof IncidentSeveritySchema>;

export const IncidentStatusSchema = z.enum(['open', 'acknowledged', 'dispatched', 'resolved']);
export type IncidentStatus = z.infer<typeof IncidentStatusSchema>;

/**
 * An operational event requiring attention. `raw` holds the original,
 * possibly multilingual, human report; `aiSummary` holds the AI-normalised
 * triage output. Keeping both preserves auditability — operators can always
 * see the source text behind any AI-generated summary.
 */
export const IncidentSchema = z.object({
  id: z.string(),
  type: IncidentTypeSchema,
  severity: IncidentSeveritySchema,
  status: IncidentStatusSchema,
  zoneId: z.string(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
  reportedBy: z.enum(['fan', 'volunteer', 'staff', 'sensor', 'security']),
  raw: z.string(),
  /** AI triage fields — populated asynchronously, hence optional. */
  aiSummary: z.string().optional(),
  aiRecommendedAction: z.string().optional(),
  detectedLanguage: z.string().optional(),
});
export type Incident = z.infer<typeof IncidentSchema>;

/** Numeric weight for sorting/aggregation. Higher = more urgent. */
export const SEVERITY_WEIGHT: Record<IncidentSeverity, number> = {
  info: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};
