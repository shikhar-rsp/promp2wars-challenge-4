import { pino } from 'pino';
import { config } from './config.js';

/** Process-wide structured logger. Pretty in dev, JSON in production. */
export const logger = pino({
  level: config.isProduction ? 'info' : 'debug',
  ...(config.isProduction
    ? {}
    : { transport: { target: 'pino/file', options: { destination: 1 } } }),
  // Never log secrets even if accidentally attached to a log line.
  redact: ['req.headers.authorization', '*.apiKey', '*.API_KEY'],
});
