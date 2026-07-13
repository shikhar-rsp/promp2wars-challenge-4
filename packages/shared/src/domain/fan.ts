import { z } from 'zod';

/** Accessibility needs that reshape routing and copilot guidance. */
export const AccessibilityNeedSchema = z.enum([
  'wheelchair',
  'step-free',
  'low-sensory',
  'visual-assist',
  'hearing-assist',
]);
export type AccessibilityNeed = z.infer<typeof AccessibilityNeedSchema>;

/**
 * A fan's match-day context. This is what makes the copilot's advice
 * *situational* rather than generic — the same question yields a different
 * answer for a wheelchair user in section 130 than for a fan at the gate.
 */
export const FanContextSchema = z.object({
  fanId: z.string(),
  /** BCP-47 tag; if omitted the copilot detects language from the message. */
  preferredLanguage: z.string().optional(),
  seatZoneId: z.string().optional(),
  currentZoneId: z.string().optional(),
  accessibilityNeeds: z.array(AccessibilityNeedSchema).default([]),
  /** Minutes until kickoff; negative once the match is underway. */
  minutesToKickoff: z.number().optional(),
});
export type FanContext = z.infer<typeof FanContextSchema>;

export const ItineraryStepSchema = z.object({
  order: z.number().int().nonnegative(),
  time: z.string(),
  title: z.string(),
  detail: z.string(),
  zoneId: z.string().optional(),
  icon: z.enum(['transport', 'gate', 'food', 'seat', 'restroom', 'fan-zone', 'exit', 'accessibility']),
});
export type ItineraryStep = z.infer<typeof ItineraryStepSchema>;

export const ItinerarySchema = z.object({
  fanId: z.string(),
  summary: z.string(),
  steps: z.array(ItineraryStepSchema).min(1),
});
export type Itinerary = z.infer<typeof ItinerarySchema>;
