'use client';

import type { Zone } from '@atlas/shared';
import { Accessibility, MapPin } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { AccessibilityNeed } from '@/types';
import { ACCESS_OPTIONS } from './types';

interface ContextPanelProps {
  zones: Zone[];
  seatingZones: Zone[];
  currentZoneId: string;
  seatZoneId: string;
  needs: AccessibilityNeed[];
  onCurrentZone: (id: string) => void;
  onSeatZone: (id: string) => void;
  onToggleNeed: (need: AccessibilityNeed) => void;
}

/** Sidebar that captures the fan's match-day context (controlled). */
export function ContextPanel({
  zones,
  seatingZones,
  currentZoneId,
  seatZoneId,
  needs,
  onCurrentZone,
  onSeatZone,
  onToggleNeed,
}: ContextPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Your match-day context</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          The copilot grounds every answer in this context — so guidance is specific to your
          location, seat and accessibility needs, in whatever language you ask.
        </p>

        <ZoneSelect
          label="Current location"
          icon={<MapPin className="h-3.5 w-3.5" />}
          zones={zones}
          value={currentZoneId}
          onChange={onCurrentZone}
        />
        <ZoneSelect label="Your seat" zones={seatingZones} value={seatZoneId} onChange={onSeatZone} />

        <div>
          <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Accessibility className="h-3.5 w-3.5" /> Accessibility needs
          </span>
          <div className="flex flex-wrap gap-1.5">
            {ACCESS_OPTIONS.map((opt) => {
              const active = needs.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  onClick={() => onToggleNeed(opt.value)}
                  aria-pressed={active}
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-xs transition-colors',
                    active
                      ? 'border-signal bg-signal/10 text-signal'
                      : 'text-muted-foreground hover:bg-accent',
                  )}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ZoneSelect({
  label,
  icon,
  zones,
  value,
  onChange,
}: {
  label: string;
  icon?: React.ReactNode;
  zones: Zone[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <label className="block text-xs font-medium">
      <span className="mb-1 flex items-center gap-1.5 text-muted-foreground">
        {icon}
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
      >
        {zones.map((zone) => (
          <option key={zone.id} value={zone.id}>
            {zone.name}
          </option>
        ))}
      </select>
    </label>
  );
}
