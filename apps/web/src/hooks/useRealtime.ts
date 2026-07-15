'use client';

import { useEffect, useReducer } from 'react';
import { io } from 'socket.io-client';
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

const INITIAL: LiveState = {
  snapshot: null,
  readings: [],
  incidents: [],
  decisions: [],
  phase: null,
  minutesToKickoff: 0,
  connected: false,
  error: null,
};

/** Max incidents kept client-side, mirroring the server's rolling buffer. */
const INCIDENT_LIMIT = 60;

type Action =
  | { type: 'snapshot'; snapshot: StadiumSnapshot }
  | { type: 'crowd'; readings: CrowdReading[] }
  | { type: 'incident'; incident: Incident }
  | { type: 'decisions'; decisions: Decision[] }
  | { type: 'clock'; phase: MatchPhase; minutesToKickoff: number }
  | { type: 'connection'; connected: boolean; error?: string | null };

/**
 * Single reducer for all live updates. Centralising the transitions here (vs.
 * scattered setState spreads) means the snapshot-mapping exists exactly once
 * and every socket event has one obvious place to be handled.
 */
function reducer(state: LiveState, action: Action): LiveState {
  switch (action.type) {
    case 'snapshot': {
      const { readings, incidents, decisions, phase, minutesToKickoff } = action.snapshot;
      return { ...state, snapshot: action.snapshot, readings, incidents, decisions, phase, minutesToKickoff };
    }
    case 'crowd':
      return { ...state, readings: action.readings };
    case 'incident':
      return { ...state, incidents: [action.incident, ...state.incidents].slice(0, INCIDENT_LIMIT) };
    case 'decisions':
      return { ...state, decisions: action.decisions };
    case 'clock':
      return { ...state, phase: action.phase, minutesToKickoff: action.minutesToKickoff };
    case 'connection':
      return { ...state, connected: action.connected, error: action.error ?? state.error };
  }
}

/**
 * Single source of live truth for the client. It hydrates once over HTTP (so
 * the page paints immediately even before the socket connects) then subscribes
 * to incremental Socket.IO events. Map and feed render from the same store, so
 * they can never disagree.
 */
export function useRealtime(): LiveState {
  const [state, dispatch] = useReducer(reducer, INITIAL);

  useEffect(() => {
    let active = true;

    // 1) HTTP hydrate for instant first paint.
    api
      .snapshot()
      .then((snapshot) => active && dispatch({ type: 'snapshot', snapshot }))
      .catch(
        (e: unknown) =>
          active && dispatch({ type: 'connection', connected: false, error: (e as Error).message }),
      );

    // 2) Live incremental updates.
    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
    socket.on('connect', () => dispatch({ type: 'connection', connected: true, error: null }));
    socket.on('disconnect', () => dispatch({ type: 'connection', connected: false }));
    socket.on('connect_error', (e) =>
      dispatch({ type: 'connection', connected: false, error: e.message }),
    );
    socket.on('snapshot', (snapshot: StadiumSnapshot) => dispatch({ type: 'snapshot', snapshot }));
    socket.on('crowd', (readings: CrowdReading[]) => dispatch({ type: 'crowd', readings }));
    socket.on('incident', (incident: Incident) => dispatch({ type: 'incident', incident }));
    socket.on('decisions', (decisions: Decision[]) => dispatch({ type: 'decisions', decisions }));
    socket.on('clock', (p: { phase: MatchPhase; minutesToKickoff: number }) =>
      dispatch({ type: 'clock', ...p }),
    );

    return () => {
      active = false;
      socket.close();
    };
  }, []);

  return state;
}
