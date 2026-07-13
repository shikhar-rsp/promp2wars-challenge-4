import { CrowdReadingSchema, densityLevel, type CrowdReading } from '../domain/crowd.js';
import type { Incident, IncidentSeverity, IncidentType } from '../domain/incident.js';
import { densityRatio, type Stadium, type Zone } from '../domain/stadium.js';
import { mulberry32, pick, randInt } from '../util/prng.js';

/** Coarse match phase; each phase reshapes where crowds concentrate. */
export type MatchPhase = 'pre-match' | 'kickoff' | 'first-half' | 'halftime' | 'second-half' | 'egress';

export interface SimulatorOptions {
  seed?: number;
  /** Minutes before kickoff the simulation "opens the gates". */
  gatesOpenMinutes?: number;
}

interface IncidentSeed {
  type: IncidentType;
  severity: IncidentSeverity;
  reportedBy: Incident['reportedBy'];
  raw: string;
  zoneKinds: Zone['kind'][];
}

/**
 * Deterministic match-day simulator. It owns a mutable copy of the stadium and,
 * on each {@link tick}, nudges zone occupancy according to the current match
 * phase (arrival surge, halftime concourse rush, full-time egress) and
 * occasionally emits realistic incidents. Because it is seeded, a given seed
 * reproduces the exact same match — ideal for demos and tests.
 *
 * In production these numbers would come from real turnstile / sensor feeds;
 * the simulator implements the identical schema so the rest of the platform is
 * unaware whether it is fed by sensors or by this class.
 */
export class MatchSimulator {
  private readonly rng: () => number;
  private readonly zones: Zone[];
  private readonly gatesOpenMinutes: number;

  constructor(
    stadium: Stadium,
    options: SimulatorOptions = {},
  ) {
    this.rng = mulberry32(options.seed ?? 20260719);
    this.gatesOpenMinutes = options.gatesOpenMinutes ?? 120;
    // Deep-ish clone so the simulator never mutates the seed constant.
    this.zones = stadium.zones.map((z) => ({ ...z, amenities: [...z.amenities] }));
  }

  phaseFor(minutesToKickoff: number): MatchPhase {
    if (minutesToKickoff > 0) return 'pre-match';
    const elapsed = -minutesToKickoff;
    if (elapsed < 1) return 'kickoff';
    if (elapsed < 45) return 'first-half';
    if (elapsed < 60) return 'halftime';
    if (elapsed < 105) return 'second-half';
    return 'egress';
  }

  /**
   * Advance the simulation to `minutesToKickoff` and return the current crowd
   * readings plus any incidents generated this tick.
   */
  tick(minutesToKickoff: number, nowMs: number): { readings: CrowdReading[]; incidents: Incident[] } {
    const phase = this.phaseFor(minutesToKickoff);
    for (const zone of this.zones) this.evolveZone(zone, phase, minutesToKickoff);

    const readings = this.zones.map((zone) => this.toReading(zone, nowMs));
    const incidents = this.maybeIncidents(phase, nowMs);
    return { readings, incidents };
  }

  snapshotZones(): Zone[] {
    return this.zones.map((z) => ({ ...z }));
  }

  // --- crowd evolution -------------------------------------------------------

  private evolveZone(zone: Zone, phase: MatchPhase, minutesToKickoff: number): void {
    const target = this.targetRatio(zone, phase, minutesToKickoff);
    const current = densityRatio(zone);
    // Move a fraction toward target with a little noise — smooth but lively.
    const step = (target - current) * 0.25 + (this.rng() - 0.5) * 0.04;
    const nextRatio = Math.max(0, Math.min(1.25, current + step));
    zone.currentOccupancy = Math.round(nextRatio * zone.capacity);
  }

