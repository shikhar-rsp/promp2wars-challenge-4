import type { Stadium } from '@atlas/shared';

/** SVG canvas dimensions and inner padding for the tactical map. */
export const MAP_VIEW = { width: 800, height: 640, pad: 48 } as const;

export interface Point {
  x: number;
  y: number;
}

/**
 * Build a projection from the stadium's geographic bounds onto the SVG canvas.
 * Pure and dependency-free, so it is unit-testable in isolation from React.
 */
export function createProjection(stadium: Stadium): (lng: number, lat: number) => Point {
  const [sw, ne] = stadium.bounds;
  const spanLng = ne.lng - sw.lng || 1e-6;
  const spanLat = ne.lat - sw.lat || 1e-6;
  const { width, height, pad } = MAP_VIEW;
  return (lng, lat) => ({
    x: pad + ((lng - sw.lng) / spanLng) * (width - 2 * pad),
    // Invert Y: higher latitude renders higher up.
    y: pad + (1 - (lat - sw.lat) / spanLat) * (height - 2 * pad),
  });
}

/** Project every zone centre to a canvas point, keyed by zone id. */
export function projectZones(stadium: Stadium): Map<string, Point> {
  const project = createProjection(stadium);
  return new Map(stadium.zones.map((z) => [z.id, project(z.center.lng, z.center.lat)]));
}

/**
 * De-duplicated undirected edges of the walkable graph, for the connectivity
 * underlay. Each unordered pair appears once.
 */
export function uniqueEdges(stadium: Stadium): Array<[string, string]> {
  const seen = new Set<string>();
  const edges: Array<[string, string]> = [];
  for (const zone of stadium.zones) {
    for (const other of zone.connectedZoneIds) {
      const key = [zone.id, other].sort().join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push([zone.id, other]);
    }
  }
  return edges;
}

/** Node radius scales gently with zone capacity, clamped for legibility. */
export function nodeRadius(capacity: number): number {
  return 9 + Math.min(22, Math.sqrt(capacity) / 12);
}
