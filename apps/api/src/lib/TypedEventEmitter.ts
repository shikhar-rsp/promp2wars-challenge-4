import { EventEmitter } from 'node:events';

/** Map of event name → tuple of listener arguments. */
export type EventMap = Record<string, unknown[]>;

/**
 * A thin, fully-typed wrapper over Node's EventEmitter.
 *
 * Node's built-in emitter is stringly-typed: `emit('crowd', wrongType)` compiles
 * happily. This wrapper makes the event name and payload types checked at the
 * call site, so producers and consumers can never drift. Preferred by
 * composition (a private field) rather than inheritance, so a domain class
 * exposes only the surface it means to.
 */
export class TypedEventEmitter<TEvents extends EventMap> {
  private readonly emitter = new EventEmitter();

  emit<K extends keyof TEvents & string>(event: K, ...args: TEvents[K]): void {
    this.emitter.emit(event, ...args);
  }

  on<K extends keyof TEvents & string>(event: K, listener: (...args: TEvents[K]) => void): this {
    this.emitter.on(event, listener as (...args: unknown[]) => void);
    return this;
  }

  off<K extends keyof TEvents & string>(event: K, listener: (...args: TEvents[K]) => void): this {
    this.emitter.off(event, listener as (...args: unknown[]) => void);
    return this;
  }

  removeAllListeners(): void {
    this.emitter.removeAllListeners();
  }
}
