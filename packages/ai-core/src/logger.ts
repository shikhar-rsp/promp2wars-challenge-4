/** Minimal structured logger. Swappable via {@link setLogger} for pino/console. */
export interface Logger {
  debug(msg: string, meta?: Record<string, unknown>): void;
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
}

const noop = (): void => undefined;

/** Silent by default so the library never pollutes host logs unbidden. */
let current: Logger = { debug: noop, info: noop, warn: noop, error: noop };

export function setLogger(logger: Logger): void {
  current = logger;
}

export function getLogger(): Logger {
  return current;
}
