'use client';

import type { Incident } from '@/types';
import { Languages } from 'lucide-react';
import { SeverityBadge } from '@/components/ui/badge';

function timeAgo(ts: number): string {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  return `${m}m ago`;
}

/**
 * Live incident stream. Each row shows the AI-normalised English summary with
 * the detected source language — demonstrating the multilingual triage — while
 * preserving the original report for auditability on hover/title.
 */
export function IncidentStream({ incidents }: { incidents: Incident[] }) {
  if (incidents.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        No incidents reported.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {incidents.slice(0, 12).map((incident) => (
        <li key={incident.id} className="rounded-lg border bg-card p-3">
          <div className="flex items-center gap-2">
            <SeverityBadge severity={incident.severity} />
            <span className="text-xs font-medium capitalize">{incident.type.replace('-', ' ')}</span>
            <span className="ml-auto text-[11px] text-muted-foreground">
              {timeAgo(incident.createdAt)}
            </span>
          </div>
          <p className="mt-1.5 text-sm" title={incident.raw}>
            {incident.aiSummary ?? incident.raw}
          </p>
          <div className="mt-1.5 flex items-center gap-3 text-[11px] text-muted-foreground">
            {incident.detectedLanguage && (
              <span className="inline-flex items-center gap-1">
                <Languages className="h-3 w-3" />
                {incident.detectedLanguage}
              </span>
            )}
            <span className="capitalize">via {incident.reportedBy}</span>
          </div>
          {incident.aiRecommendedAction && (
            <p className="mt-1.5 rounded bg-accent/60 px-2 py-1 text-[11px]">
              ↳ {incident.aiRecommendedAction}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
