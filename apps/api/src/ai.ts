import { createAIServiceFromEnv, hasLiveProvider, setLogger } from '@atlas/ai-core';
import { config } from './config.js';
import { logger } from './logger.js';

// Route the AI layer's internal logs through the app logger.
setLogger({
  debug: (m, meta) => logger.debug(meta ?? {}, m),
  info: (m, meta) => logger.info(meta ?? {}, m),
  warn: (m, meta) => logger.warn(meta ?? {}, m),
  error: (m, meta) => logger.error(meta ?? {}, m),
});

/**
 * The single AIService instance for the whole process. Business services import
 * THIS, never a provider — the failover chain, caching and safety all live
 * behind it. Built from env with the mandated priority order and an always-on
 * simulator fallback so the API is fully functional with zero API keys.
 */
export const ai = createAIServiceFromEnv(config);

export const aiIsLive = hasLiveProvider(config);

logger.info(
  { live: aiIsLive },
  aiIsLive
    ? 'AI layer initialised with live provider(s)'
    : 'AI layer running in offline simulator mode (no provider keys set)',
);
