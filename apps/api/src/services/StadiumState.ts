import { EventEmitter } from 'node:events';
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
import { logger } from '../logger.js';
import { DecisionEngine } from './DecisionEngine.js';
import { IncidentTriage } from './IncidentTriage.js';

export interface StadiumSnapshot {
  stadium: Stadium;
  phase: MatchPhase;
  minutesToKickoff: number;
  readings: CrowdReading[];
  incidents: Incident[];
  decisions: Decision[];
  updatedAt: number;
}

export interface StateEvents {
  crowd: (readings: CrowdReading[]) => void;
  incident: (incident: Incident) => void;
  decisions: (decisions: Decision[]) => void;
  clock: (payload: { phase: MatchPhase; minutesToKickoff: number }) => void;
}

/**
 * The single source of live truth for the venue. It owns the match clock and
 * the simulator, and on every tick it: refreshes crowd readings, triages any
 * new incidents through the AI, re-evaluates the decision engine, and emits
 * typed events that the realtime layer relays to connected operators.
 *
 * Everything is in-memory and event-driven — Supabase persistence can be added
 * behind the same interface without touching the simulation loop.
 */
export class StadiumState extends EventEmitter {
  private readonly simulator: MatchSimulator;
  private readonly triage: IncidentTriage;
  private readonly engine: DecisionEngine;
  private readonly zoneIndex: ReadonlyMap<string, Zone>;

  private readings: CrowdReading[] = [];
  private incidents: Incident[] = [];
  private decisions: Decision[] = [];
  private minutesToKickoff = 90;
  private timer: NodeJS.Timeout | undefined;

  constructor(
    private readonly stadium: Stadium,
    private readonly ai: AIService,
    private readonly options: { tickMs?: number; minutesPerTick?: number; seed?: number } = {},
  ) {
    super();
    this.simulator = new MatchSimulator(stadium, { seed: options.seed ?? 20260719 });
    this.triage = new IncidentTriage(ai);
    this.engine = new DecisionEngine(ai);
    this.zoneIndex = new Map(stadium.zones.map((z) => [z.id, z]));
  }

  /** Begin the simulation loop. Idempotent. */
  start(): void {
    if (this.timer) return;
    const tickMs = this.options.tickMs ?? 4000;
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
    this.incidents = [triaged, ...this.incidents].slice(0, 60);
    this.emit('incident', triaged);
    await this.refreshDecisions();
    return triaged;
  }

  updateDecisionStatus(id: string, status: Decision['status']): Decision | undefined {
    const updated = this.engine.setStatus(id, status);
    if (updated) {
      this.decisions = this.engine.current();
      this.emit('decisions', this.decisions);
    }
    return updated;
  }

  // --- simulation loop -------------------------------------------------------

  private async tick(): Promise<void> {
    const now = Date.now();
    const { readings, incidents } = this.simulator.tick(this.minutesToKickoff, now);
    this.readings = readings;
    this.emit('crowd', readings);

    // Triage and store any newly generated incidents.
    for (const incident of incidents) {
      const zone = this.zoneIndex.get(incident.zoneId);
      const triaged = await this.triage.triage(incident, zone);
      this.incidents = [triaged, ...this.incidents].slice(0, 60);
      this.emit('incident', triaged);
    }

    await this.refreshDecisions();
    this.advanceClock();
    this.emit('clock', {
      phase: this.simulator.phaseFor(this.minutesToKickoff),
      minutesToKickoff: this.minutesToKickoff,
    });
  }

  private async refreshDecisions(): Promise<void> {
    const openIncidents = this.incidents.filter((i) => i.status !== 'resolved');
    this.decisions = await this.engine.evaluate(this.readings, openIncidents, this.zoneIndex, Date.now());
    this.emit('decisions', this.decisions);
  }

  private advanceClock(): void {
    const step = this.options.minutesPerTick ?? 2;
    this.minutesToKickoff -= step;
    // Loop the match day so a demo runs indefinitely.
    if (this.minutesToKickoff < -120) this.minutesToKickoff = 120;
  }
}
