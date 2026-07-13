'use client';

import { AlertTriangle, Gauge, TicketCheck, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import type { AggregateStats } from './stats';

function Tile({
  icon,
  label,
  value,
  sub,
  tone = 'default',
}: {
  icon: ReactNode;
  label: string;
  value: string;
  sub?: string;
  tone?: 'default' | 'warn' | 'critical';
}) {
  const toneClass =
    tone === 'critical'
      ? 'text-sev-critical'
      : tone === 'warn'
        ? 'text-sev-high'
        : 'text-foreground';
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="text-muted-foreground">{icon}</span>
        {label}
      </div>
      <div className={`mt-2 text-2xl font-semibold tabular-nums ${toneClass}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

/** Four headline KPIs across the top of the Command Center. */
export function StatTiles({
  stats,
  openIncidents,
  decisions,
}: {
  stats: AggregateStats;
  openIncidents: number;
  decisions: number;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Tile
        icon={<Users className="h-4 w-4" />}
        label="In venue"
        value={stats.totalOccupancy.toLocaleString()}
        sub={`${Math.round(stats.fillRate * 100)}% of capacity`}
      />
      <Tile
        icon={<Gauge className="h-4 w-4" />}
        label="Congested zones"
        value={String(stats.crowdedZones)}
        sub={`${stats.criticalZones} critical`}
        tone={stats.criticalZones > 0 ? 'critical' : stats.crowdedZones > 0 ? 'warn' : 'default'}
      />
      <Tile
        icon={<AlertTriangle className="h-4 w-4" />}
        label="Open incidents"
        value={String(openIncidents)}
        tone={openIncidents > 0 ? 'warn' : 'default'}
      />
      <Tile
        icon={<TicketCheck className="h-4 w-4" />}
        label="Active decisions"
        value={String(decisions)}
        sub="AI-recommended"
      />
    </div>
  );
}
