import { AIService, SimulatorProvider } from '@atlas/ai-core';
import { METLIFE_ZONE_INDEX, densityLevel, type CrowdReading, type Incident } from '@atlas/shared';
import { describe, expect, it } from 'vitest';
import { DecisionEngine } from '../DecisionEngine.js';

/** Build an engine backed by the deterministic offline provider. */
function makeEngine(): DecisionEngine {
  return new DecisionEngine(new AIService({ providers: [new SimulatorProvider()] }));
}

function reading(zoneId: string, density: number): CrowdReading {
  const zone = METLIFE_ZONE_INDEX.get(zoneId)!;
  return {
    zoneId,
    timestamp: 1000,
    occupancy: Math.round(density * zone.capacity),
    capacity: zone.capacity,
    density,
    level: densityLevel(density),
    flowRate: 120,
    predictedDensity15m: Math.min(1.2, density + 0.1),
  };
}

const incident = (over: Partial<Incident> = {}): Incident => ({
  id: 'inc-1',
  type: 'medical',
  severity: 'high',
  status: 'open',
  zoneId: 'seating-100-north',
  createdAt: 1000,
  updatedAt: 1000,
  reportedBy: 'volunteer',
  raw: 'Spectator collapsed',
  ...over,
});

describe('DecisionEngine', () => {
  it('emits a crowd-safety decision when a zone is crowded', async () => {
    const engine = makeEngine();
    const decisions = await engine.evaluate(
      [reading('concourse-lower', 0.96)],
      [],
      METLIFE_ZONE_INDEX,
      1000,
    );
    expect(decisions.some((d) => d.category === 'crowd-safety')).toBe(true);
    const d = decisions[0]!;
    expect(d.actions.filter((a) => a.primary)).toHaveLength(1);
    expect(d.signals.length).toBeGreaterThan(0);
  });

  it('does not emit for calm zones', async () => {
    const engine = makeEngine();
    const decisions = await engine.evaluate(
      [reading('concourse-lower', 0.4)],
      [],
      METLIFE_ZONE_INDEX,
      1000,
    );
    expect(decisions).toHaveLength(0);
  });

  it('creates an incident-driven decision and ranks critical highest', async () => {
    const engine = makeEngine();
    const decisions = await engine.evaluate(
      [reading('concourse-lower', 0.97)],
      [incident({ severity: 'critical', type: 'crowd-surge' })],
      METLIFE_ZONE_INDEX,
      1000,
    );
    expect(decisions.length).toBeGreaterThanOrEqual(2);
    // Sorted by priority descending.
    for (let i = 1; i < decisions.length; i++) {
      expect(decisions[i - 1]!.priority).toBeGreaterThanOrEqual(decisions[i]!.priority);
    }
  });

  it('is stable: re-evaluating the same state does not duplicate decisions', async () => {
    const engine = makeEngine();
    const state = [reading('concourse-lower', 0.96)] as const;
    const first = await engine.evaluate([...state], [], METLIFE_ZONE_INDEX, 1000);
    const second = await engine.evaluate([...state], [], METLIFE_ZONE_INDEX, 2000);
    expect(second.map((d) => d.id)).toEqual(first.map((d) => d.id));
  });

  it('falls back to a deterministic draft when the model cannot produce a valid decision', async () => {
    // The SimulatorProvider never returns a schema-valid decision, so every
    // decision must come from the deterministic fallback path.
    const engine = makeEngine();
    const decisions = await engine.evaluate(
      [reading('concourse-lower', 0.96)],
      [],
      METLIFE_ZONE_INDEX,
      1000,
    );
    expect(decisions[0]!.generatedBy).toBe('deterministic-fallback');
  });

  it('produces unique ids for multiple zones sharing a signature prefix', async () => {
    // Regression: seating-100-north / seating-100-south / seating-300-north all
    // start with "crowd:se…" — a truncated-id scheme collided here.
    const engine = makeEngine();
    const decisions = await engine.evaluate(
      [
        reading('seating-100-north', 0.96),
        reading('seating-100-south', 0.97),
        reading('seating-300-north', 0.98),
      ],
      [],
      METLIFE_ZONE_INDEX,
      1000,
    );
    const ids = decisions.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(decisions.length).toBeGreaterThanOrEqual(3);
  });

  it('updates decision lifecycle status', async () => {
    const engine = makeEngine();
    const [decision] = await engine.evaluate(
      [reading('concourse-lower', 0.96)],
      [],
      METLIFE_ZONE_INDEX,
      1000,
    );
    const updated = engine.setStatus(decision!.id, 'accepted');
    expect(updated?.status).toBe('accepted');
  });
});
