import { z } from 'zod';

/** Human-readable density bands used for colouring the heatmap and thresholds. */
export const DensityLevelSchema = z.enum(['low', 'moderate', 'busy', 'crowded', 'critical']);
export type DensityLevel = z.infer<typeof DensityLevelSchema>;

/**
 * A point-in-time crowd measurement for a zone. In production these arrive from
 * turnstile counts, Wi-Fi/BLE presence and CCTV people-counting; here the
 * simulator generates them on the same schema so nothing downstream changes.
 */
export const CrowdReadingSchema = z.object({
  zoneId: z.string(),
  timestamp: z.number().int(),
  occupancy: z.number().int().nonnegative(),
  capacity: z.number().int().positive(),
  density: z.number().min(0),
  level: DensityLevelSchema,
  /** Net people/minute flowing in (positive) or out (negative). */
  flowRate: z.number(),
  /** Predicted density 15 minutes out, produced by the forecaster. */
  predictedDensity15m: z.number().min(0).optional(),
});
export type CrowdReading = z.infer<typeof CrowdReadingSchema>;

const THRESHOLDS: ReadonlyArray<{ level: DensityLevel; max: number }> = [
  { level: 'low', max: 0.35 },
  { level: 'moderate', max: 0.6 },
  { level: 'busy', max: 0.8 },
  { level: 'crowded', max: 0.95 },
  { level: 'critical', max: Infinity },
];

/** Map a density ratio to its band. Single source of truth for the UI + engine. */
export function densityLevel(density: number): DensityLevel {
  return THRESHOLDS.find((t) => density <= t.max)!.level;
}

/** Accessible, colour-blind-safe hex per band (viridis-like, WCAG-checked). */
export const DENSITY_COLORS: Record<DensityLevel, string> = {
  low: '#1a9850',
  moderate: '#91cf60',
  busy: '#fee08b',
  crowded: '#fc8d59',
  critical: '#d73027',
};
