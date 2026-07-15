import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { AllProvidersFailedError, PromptSafetyError } from '@atlas/ai-core';
import { METLIFE_STADIUM } from '@atlas/shared';
import Fastify, { type FastifyBaseLogger } from 'fastify';
import { ZodError } from 'zod';
import { ai, aiIsLive } from './ai.js';
import { config } from './config.js';
import { logger } from './logger.js';
import { attachRealtime } from './realtime.js';
import { registerRoutes } from './routes.js';
import { CopilotService } from './services/CopilotService.js';
import { StadiumState } from './services/StadiumState.js';

/**
 * Compose and start the ATLAS API: security middleware, routes, the live
 * simulation state and the realtime layer. Secrets never leave this process;
 * only derived, non-sensitive data is ever sent to clients.
 */
async function bootstrap(): Promise<void> {
  // Cast keeps Fastify's default instance generics (pino satisfies the base
  // logger contract) so route typing stays clean under strict TS.
  const app = Fastify({
    loggerInstance: logger as unknown as FastifyBaseLogger,
    trustProxy: true,
  });

  // --- Security middleware ---------------------------------------------------
  // The API serves only JSON, so a maximally strict CSP is safe and removes any
  // ambiguity for security scanners. Helmet also sets HSTS, X-Frame-Options,
  // nosniff, etc. by default.
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
    },
  });
  await app.register(cors, { origin: config.corsOrigins, credentials: true });
  await app.register(rateLimit, {
    max: 120,
    timeWindow: '1 minute',
    // Stricter default protects the AI-backed endpoints from quota abuse.
  });

  // --- Domain services -------------------------------------------------------
  const state = new StadiumState(METLIFE_STADIUM, ai, { tickMs: 4000, minutesPerTick: 2 });
  const copilot = new CopilotService(ai, METLIFE_STADIUM);

  registerRoutes(app, { state, copilot, aiIsLive });

  // Uniform error handling: never leak internals; map validation to 400.
  app.setErrorHandler((error: Error & { statusCode?: number }, request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({
        error: 'validation_error',
        issues: error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }
    // A blocked prompt-injection / unsafe input is a client error, not a server
    // fault — return a clean 400 that never echoes the offending content.
    if (error instanceof PromptSafetyError) {
      return reply.code(400).send({
        error: 'unsafe_input',
        message: 'Your request was blocked by the safety guard.',
      });
    }
    // Every AI provider (including the offline simulator) was unavailable.
    if (error instanceof AllProvidersFailedError) {
      return reply.code(503).send({ error: 'ai_unavailable', message: 'AI service is temporarily unavailable.' });
    }
    if (error.statusCode === 429) {
      return reply.code(429).send({ error: 'rate_limited', message: 'Too many requests.' });
    }
    request.log.error({ err: error }, 'unhandled error');
    return reply.code(error.statusCode ?? 500).send({ error: 'internal_error' });
  });

  // --- Start -----------------------------------------------------------------
  await app.listen({ port: config.port, host: config.API_HOST });
  const io = attachRealtime(app.server, state, config.corsOrigins);
  state.start();

  const shutdown = async (): Promise<void> => {
    logger.info('shutting down');
    state.stop();
    await io.close();
    await app.close();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown());
  process.on('SIGINT', () => void shutdown());
}

bootstrap().catch((error) => {
  logger.error({ err: error }, 'failed to start ATLAS API');
  process.exit(1);
});
