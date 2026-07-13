import { z } from 'zod';

/** WGS84 coordinate. Kept as a tuple to match GeoJSON [lng, lat] ordering. */
export const GeoPointSchema = z.object({
  lng: z.number().min(-180).max(180),
  lat: z.number().min(-90).max(90),
});
export type GeoPoint = z.infer<typeof GeoPointSchema>;

/** Functional classification of a stadium zone, drives routing and iconography. */
export const ZoneKindSchema = z.enum([
  'gate',
  'concourse',
  'seating',
  'concession',
  'restroom',
  'medical',
  'transport',
  'accessibility',
  'fan-zone',
  'security',
  'exit',
]);
export type ZoneKind = z.infer<typeof ZoneKindSchema>;

/**
 * A physical area of the venue. `capacity` and `currentOccupancy` let us derive
 * a density ratio without another lookup. Zones connect via `connectedZoneIds`,
 * forming the walkable graph the routing engine traverses.
 */
export const ZoneSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: ZoneKindSchema,
  /** Concourse level: 100 (lower), 200 (mid), 300 (upper), 0 (ground/plaza). */
  level: z.number().int(),
  center: GeoPointSchema,
  capacity: z.number().int().positive(),
  currentOccupancy: z.number().int().nonnegative(),
  connectedZoneIds: z.array(z.string()),
  /** Average seconds to traverse this zone on foot when uncongested. */
  baseTraversalSeconds: z.number().positive(),
  wheelchairAccessible: z.boolean(),
  amenities: z.array(z.string()).default([]),
});
export type Zone = z.infer<typeof ZoneSchema>;

export const StadiumSchema = z.object({
  id: z.string(),
  name: z.string(),
  city: z.string(),
  country: z.string(),
  capacity: z.number().int().positive(),
  center: GeoPointSchema,
  /** Bounding box for the map view: [southWest, northEast]. */
  bounds: z.tuple([GeoPointSchema, GeoPointSchema]),
  zones: z.array(ZoneSchema),
});
export type Stadium = z.infer<typeof StadiumSchema>;

/** Occupancy ratio in [0,1]; >1 is possible transiently at a bottleneck. */
export function densityRatio(zone: Pick<Zone, 'capacity' | 'currentOccupancy'>): number {
  return zone.capacity === 0 ? 0 : zone.currentOccupancy / zone.capacity;
}
