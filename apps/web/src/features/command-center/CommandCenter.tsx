'use client';

import { densityLevel } from '@atlas/shared';
import { useMemo, useState } from 'react';
import { AppHeader } from '@/components/app-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useRealtime } from '@/hooks/useRealtime';
import type { Decision } from '@/types';
import { DecisionFeed } from './DecisionFeed';
import { IncidentStream } from './IncidentStream';
import { MatchClock } from './MatchClock';
import { OpsMetrics } from './OpsMetrics';
import { StatTiles } from './StatTiles';
import { aggregate } from './stats';
import { DensityLegend, TacticalMap } from './TacticalMap';

export function CommandCenter() {
  const live = useRealtime();
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<string, Decision>>({});

  const stats = useMemo(() => aggregate(live.readings), [live.readings]);
  const openIncidents = live.incidents.filter((i) => i.status !== 'resolved').length;

  // Merge server decisions with local status overrides (optimistic dispatch).
  const decisions = useMemo(
    () => live.decisions.map((d) => overrides[d.id] ?? d),
    [live.decisions, overrides],
  );

  const selected = selectedZoneId
    ? live.snapshot?.stadium.zones.find((z) => z.id === selectedZoneId)
    : undefined;
  const selectedReading = selectedZoneId
    ? live.readings.find((r) => r.zoneId === selectedZoneId)
    : undefined;

  if (!live.snapshot) {
    return (
      <div className="min-h-screen">
        <AppHeader live={live.connected} />
        <div className="grid h-[70vh] place-items-center text-sm text-muted-foreground">
          Connecting to the operations feed…
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <AppHeader live={live.connected} />
      <main id="main" className="mx-auto max-w-[1440px] px-4 py-5 md:px-6">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Operations Command Center</h1>
            <p className="text-sm text-muted-foreground">
              {live.snapshot.stadium.name} · {live.snapshot.stadium.city}
            </p>
          </div>
          <div className="ml-auto">
            <MatchClock phase={live.phase} minutesToKickoff={live.minutesToKickoff} />
          </div>
        </div>

        <StatTiles stats={stats} openIncidents={openIncidents} decisions={decisions.length} />

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Tactical map */}
          <Card className="lg:col-span-8">
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Live crowd density</CardTitle>
              <DensityLegend />
            </CardHeader>
            <CardContent>
              <div className="bg-grid aspect-[5/4] w-full overflow-hidden rounded-md border">
                <TacticalMap
                  stadium={live.snapshot.stadium}
                  readings={live.readings}
                  selectedZoneId={selectedZoneId}
                  onSelectZone={setSelectedZoneId}
                />
              </div>
              {selected && selectedReading && (
                <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1 rounded-md border bg-accent/40 px-3 py-2 text-sm">
                  <span className="font-medium">{selected.name}</span>
                  <span className="text-muted-foreground capitalize">
                    {densityLevel(selectedReading.density)} ·{' '}
                    {Math.round(selectedReading.density * 100)}% full
                  </span>
                  <span className="text-muted-foreground tabular-nums">
                    {selectedReading.occupancy.toLocaleString()} /{' '}
                    {selectedReading.capacity.toLocaleString()}
                  </span>
                  <span className="text-muted-foreground tabular-nums">
                    flow {selectedReading.flowRate > 0 ? '+' : ''}
                    {selectedReading.flowRate}/min
                  </span>
                  {selected.wheelchairAccessible && (
                    <span className="text-signal">step-free access</span>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Decision feed */}
          <div className="lg:col-span-4">
            <div className="mb-2 flex items-center gap-2">
              <h2 className="text-sm font-semibold">Decision Feed</h2>
              <span className="animate-pulse-ring h-2 w-2 rounded-full bg-signal" aria-hidden />
              <span className="text-xs text-muted-foreground">live</span>
            </div>
            <div className="scroll-thin max-h-[560px] overflow-y-auto pr-1">
              <DecisionFeed
                decisions={decisions}
                onUpdated={(d) => setOverrides((o) => ({ ...o, [d.id]: d }))}
              />
            </div>
          </div>

          {/* Incident stream */}
          <Card className="lg:col-span-8">
            <CardHeader>
              <CardTitle>Incident stream · multilingual triage</CardTitle>
            </CardHeader>
            <CardContent>
              <IncidentStream incidents={live.incidents} />
            </CardContent>
          </Card>

          {/* AI resilience */}
          <Card className="lg:col-span-4">
            <CardHeader>
              <CardTitle>AI resilience & efficiency</CardTitle>
            </CardHeader>
            <CardContent>
              <OpsMetrics />
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
