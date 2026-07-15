'use client';

import { DENSITY_COLORS, densityLevel, type CrowdReading, type Stadium } from '@atlas/shared';
import { useMemo } from 'react';
import { MAP_VIEW, nodeRadius, projectZones, uniqueEdges } from './mapGeometry';

const VIEW = { w: MAP_VIEW.width, h: MAP_VIEW.height, pad: MAP_VIEW.pad };

const LABELLED_KINDS = new Set(['gate', 'transport', 'medical', 'exit', 'accessibility']);

/**
 * Self-contained tactical crowd map. Rather than depend on external map tiles
 * (a paid/online dependency and visually noisy at this scale), ATLAS renders
 * the stadium's own walkable graph as an SVG: nodes coloured by live density,
 * edges showing connectivity, critical zones pulsing. It is fast, offline,
 * CSP-safe and reads like a real operations display. A MapLibre + OSM overlay
 * can be layered for geographic context (see docs) without changing this API.
 */
export function TacticalMap({
  stadium,
  readings,
  selectedZoneId,
  onSelectZone,
}: {
  stadium: Stadium;
  readings: CrowdReading[];
  selectedZoneId: string | null;
  onSelectZone: (zoneId: string) => void;
}) {
  const readingByZone = useMemo(() => new Map(readings.map((r) => [r.zoneId, r])), [readings]);
  const points = useMemo(() => projectZones(stadium), [stadium]);
  const edges = useMemo(() => uniqueEdges(stadium), [stadium]);

  return (
    <svg
      viewBox={`0 0 ${VIEW.w} ${VIEW.h}`}
      className="h-full w-full"
      role="img"
      aria-label="Live stadium crowd density map"
    >
      {/* Pitch footprint for orientation. */}
      <rect
        x={VIEW.w / 2 - 90}
        y={VIEW.h / 2 - 60}
        width={180}
        height={120}
        rx={8}
        className="fill-signal/5 stroke-signal/30"
        strokeWidth={1.5}
      />
      <line
        x1={VIEW.w / 2}
        y1={VIEW.h / 2 - 60}
        x2={VIEW.w / 2}
        y2={VIEW.h / 2 + 60}
        className="stroke-signal/20"
        strokeWidth={1}
      />

      {/* Connectivity underlay. */}
      {edges.map(([a, b]) => {
        const pa = points.get(a);
        const pb = points.get(b);
        if (!pa || !pb) return null;
        return (
          <line
            key={`${a}|${b}`}
            x1={pa.x}
            y1={pa.y}
            x2={pb.x}
            y2={pb.y}
            className="stroke-border"
            strokeWidth={1}
            opacity={0.6}
          />
        );
      })}

      {/* Zone nodes. */}
      {stadium.zones.map((zone) => {
        const p = points.get(zone.id)!;
        const reading = readingByZone.get(zone.id);
        const density = reading?.density ?? 0;
        const level = densityLevel(density);
        const color = DENSITY_COLORS[level];
        const radius = nodeRadius(zone.capacity);
        const selected = zone.id === selectedZoneId;
        const critical = level === 'critical';
        const label = LABELLED_KINDS.has(zone.kind) ? zone.name.replace(/ .*/, '') : '';

        return (
          <g
            key={zone.id}
            transform={`translate(${p.x} ${p.y})`}
            role="button"
            tabIndex={0}
            aria-label={`${zone.name}: ${level} density, ${Math.round(density * 100)}% full`}
            className="cursor-pointer focus:outline-none"
            onClick={() => onSelectZone(zone.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelectZone(zone.id);
              }
            }}
          >
            {critical && (
              <circle r={radius + 6} fill="none" stroke={color} strokeWidth={2} opacity={0.5}>
                <animate attributeName="r" values={`${radius};${radius + 12};${radius}`} dur="2s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.6;0;0.6" dur="2s" repeatCount="indefinite" />
              </circle>
            )}
            <circle
              r={radius}
              fill={color}
              fillOpacity={0.85}
              stroke={selected ? 'hsl(var(--foreground))' : 'white'}
              strokeWidth={selected ? 3 : 1.5}
              strokeOpacity={selected ? 1 : 0.5}
            />
            {label && (
              <text
                y={-radius - 6}
                textAnchor="middle"
                className="fill-muted-foreground text-[10px] font-medium"
                style={{ pointerEvents: 'none' }}
              >
                {label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/** Legend rendered beside the map. */
export function DensityLegend() {
  const items: Array<{ level: keyof typeof DENSITY_COLORS; label: string }> = [
    { level: 'low', label: 'Low' },
    { level: 'moderate', label: 'Moderate' },
    { level: 'busy', label: 'Busy' },
    { level: 'crowded', label: 'Crowded' },
    { level: 'critical', label: 'Critical' },
  ];
  return (
    <div className="flex flex-wrap items-center gap-3">
      {items.map((i) => (
        <span key={i.level} className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: DENSITY_COLORS[i.level] }}
          />
          {i.label}
        </span>
      ))}
    </div>
  );
}