  /** Where should this kind of zone be, as a fraction of capacity, right now? */
  private targetRatio(zone: Zone, phase: MatchPhase, minutesToKickoff: number): number {
    const arrival = Math.max(
      0,
      Math.min(1, (this.gatesOpenMinutes - minutesToKickoff) / this.gatesOpenMinutes),
    );
    switch (zone.kind) {
      case 'gate':
        return phase === 'pre-match' ? 0.55 + 0.4 * arrival : phase === 'egress' ? 0.2 : 0.08;
      case 'transport':
        return phase === 'pre-match' ? 0.4 + 0.4 * arrival : phase === 'egress' ? 0.95 : 0.15;
      case 'seating':
        return phase === 'pre-match' ? 0.2 + 0.7 * arrival : phase === 'egress' ? 0.1 : 0.9;
      case 'concourse':
        return phase === 'halftime' ? 0.95 : phase === 'egress' ? 0.85 : phase === 'pre-match' ? 0.5 : 0.35;
      case 'concession':
        return phase === 'halftime' ? 0.98 : phase === 'pre-match' ? 0.7 : 0.4;
      case 'restroom':
        return phase === 'halftime' ? 0.95 : 0.4;
      case 'fan-zone':
        return phase === 'pre-match' ? 0.75 : phase === 'egress' ? 0.3 : 0.5;
      case 'exit':
        return phase === 'egress' ? 0.8 : 0.02;
      default:
        return 0.3;
    }
  }

  private toReading(zone: Zone, nowMs: number): CrowdReading {
    const density = densityRatio(zone);
    return CrowdReadingSchema.parse({
      zoneId: zone.id,
      timestamp: nowMs,
      occupancy: zone.currentOccupancy,
      capacity: zone.capacity,
      density,
      level: densityLevel(density),
      flowRate: Math.round((this.rng() - 0.4) * 200),
      predictedDensity15m: Math.max(0, Math.min(1.25, density + (this.rng() - 0.45) * 0.2)),
    });
  }

  // --- incidents -------------------------------------------------------------

  private static readonly INCIDENT_SEEDS: IncidentSeed[] = [
    {
      type: 'medical',
      severity: 'high',
      reportedBy: 'volunteer',
      raw: 'Spectator collapsed, appears to have fainted in the heat, needs medical attention.',
      zoneKinds: ['seating', 'concourse', 'fan-zone'],
    },
    {
      type: 'lost-child',
      severity: 'high',
      reportedBy: 'fan',
      raw: 'Niño perdido, 6 años, camiseta de Argentina, visto por última vez cerca de la comida.',
      zoneKinds: ['concourse', 'concession', 'fan-zone'],
    },
    {
      type: 'crowd-surge',
      severity: 'critical',
      reportedBy: 'sensor',
      raw: 'Density threshold exceeded — sustained pushing reported at the concourse funnel.',
      zoneKinds: ['concourse', 'gate'],
    },
    {
      type: 'accessibility',
      severity: 'medium',
      reportedBy: 'staff',
      raw: 'Elevator out of service; wheelchair users cannot reach upper concourse.',
      zoneKinds: ['concourse', 'accessibility'],
    },
    {
      type: 'transport',
      severity: 'medium',
      reportedBy: 'staff',
      raw: 'Rail platform backing up, next train delayed 12 minutes.',
      zoneKinds: ['transport'],
    },
    {
      type: 'security',
      severity: 'low',
      reportedBy: 'security',
      raw: 'Unattended bag reported near the west concession stand.',
      zoneKinds: ['concession', 'concourse'],
    },
  ];

  /** Emit incidents probabilistically, biased toward congested zones + phase. */
  private maybeIncidents(phase: MatchPhase, nowMs: number): Incident[] {
    const baseChance = phase === 'halftime' || phase === 'egress' ? 0.5 : phase === 'pre-match' ? 0.35 : 0.2;
    if (this.rng() > baseChance) return [];

    const seed = pick(this.rng, MatchSimulator.INCIDENT_SEEDS);
    const candidates = this.zones.filter((z) => seed.zoneKinds.includes(z.kind));
    if (candidates.length === 0) return [];
    // Prefer the most congested candidate zone — that's where trouble clusters.
    const zone = candidates.sort((a, b) => densityRatio(b) - densityRatio(a))[0]!;

    const incident: Incident = {
      id: `inc-${nowMs.toString(36)}-${randInt(this.rng, 100, 999)}`,
      type: seed.type,
      severity: seed.severity,
      status: 'open',
      zoneId: zone.id,
      createdAt: nowMs,
      updatedAt: nowMs,
      reportedBy: seed.reportedBy,
      raw: seed.raw,
    };
    return [incident];
  }
}
