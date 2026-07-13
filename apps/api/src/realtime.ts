import type { Server as HttpServer } from 'node:http';
import { Server as IOServer } from 'socket.io';
import { logger } from './logger.js';
import type { StadiumState } from './services/StadiumState.js';

/**
 * Socket.IO layer. It is a pure relay: it subscribes to {@link StadiumState}
 * events and pushes them to connected operators. New clients immediately
 * receive a full snapshot so the dashboard paints instantly, then stay live via
 * incremental events. This keeps the simulation logic and the transport cleanly
 * separated.
 */
export function attachRealtime(
  httpServer: HttpServer,
  state: StadiumState,
  corsOrigins: string[],
): IOServer {
  const io = new IOServer(httpServer, {
    cors: { origin: corsOrigins, methods: ['GET', 'POST'] },
    // Cap payload size to blunt abusive clients.
    maxHttpBufferSize: 1e6,
  });

  io.on('connection', (socket) => {
    logger.debug({ id: socket.id }, 'operator connected');
    socket.emit('snapshot', state.snapshot());
    socket.on('disconnect', () => logger.debug({ id: socket.id }, 'operator disconnected'));
  });

  // Fan out state events to every connected operator.
  state.on('crowd', (readings) => io.emit('crowd', readings));
  state.on('incident', (incident) => io.emit('incident', incident));
  state.on('decisions', (decisions) => io.emit('decisions', decisions));
  state.on('clock', (payload) => io.emit('clock', payload));

  return io;
}
