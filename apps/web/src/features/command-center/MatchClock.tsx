'use client';

import { Clock } from 'lucide-react';
import type { MatchPhase } from '@/types';
import { matchClockLabel } from '@/lib/utils';

const PHASE_LABEL: Record<MatchPhase, string> = {
  'pre-match': 'Pre-match',
  kickoff: 'Kick-off',
  'first-half': 'First half',
  halftime: 'Half-time',
  'second-half': 'Second half',
  egress: 'Egress',
};

/** Compact live match-clock chip shown in the Command Center toolbar. */
export function MatchClock({
  phase,
  minutesToKickoff,
}: {
  phase: MatchPhase | null;
  minutesToKickoff: number;
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border bg-card px-3 py-1.5 text-sm">
      <Clock className="h-4 w-4 text-signal" aria-hidden />
      <span className="font-medium tabular-nums">{matchClockLabel(minutesToKickoff)}</span>
      {phase && <span className="text-xs text-muted-foreground">· {PHASE_LABEL[phase]}</span>}
    </div>
  );
}
