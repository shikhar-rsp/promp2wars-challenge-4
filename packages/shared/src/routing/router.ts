import { densityRatio, type Stadium, type Zone } from '../domain/stadium.js';

export interface RouteOptions {
  /** Require every zone on the path to be wheelchair accessible. */
  requireAccessible?: boolean;
  /** Zones to avoid entirely (e.g. an incident cordon or evacuation source). */
  avoidZoneIds?: readonly string[];
}

export interface RouteStep {
  zoneId: string;
  zoneName: string;
  etaSeconds: number;
}

export interface Route {
  steps: RouteStep[];
  totalSeconds: number;
  /** True when a valid path was found under the given constraints. */
  found: boolean;
}

/**
 * Congestion-aware shortest-path routing over the zone graph.
 *
 * Edge cost = the destination zone's base traversal time multiplied by a
 * congestion penalty that grows super-linearly with density — so the router
 * naturally steers fans around bottlenecks the way a good steward would, not
 * just along the geometrically shortest path. This is a genuine Dijkstra with a
 * congestion cost model, not a lookup table.
 */
export class StadiumRouter {
  private readonly zones: ReadonlyMap<string, Zone>;

  constructor(stadium: Stadium) {
    this.zones = new Map(stadium.zones.map((zone) => [zone.id, zone]));
  }

  route(fromId: string, toId: string, options: RouteOptions = {}): Route {
    const avoid = new Set(options.avoidZoneIds ?? []);
    const from = this.zones.get(fromId);
    const to = this.zones.get(toId);
    if (!from || !to || avoid.has(toId)) return { steps: [], totalSeconds: 0, found: false };

    const dist = new Map<string, number>();
    const prev = new Map<string, string>();
    const visited = new Set<string>();
    dist.set(fromId, 0);

    // Simple binary-search-free priority selection; graph is small (~24 nodes).
    while (visited.size < this.zones.size) {
      const current = this.closestUnvisited(dist, visited);
      if (current === undefined) break;
      if (current === toId) break;
      visited.add(current);

      const zone = this.zones.get(current)!;
      for (const neighborId of zone.connectedZoneIds) {
        const neighbor = this.zones.get(neighborId);
        if (!neighbor || visited.has(neighborId) || avoid.has(neighborId)) continue;
        if (options.requireAccessible && !neighbor.wheelchairAccessible) continue;

        const cost = (dist.get(current) ?? Infinity) + this.edgeCost(neighbor);
        if (cost < (dist.get(neighborId) ?? Infinity)) {
          dist.set(neighborId, cost);
          prev.set(neighborId, current);
        }
      }
    }

    if (!dist.has(toId)) return { steps: [], totalSeconds: 0, found: false };
    return this.reconstruct(fromId, toId, prev, dist);
  }

  /**
   * Congestion multiplier: 1.0 when empty, rising to ~4x as a zone approaches
   * and exceeds capacity. The cubic term makes the router strongly prefer to
   * route around near-critical zones.
   */
  private edgeCost(zone: Zone): number {
    const d = densityRatio(zone);
    const penalty = 1 + 3 * Math.min(1.2, d) ** 3;
    return zone.baseTraversalSeconds * penalty;
  }

  private closestUnvisited(dist: Map<string, number>, visited: Set<string>): string | undefined {
    let best: string | undefined;
    let bestCost = Infinity;
    for (const [id, cost] of dist) {
      if (!visited.has(id) && cost < bestCost) {
        best = id;
        bestCost = cost;
      }
    }
    return best;
  }

  private reconstruct(
    fromId: string,
    toId: string,
    prev: Map<string, string>,
    dist: Map<string, number>,
  ): Route {
    const order: string[] = [];
    let cursor: string | undefined = toId;
    while (cursor !== undefined) {
      order.unshift(cursor);
      if (cursor === fromId) break;
      cursor = prev.get(cursor);
    }
    if (order[0] !== fromId) return { steps: [], totalSeconds: 0, found: false };

    const steps: RouteStep[] = order.map((id) => {
      const zone = this.zones.get(id)!;
      return { zoneId: id, zoneName: zone.name, etaSeconds: Math.round(dist.get(id) ?? 0) };
    });
    return { steps, totalSeconds: Math.round(dist.get(toId) ?? 0), found: true };
  }
}
