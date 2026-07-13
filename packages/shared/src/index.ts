/** @atlas/shared — domain model, seed data, routing and simulation. */
export * from './domain/stadium.js';
export * from './domain/crowd.js';
export * from './domain/incident.js';
export * from './domain/decision.js';
export * from './domain/fan.js';

export { METLIFE_STADIUM, METLIFE_ZONE_INDEX } from './data/metlife.js';
export { StadiumRouter } from './routing/router.js';
export type { Route, RouteStep, RouteOptions } from './routing/router.js';
export { MatchSimulator } from './simulation/MatchSimulator.js';
export type { MatchPhase, SimulatorOptions } from './simulation/MatchSimulator.js';
export { mulberry32, pick, randInt } from './util/prng.js';
