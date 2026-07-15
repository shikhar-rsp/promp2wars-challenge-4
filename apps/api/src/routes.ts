import { FanContextSchema, type Incident } from '@atlas/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { CopilotService } from './services/CopilotService.js';
import type { StadiumState } from './services/StadiumState.js';

/** Request body schemas — every mutating endpoint validates input with zod. */
const ReportIncidentSchema = z.object({
  type: z.enum([
    'medical',
    'crowd-surge',
    'lost-child',
    'security',
    'infrastructure',
    'weather',
    'transport',
    'accessibility',
  ]),
  zoneId: z.string().min(1).max(64),
  reportedBy: z.enum(['fan', 'volunteer', 'staff', 'sensor', 'security']),
  raw: z.string().min(1).max(2000),
});

const DecisionStatusBody = z.object({
  status: z.enum(['proposed', 'accepted', 'dismissed', 'auto-resolved']),
});

const CopilotBody = z.object({
  question: z.string().min(1).max(1000),
  fan: FanContextSchema,
});

export interface RouteDeps {
  state: StadiumState;
  copilot: CopilotService;
  aiIsLive: boolean;
}

/**
 * All HTTP routes. Kept thin: validate input, delegate to a service, shape the
 * response. No business logic lives here. Errors bubble to the global handler.
 */
export function registerRoutes(app: FastifyInstance, deps: RouteDeps): void {
  const { state, copilot } = deps;

  app.get('/health', () => ({
    status: 'ok',
    aiLive: deps.aiIsLive,
    time: new Date().toISOString(),
  }));

  app.get('/api/stadium', () => state.snapshot());

  app.get('/api/crowd', () => ({ readings: state.getReadings() }));

  app.get('/api/incidents', () => ({ incidents: state.getIncidents() }));

  app.post('/api/incidents', async (request, reply) => {
    const body = ReportIncidentSchema.parse(request.body);
    const now = Date.now();
    const incident: Incident = {
      id: `inc-${now.toString(36)}-user`,
      type: body.type,
      severity: 'medium',
      status: 'open',
      zoneId: body.zoneId,
      createdAt: now,
      updatedAt: now,
      reportedBy: body.reportedBy,
      raw: body.raw,
    };
    const triaged = await state.report(incident);
    return reply.code(201).send({ incident: triaged });
  });

  app.get('/api/decisions', () => ({ decisions: state.getDecisions() }));

  app.post('/api/decisions/:id/status', async (request, reply) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const { status } = DecisionStatusBody.parse(request.body);
    const updated = state.updateDecisionStatus(id, status);
    if (!updated) return reply.code(404).send({ error: 'decision not found' });
    return { decision: updated };
  });

  app.post('/api/copilot', async (request) => {
    const { question, fan } = CopilotBody.parse(request.body);
    return copilot.ask(question, fan, state.getReadings());
  });

  // Server-Sent Events stream for the live typing effect in the copilot UI.
  app.post('/api/copilot/stream', async (request, reply) => {
    const { question, fan } = CopilotBody.parse(request.body);
    reply.raw.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
    });
    try {
      for await (const chunk of copilot.stream(question, fan, state.getReadings())) {
        reply.raw.write(`data: ${JSON.stringify({ delta: chunk.delta, done: chunk.done })}\n\n`);
        if (chunk.done) break;
      }
    } catch {
      reply.raw.write(`data: ${JSON.stringify({ error: 'stream failed', done: true })}\n\n`);
    }
    reply.raw.end();
  });

  app.get('/api/metrics', () => ({
    providers: state.aiMetrics(),
    cache: state.cacheStats(),
  }));
}
