'use client';

import { useCallback, useMemo, useState } from 'react';
import type { AccessibilityNeed, FanContext } from '@/types';

/** Assumed minutes-to-kickoff for the demo fan (drives time-aware guidance). */
const DEMO_MINUTES_TO_KICKOFF = 35;

export interface FanContextState {
  currentZoneId: string;
  seatZoneId: string;
  needs: AccessibilityNeed[];
  setCurrentZoneId: (id: string) => void;
  setSeatZoneId: (id: string) => void;
  toggleNeed: (need: AccessibilityNeed) => void;
  /** The assembled FanContext sent with each copilot request. */
  fan: FanContext;
}

/**
 * Owns the fan's match-day context (location, seat, accessibility needs) and
 * derives the {@link FanContext} payload. Separated from the conversation state
 * so each concern has a single responsibility.
 */
export function useFanContext(
  initial: { currentZoneId: string; seatZoneId: string } = {
    currentZoneId: 'gate-a',
    seatZoneId: 'seating-100-north',
  },
): FanContextState {
  const [currentZoneId, setCurrentZoneId] = useState(initial.currentZoneId);
  const [seatZoneId, setSeatZoneId] = useState(initial.seatZoneId);
  const [needs, setNeeds] = useState<AccessibilityNeed[]>([]);

  const toggleNeed = useCallback((need: AccessibilityNeed) => {
    setNeeds((prev) => (prev.includes(need) ? prev.filter((n) => n !== need) : [...prev, need]));
  }, []);

  const fan = useMemo<FanContext>(
    () => ({
      fanId: 'demo-fan',
      currentZoneId,
      seatZoneId,
      accessibilityNeeds: needs,
      minutesToKickoff: DEMO_MINUTES_TO_KICKOFF,
    }),
    [currentZoneId, seatZoneId, needs],
  );

  return { currentZoneId, seatZoneId, needs, setCurrentZoneId, setSeatZoneId, toggleNeed, fan };
}
