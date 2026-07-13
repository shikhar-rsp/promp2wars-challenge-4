import { z } from 'zod';

/**
 * The Decision is ATLAS's signature primitive and the reason this is not a
 * chatbot. Instead of answering questions, the platform proactively emits
 * ranked, explainable operational decisions the operator can action in one tap.
 *
 * Every decision carries the EVIDENCE that triggered it (`signals`) so a human
 * can audit the AI's reasoning before acting — non-negotiable for a safety-
 * critical venue system.
 */
export const DecisionCategorySchema = z.enum([
  'crowd-safety',
  'medical',
  'transport',
  'accessibility',
  'sustainability',
  'security',
  'guest-experience',
]);
export type DecisionCategory = z.infer<typeof DecisionCategorySchema>;

export const DecisionStatusSchema = z.enum(['proposed', 'accepted', 'dismissed', 'auto-resolved']);
export type DecisionStatus = z.infer<typeof DecisionStatusSchema>;

/** A single piece of evidence supporting a decision (the "why"). */
export const SignalSchema = z.object({
  label: z.string(),
  value: z.string(),
  /** Optional zone this signal is anchored to, for map highlighting. */
  zoneId: z.string().optional(),
});
export type Signal = z.infer<typeof SignalSchema>;

/** A concrete, dispatchable action the operator can take. */
export const RecommendedActionSchema = z.object({
  id: z.string(),
  label: z.string(),
  /** The team/role this action would be dispatched to. */
  assignTo: z.enum(['stewards', 'medical', 'security', 'transport', 'facilities', 'volunteers']),
  /** Estimated minutes to effect if actioned now. */
  etaMinutes: z.number().int().positive(),
  /** Exactly one action per decision should be the primary/recommended one. */
  primary: z.boolean(),
});
export type RecommendedAction = z.infer<typeof RecommendedActionSchema>;

export const DecisionSchema = z.object({
  id: z.string(),
  category: DecisionCategorySchema,
  title: z.string(),
  /** One-sentence AI insight: what is happening and why it matters. */
  insight: z.string(),
  /** 0..100 composite of severity, confidence and time-criticality. */
  priority: z.number().min(0).max(100),
  /** Model confidence 0..1 in the underlying assessment. */
  confidence: z.number().min(0).max(1),
  status: DecisionStatusSchema,
  createdAt: z.number().int(),
  zoneId: z.string().optional(),
  signals: z.array(SignalSchema).min(1),
  actions: z.array(RecommendedActionSchema).min(1),
  /** Which provider produced this, for the transparency panel. */
  generatedBy: z.string(),
});
export type Decision = z.infer<typeof DecisionSchema>;

/** Shape the AI must return for a decision (server assigns id/timestamps). */
export const AIDecisionDraftSchema = z.object({
  category: DecisionCategorySchema,
  title: z.string().max(90),
  insight: z.string().max(280),
  priority: z.number().min(0).max(100),
  confidence: z.number().min(0).max(1),
  signals: z.array(SignalSchema).min(1).max(5),
  actions: z.array(RecommendedActionSchema.omit({ id: true })).min(1).max(3),
});
export type AIDecisionDraft = z.infer<typeof AIDecisionDraftSchema>;
