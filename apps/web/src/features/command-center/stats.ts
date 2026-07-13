import { densityLevel, type CrowdReading } from '@atlas/shared';

export interface AggregateStats {
  totalOccupancy: number;
  totalCapacity: number;
  fillRate: number;
  criticalZones: number;
  crowdedZones: number;
  busiestZoneId: string | null;
}

/** Derive headline KPIs from the current crowd readings. Pure + memoisable. */
export function aggregate(readings: CrowdReading[]): AggregateStats {
  let totalOccupancy = 0;
  let totalCapacity = 0;
  let criticalZones = 0;
  let crowdedZones = 0;
  let busiest: CrowdReading | null = null;

  for (const r of readings) {
    totalOccupancy += r.occupancy;
    totalCapacity += r.capacity;
    const level = densityLevel(r.density);
    if (level === 'critical') criticalZones++;
    if (level === 'crowded' || level === 'critical') crowdedZones++;
    if (!busiest || r.density > busiest.density) busiest = r;
  }

  return {
    totalOccupancy,
    totalCapacity,
    fillRate: totalCapacity === 0 ? 0 : totalOccupancy / totalCapacity,
    criticalZones,
    crowdedZones,
    busiestZoneId: busiest?.zoneId ?? null,
  };
}
