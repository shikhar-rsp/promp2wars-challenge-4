import { METLIFE_ZONE_INDEX, densityLevel, type CrowdReading, type Incident } from '@atlas/shared';
import { describe, expect, it } from 'vitest';
import { DECISION_DETECTORS, detectTriggers } from '../detectors.js';
import type { DetectionContext } from '../types.js';

function reading(zoneId: string, density: number): CrowdReading {
  const zone = METLIFE_ZONE_INDEX.get(zoneId)!;
  return {
    zoneId,
    timestamp: 0,
    occupancy: Math.round(density * zone.capacity),
    capacity: zone.capacity,
    density,
    level: densityLevel(density),
    flowRate: 100,
  };
}

const ctx = (over: Partial<DetectionContext> = {}): DetectionContext => ({
  readings: [],
  incidents: [],
  zoneIndex: METLIFE_ZONE_INDEX,
  ...over,
});

const incident = (over: Partial<Incident> = {}): Incident => ({
  id: 'inc-1',
  type: 'medical',
  severity: 'high',
  status: 'open',
  zoneId: 'seating-100-north',
  createdAt: 0,
  updatedAt: 0,
  reportedBy: 'volunteer',
  raw: 'x',
  ...over,
});

describe('decision detectors', () => {
  it('exposes a non-empty, extensible registry', () => {
    expect(DECISION_DETECTORS.length).toBeGreaterThanOrEqual(3);
  });

  it('crowd detector fires only at/above the crowded threshold', () => {
    expect(detectTriggers(ctx({ readings: [reading('concourse-lower', 0.5)] }))).toHaveLength(0);
    const hot = detectTriggers(ctx({ readings: [reading('concourse-lower', 0.95)] }));
    expect(hot).toHaveLength(1);
    expect(hot[0]!.category).toBe('crowd-safety');
  });

  it('incident detector ignores low severity and resolved incidents', () => {
    expect(detectTriggers(ctx({ incidents: [incident({ severity: 'low' })] }))).toHaveLength(0);
    expect(detectTriggers(ctx({ incidents: [incident({ status: 'resolved' })] }))).toHaveLength(0);
    expect(detectTriggers(ctx({ incidents: [incident()] }))).toHaveLength(1);
  });

  it('transport detector watches the rail plaza during surge', () => {
    expect(detectTriggers(ctx({ readings: [reading('transport-rail', 0.5)] }))).toHaveLength(0);
    // 0.87 is above the rail-surge threshold but below the crowded threshold,
    // so only the transport detector fires (not crowd-safety).
    const surge = detectTriggers(ctx({ readings: [reading('transport-rail', 0.87)] }));
    expect(surge).toHaveLength(1);
    expect(surge[0]!.category).toBe('transport');
  });

  it('every fallback draft has exactly one primary action', () => {
    const triggers = detectTriggers(
      ctx({ readings: [reading('concourse-lower', 0.95)], incidents: [incident()] }),
    );
    for (const t of triggers) {
      expect(t.fallback.actions.filter((a) => a.primary)).toHaveLength(1);
    }
  });
});
