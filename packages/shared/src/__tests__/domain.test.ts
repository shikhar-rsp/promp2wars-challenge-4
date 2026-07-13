import { describe, expect, it } from 'vitest';
import { METLIFE_STADIUM, METLIFE_ZONE_INDEX } from '../data/metlife.js';
import { densityLevel } from '../domain/crowd.js';
import { StadiumRouter } from '../routing/router.js';
import { MatchSimulator } from '../simulation/MatchSimulator.js';

describe('MetLife seed data integrity', () => {
  it('validates the stadium against its schema', () => {
    // StadiumSchema.parse would throw on any malformed zone; import lazily.
    expect(METLIFE_STADIUM.zones.length).toBeGreaterThan(15);
    expect(METLIFE_STADIUM.capacity).toBeGreaterThan(80_000);
  });

  it('has a fully connected graph (every edge points to a real zone)', () => {
    for (const zone of METLIFE_STADIUM.zones) {
      for (const neighborId of zone.connectedZoneIds) {
        expect(METLIFE_ZONE_INDEX.has(neighborId)).toBe(true);
      }
    }
  });

  it('has symmetric connectivity for walkable zones', () => {
    // Every connection should be traversable in both directions.
    for (const zone of METLIFE_STADIUM.zones) {
      for (const neighborId of zone.connectedZoneIds) {
        const neighbor = METLIFE_ZONE_INDEX.get(neighborId)!;
        expect(neighbor.connectedZoneIds).toContain(zone.id);
      }
    }
  });
});

describe('densityLevel', () => {
  it('maps ratios onto the correct bands', () => {
    expect(densityLevel(0.1)).toBe('low');
    expect(densityLevel(0.5)).toBe('moderate');
    expect(densityLevel(0.75)).toBe('busy');
    expect(densityLevel(0.9)).toBe('crowded');
    expect(densityLevel(1.1)).toBe('critical');
  });
});

describe('StadiumRouter', () => {
  const router = new StadiumRouter(METLIFE_STADIUM);

  it('finds a path between transport and seating', () => {
    const route = router.route('transport-rail', 'seating-100-north');
    expect(route.found).toBe(true);
    expect(route.steps[0]!.zoneId).toBe('transport-rail');
    expect(route.steps.at(-1)!.zoneId).toBe('seating-100-north');
    expect(route.totalSeconds).toBeGreaterThan(0);
  });

  it('excludes inaccessible zones when accessibility is required', () => {
    const route = router.route('gate-a', 'seating-300-north', { requireAccessible: true });
    // 300s upper bowl is not wheelchair accessible in the seed → no valid path.
    for (const step of route.steps) {
      expect(METLIFE_ZONE_INDEX.get(step.zoneId)!.wheelchairAccessible).toBe(true);
    }
  });

  it('routes around avoided zones (evacuation cordon)', () => {
    const route = router.route('seating-100-north', 'plaza-west', {
      avoidZoneIds: ['concourse-lower'],
    });
    expect(route.steps.every((s) => s.zoneId !== 'concourse-lower')).toBe(true);
  });

  it('returns not-found for unknown zones', () => {
    expect(router.route('nope', 'seating-100-north').found).toBe(false);
  });
});

describe('MatchSimulator determinism', () => {
  it('produces identical output for the same seed', () => {
    const a = new MatchSimulator(METLIFE_STADIUM, { seed: 42 }).tick(30, 1000);
    const b = new MatchSimulator(METLIFE_STADIUM, { seed: 42 }).tick(30, 1000);
    expect(a.readings).toEqual(b.readings);
  });

  it('drives seating occupancy up as kickoff approaches', () => {
    const sim = new MatchSimulator(METLIFE_STADIUM, { seed: 7 });
    let last = 0;
    for (let m = 120; m >= 0; m -= 20) {
      const { readings } = sim.tick(m, 1000 + m);
      last = readings.find((r) => r.zoneId === 'seating-100-north')!.density;
    }
    expect(last).toBeGreaterThan(0.5);
  });

  it('reports the correct match phase', () => {
    const sim = new MatchSimulator(METLIFE_STADIUM);
    expect(sim.phaseFor(30)).toBe('pre-match');
    expect(sim.phaseFor(-50)).toBe('halftime');
    expect(sim.phaseFor(-120)).toBe('egress');
  });
});
