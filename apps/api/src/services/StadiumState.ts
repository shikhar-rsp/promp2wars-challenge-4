import type { AIService, ProviderMetrics } from '@atlas/ai-core';
import {
  MatchSimulator,
  type CrowdReading,
  type Decision,
  type Incident,
  type MatchPhase,
  type Stadium,
  type Zone,
} from '@atlas/shared';
import { TypedEventEmitter } from '../lib/TypedEventEmitter.js';
import { logger } from '../logger.js';
import { DecisionEngine } from './DecisionEngine.js';
import { IncidentTriage } from './IncidentTriage.js';

/** Tunables for the live simulation loop, named to avoid magic numbers. */
const SIMULATION = {
  /** Max incidents retained in the rolling in-memory buffer. */
  incidentBufferSize: 60,
  defaultTickMs: 4_000,
  defaultMinutesPerTick: 2,
  /** Match-clock bounds: start pre-match and loop after full egress. */
  kickoffStartMinutes: 90,
  egressEndMinutes: -120,
  loopRestartMinutes: 120,
  seed: 20260719,
} as const;

export interface StadiumSnapshot {
  stadium: Stadium;
  phase: MatchPhase;
  minutesToKickoff: number;
  readings: CrowdReading[];
  incidents: Incident[];
  decisions: Decision[];
  updatedAt: number;
}

/** Typed event map: event name → listener argument tuple. */
export type StateEvents = {
  crowd: [readings: CrowdReading[]];
  incident: [incident: Incident];
  decisions: [decisions: Decision[]];
  clock: [payload: { phase: MatchPhase; minutesToKickoff: number }];
};

/**
 * The single source of live truth for the venue. It owns the match clock and
 * the simulator, and on every tick it: refreshes crowd readings, triages any
 * new incidents through the AI, re-evaluates the decision engine, and emits
 * typed events that the realtime layer relays to connected operators.
 *
 * Everything is in-memory and event-driven — Supabase persistence can be added
 * behind the same interface without touching the simulation loop.
 */
export class StadiumState {
  private readonly events = new TypedEventEmitter<StateEvents>();
  private readonly simulator: MatchSimulator;
  private readonly triage: IncidentTriage;
  private readonly engine: DecisionEngine;
  private readonly zoneIndex: ReadonlyMap<string, Zone>;

  private readings: CrowdReading[] = [];
  private incidents: Incident[] = [];
  private decisions: Decision[] = [];
  private minutesToKickoff: number = SIMULATION.kickoffStartMinutes;
  private timer: NodeJS.Timeout | undefined;

  constructor(
    private readonly stadium: Stadium,
    private readonly ai: AIService,
    private readonly options: { tickMs?: number; minutesPerTick?: number; seed?: number } = {},
  ) {
    this.simulator = new MatchSimulator(stadium, { seed: options.seed ?? SIMULATION.seed });
    this.triage = new IncidentTriage(ai);
    this.engine = new DecisionEngine(ai);
    this.zoneIndex = new Map(stadium.zones.map((z) => [z.id, z]));
  }

  /** Subscribe to a typed state event. Returns `this` for chaining. */
  on<K extends keyof StateEvents>(event: K, listener: (...args: StateEvents[K]) => void): this {
    this.events.on(event, listener);
    return this;
  }

  /** Begin the simulation loop. Idempotent. */
  start(): void {
    if (this.timer) return;
    const tickMs = this.options.tickMs ?? SIMULATION.defaultTickMs;
    // Prime once synchronously so the first HTTP request has data.
    void this.tick();
    this.timer = setInterval(() => void this.tick(), tickMs);
    logger.info({ tickMs }, 'stadium simulation started');
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  snapshot(): StadiumSnapshot {
    return {
      stadium: this.stadium,
      phase: this.simulator.phaseFor(this.minutesToKickoff),
      minutesToKickoff: this.minutesToKickoff,
      readings: this.readings,
      incidents: this.incidents,
      decisions: this.decisions,
      updatedAt: Date.now(),
    };
  }

  getReadings(): CrowdReading[] {
    return this.readings;
  }
  getIncidents(): Incident[] {
    return this.incidents;
  }
  getDecisions(): Decision[] {
    return this.decisions;
  }
  aiMetrics(): ProviderMetrics[] {
    return this.ai.metricsSnapshot();
  }
  cacheStats(): ReturnType<AIService['cacheStats']> {
    return this.ai.cacheStats();
  }

  /** Manually inject an incident (e.g. from a fan/volunteer report endpoint). */
  async report(incident: Incident): Promise<Incident> {
    const zone = this.zoneIndex.get(incident.zoneId);
    const triaged = await this.triage.triage(incident, zone);
    this.incidents = [triaged, ...this.incidents].slice(0, SIMULATION.incidentBufferSize);
    this.events.emit('incident', triaged);
    await this.refreshDecisions();
    return triaged;
  }

  updateDecisionStatus(id: string, status: Decision['status']): Decision | undefined {
    const updated = this.engine.setStatus(id, status);
    if (updated) {
      this.decisions = this.engine.current();
      this.events.emit('decisions', this.decisions);
    }
    return updated;
  }

  // --- simulation loop -------------------------------------------------------

  private async tick(): Promise<void> {
    const now = Date.now();
    const { readings, incidents } = this.simulator.tick(this.minutesToKickoff, now);
    this.readings = readings;
    this.events.emit('crowd', readings);

    // Triage and store any newly generated incidents.
    for (const incident of incidents) {
      const zone = this.zoneIndex.get(incident.zoneId);
      const triaged = await this.triage.triage(incident, zone);
      this.incidents = [triaged, ...this.incidents].slice(0, SIMULATION.incidentBufferSize);
      this.events.emit('incident', triaged);
    }

    await this.refreshDecisions();
    this.advanceClock();
    this.events.emit('clock', {
      phase: this.simulator.phaseFor(this.minutesToKickoff),
      minutesToKickoff: this.minutesToKickoff,
    });
  }

  private async refreshDecisions(): Promise<void> {
    const openIncidents = this.incidents.filter((i) => i.status !== 'resolved');
    this.decisions = await this.engine.evaluate(this.readings, openIncidents, this.zoneIndex, Date.now());
    this.events.emit('decisions', this.decisions);
  }

  private advanceClock(): void {
    const step = this.options.minutesPerTick ?? SIMULATION.defaultMinutesPerTick;
    this.minutesToKickoff -= step;
    // Loop the match day so a demo runs indefinitely.
    if (this.minutesToKickoff < SIMULATION.egressEndMinutes) {
      this.minutesToKickoff = SIMULATION.loopRestartMinutes;
    }
  }
}
