'use client';

import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { api } from '@/lib/api';
import { SOCKET_URL } from '@/lib/config';
import type { CrowdReading, Decision, Incident, MatchPhase, StadiumSnapshot } from '@/types';

export interface LiveState {
  snapshot: StadiumSnapshot | null;
  readings: CrowdReading[];
  incidents: Incident[];
  decisions: Decision[];
  phase: MatchPhase | null;
  minutesToKickoff: number;
  connected: boolean;
  error: string | null;
}

/**
 * Single source of live truth for the client. It hydrates once over HTTP (so
 * the page paints immediately even before the socket connects) then subscribes
 * to incremental Socket.IO events. State updates are batched by React; the map
 * and feed re-render from the same store, so they can never disagree.
 */
export function useRealtime(): LiveState {
  const [state, setState] = useState<LiveState>({
    snapshot: null,
    readings: [],
    incidents: [],
    decisions: [],
    phase: null,
    minutesToKickoff: 0,
    connected: false,
    error: null,
  });
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    let active = true;

    // 1) HTTP hydrate for instant first paint.
    api
      .snapshot()
      .then((snapshot) => {
        if (!active) return;
        setState((s) => ({
          ...s,
          snapshot,
          readings: snapshot.readings,
          incidents: snapshot.incidents,
          decisions: snapshot.decisions,
          phase: snapshot.phase,
          minutesToKickoff: snapshot.minutesToKickoff,
        }));
      })
      .catch((e: unknown) =>
        active ? setState((s) => ({ ...s, error: (e as Error).message })) : undefined,
      );

    // 2) Live incremental updates.
    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => setState((s) => ({ ...s, connected: true, error: null })));
    socket.on('disconnect', () => setState((s) => ({ ...s, connected: false })));
    socket.on('connect_error', (e) =>
      setState((s) => ({ ...s, connected: false, error: e.message })),
    );

    socket.on('snapshot', (snapshot: StadiumSnapshot) =>
      setState((s) => ({
        ...s,
        snapshot,
        readings: snapshot.readings,
        incidents: snapshot.incidents,
        decisions: snapshot.decisions,
        phase: snapshot.phase,
        minutesToKickoff: snapshot.minutesToKickoff,
      })),
    );
    socket.on('crowd', (readings: CrowdReading[]) => setState((s) => ({ ...s, readings })));
    socket.on('incident', (incident: Incident) =>
      setState((s) => ({ ...s, incidents: [incident, ...s.incidents].slice(0, 60) })),
    );
    socket.on('decisions', (decisions: Decision[]) => setState((s) => ({ ...s, decisions })));
    socket.on('clock', (p: { phase: MatchPhase; minutesToKickoff: number }) =>
      setState((s) => ({ ...s, phase: p.phase, minutesToKickoff: p.minutesToKickoff })),
    );

    return () => {
      active = false;
      socket.close();
    };
  }, []);

  return state;
}
