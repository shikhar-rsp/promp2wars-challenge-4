import { METLIFE_STADIUM } from '@atlas/shared';
import { describe, expect, it } from 'vitest';
import { MAP_VIEW, createProjection, nodeRadius, projectZones, uniqueEdges } from './mapGeometry';

describe('createProjection', () => {
  const project = createProjection(METLIFE_STADIUM);

  it('maps the south-west bound to the padded bottom-left', () => {
    const [sw] = METLIFE_STADIUM.bounds;
    const p = project(sw.lng, sw.lat);
    expect(p.x).toBeCloseTo(MAP_VIEW.pad);
    // South-west latitude is the lowest, so it renders at the bottom.
    expect(p.y).toBeCloseTo(MAP_VIEW.height - MAP_VIEW.pad);
  });

  it('keeps every projected zone inside the canvas', () => {
    for (const point of projectZones(METLIFE_STADIUM).values()) {
      expect(point.x).toBeGreaterThanOrEqual(0);
      expect(point.x).toBeLessThanOrEqual(MAP_VIEW.width);
      expect(point.y).toBeGreaterThanOrEqual(0);
      expect(point.y).toBeLessThanOrEqual(MAP_VIEW.height);
    }
  });
});

describe('uniqueEdges', () => {
  it('emits each undirected edge exactly once', () => {
    const edges = uniqueEdges(METLIFE_STADIUM);
    const keys = edges.map(([a, b]) => [a, b].sort().join('|'));
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('nodeRadius', () => {
  it('grows with capacity but stays clamped', () => {
    expect(nodeRadius(0)).toBeCloseTo(9);
    expect(nodeRadius(1_000_000)).toBeLessThanOrEqual(31);
    expect(nodeRadius(9000)).toBeGreaterThan(nodeRadius(400));
  });
});
