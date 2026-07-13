import type { Stadium, Zone } from '../domain/stadium.js';

/**
 * Seed model of MetLife Stadium (East Rutherford, NJ) — host of the FIFA World
 * Cup 2026 Final. Coordinates are anchored near the real venue centroid and
 * offset to lay out a plausible zone graph; capacities approximate the real
 * ~82,500 seat bowl distributed across stands, concourses and plazas.
 *
 * The zones form a connected walkable graph (`connectedZoneIds`) that the
 * routing engine traverses. This is seed data, not a survey — accurate enough
 * to make navigation, crowd and evacuation logic behave realistically.
 */
const CENTER = { lat: 40.8135, lng: -74.0745 };

/** Offset helper: metres roughly, converted to degrees at this latitude. */
function offset(dLatM: number, dLngM: number): { lat: number; lng: number } {
  return {
    lat: CENTER.lat + dLatM / 111_320,
    lng: CENTER.lng + dLngM / (111_320 * Math.cos((CENTER.lat * Math.PI) / 180)),
  };
}

const z = (zone: Zone): Zone => zone;

const zones: Zone[] = [
  // --- Transport & plazas (level 0) -----------------------------------------
  z({
    id: 'transport-rail',
    name: 'NJ Transit Rail Plaza',
    kind: 'transport',
    level: 0,
    center: offset(-320, 40),
    capacity: 6000,
    currentOccupancy: 2100,
    connectedZoneIds: ['gate-a', 'plaza-west'],
    baseTraversalSeconds: 180,
    wheelchairAccessible: true,
    amenities: ['rail', 'shuttle', 'ticket-office'],
  }),
  z({
    id: 'transport-parking',
    name: 'Parking Lot G Transit Hub',
    kind: 'transport',
    level: 0,
    center: offset(300, -260),
    capacity: 8000,
    currentOccupancy: 3400,
    connectedZoneIds: ['gate-c', 'plaza-east'],
    baseTraversalSeconds: 240,
    wheelchairAccessible: true,
    amenities: ['parking', 'rideshare', 'accessible-drop-off'],
  }),
  z({
    id: 'plaza-west',
    name: 'West Plaza',
    kind: 'fan-zone',
    level: 0,
    center: offset(-160, 30),
    capacity: 5000,
    currentOccupancy: 2600,
    connectedZoneIds: ['transport-rail', 'gate-a', 'gate-b', 'fanzone-main'],
    baseTraversalSeconds: 120,
    wheelchairAccessible: true,
    amenities: ['screens', 'sponsor-activation'],
  }),
  z({
    id: 'plaza-east',
    name: 'East Plaza',
    kind: 'fan-zone',
    level: 0,
    center: offset(150, -140),
    capacity: 5000,
    currentOccupancy: 1800,
    connectedZoneIds: ['transport-parking', 'gate-c', 'gate-d'],
    baseTraversalSeconds: 120,
    wheelchairAccessible: true,
    amenities: ['screens', 'merch'],
  }),
  z({
    id: 'fanzone-main',
    name: 'FIFA Fan Festival Zone',
    kind: 'fan-zone',
    level: 0,
    center: offset(-120, 160),
    capacity: 12000,
    currentOccupancy: 7200,
    connectedZoneIds: ['plaza-west', 'gate-b'],
    baseTraversalSeconds: 200,
    wheelchairAccessible: true,
    amenities: ['stage', 'food-trucks', 'first-aid'],
  }),

  // --- Gates (level 0) -------------------------------------------------------
  ...(['a', 'b', 'c', 'd'] as const).map((g, i) =>
    z({
      id: `gate-${g}`,
      name: `Gate ${g.toUpperCase()}`,
      kind: 'gate',
      level: 0,
      center: offset([-90, -40, 60, 110][i]!, [-60, 90, -90, 40][i]!),
      capacity: 3000,
      currentOccupancy: [2400, 1500, 2650, 900][i]!,
      connectedZoneIds: [
        i === 0 ? 'transport-rail' : i === 2 ? 'transport-parking' : 'plaza-west',
        `concourse-lower`,
      ],
      baseTraversalSeconds: 90,
      wheelchairAccessible: g !== 'd',
      amenities: ['security-screening', 'ticket-scan'],
    }),
  ),

  // --- Accessibility & medical ----------------------------------------------
  z({
    id: 'accessibility-hub',
    name: 'Accessibility Services Hub',
    kind: 'accessibility',
    level: 0,
    center: offset(-40, -20),
    capacity: 400,
    currentOccupancy: 90,
    connectedZoneIds: ['gate-a', 'concourse-lower'],
    baseTraversalSeconds: 60,
    wheelchairAccessible: true,
    amenities: ['wheelchair-loan', 'sensory-room', 'assistance-desk'],
  }),
  z({
    id: 'medical-north',
    name: 'North Medical Post',
    kind: 'medical',
    level: 100,
    center: offset(70, 0),
    capacity: 120,
    currentOccupancy: 22,
    connectedZoneIds: ['concourse-lower'],
    baseTraversalSeconds: 45,
    wheelchairAccessible: true,
    amenities: ['paramedic', 'aed', 'stretcher'],
  }),

  // --- Concourses ------------------------------------------------------------
  z({
    id: 'concourse-lower',
    name: 'Lower Concourse Ring',
    kind: 'concourse',
    level: 100,
    center: offset(0, 0),
    capacity: 15000,
    currentOccupancy: 9800,
    connectedZoneIds: [
      'gate-a',
      'gate-b',
      'gate-c',
      'gate-d',
      'accessibility-hub',
      'medical-north',
      'concourse-upper',
      'concession-lower-1',
      'concession-lower-2',
      'restroom-lower-1',
      'seating-100-north',
      'seating-100-south',
    ],
    baseTraversalSeconds: 150,
    wheelchairAccessible: true,
    amenities: ['elevators', 'escalators', 'info-desk'],
  }),
  z({
    id: 'concourse-upper',
    name: 'Upper Concourse Ring',
    kind: 'concourse',
    level: 300,
    center: offset(0, 20),
    capacity: 12000,
    currentOccupancy: 6400,
    connectedZoneIds: [
      'concourse-lower',
      'concession-upper-1',
      'restroom-upper-1',
      'seating-300-north',
      'seating-300-south',
    ],
    baseTraversalSeconds: 150,
    wheelchairAccessible: true,
    amenities: ['elevators', 'escalators'],
  }),

  // --- Concessions & restrooms ----------------------------------------------
  z({
    id: 'concession-lower-1',
    name: 'Lower Concession — West',
    kind: 'concession',
    level: 100,
    center: offset(-30, -40),
    capacity: 800,
    currentOccupancy: 520,
    connectedZoneIds: ['concourse-lower'],
    baseTraversalSeconds: 60,
    wheelchairAccessible: true,
    amenities: ['halal', 'vegetarian', 'water-refill'],
  }),
  z({
    id: 'concession-lower-2',
    name: 'Lower Concession — East',
    kind: 'concession',
    level: 100,
    center: offset(30, 40),
    capacity: 800,
    currentOccupancy: 610,
    connectedZoneIds: ['concourse-lower'],
    baseTraversalSeconds: 60,
    wheelchairAccessible: true,
    amenities: ['kosher', 'vegan', 'water-refill'],
  }),
  z({
    id: 'concession-upper-1',
    name: 'Upper Concession — North',
    kind: 'concession',
    level: 300,
    center: offset(40, 30),
    capacity: 600,
    currentOccupancy: 300,
    connectedZoneIds: ['concourse-upper'],
    baseTraversalSeconds: 60,
    wheelchairAccessible: true,
    amenities: ['grab-and-go', 'water-refill'],
  }),
  z({
    id: 'restroom-lower-1',
    name: 'Lower Restrooms — West',
    kind: 'restroom',
    level: 100,
    center: offset(-25, 25),
    capacity: 300,
    currentOccupancy: 180,
    connectedZoneIds: ['concourse-lower'],
    baseTraversalSeconds: 45,
    wheelchairAccessible: true,
    amenities: ['accessible-stall', 'baby-change'],
  }),
  z({
    id: 'restroom-upper-1',
    name: 'Upper Restrooms — North',
    kind: 'restroom',
    level: 300,
    center: offset(35, -20),
    capacity: 240,
    currentOccupancy: 96,
    connectedZoneIds: ['concourse-upper'],
    baseTraversalSeconds: 45,
    wheelchairAccessible: true,
    amenities: ['accessible-stall'],
  }),

  // --- Seating ---------------------------------------------------------------
  z({
    id: 'seating-100-north',
    name: 'Lower Bowl — North (100s)',
    kind: 'seating',
    level: 100,
    center: offset(60, 60),
    capacity: 9000,
    currentOccupancy: 6800,
    connectedZoneIds: ['concourse-lower', 'exit-north'],
    baseTraversalSeconds: 120,
    wheelchairAccessible: true,
    amenities: ['accessible-seating'],
  }),
  z({
    id: 'seating-100-south',
    name: 'Lower Bowl — South (100s)',
    kind: 'seating',
    level: 100,
    center: offset(-60, -60),
    capacity: 9000,
    currentOccupancy: 7100,
    connectedZoneIds: ['concourse-lower', 'exit-south'],
    baseTraversalSeconds: 120,
    wheelchairAccessible: true,
    amenities: ['accessible-seating'],
  }),
  z({
    id: 'seating-300-north',
    name: 'Upper Bowl — North (300s)',
    kind: 'seating',
    level: 300,
    center: offset(80, 70),
    capacity: 11000,
    currentOccupancy: 7900,
    connectedZoneIds: ['concourse-upper', 'exit-north'],
    baseTraversalSeconds: 140,
    wheelchairAccessible: false,
    amenities: [],
  }),
  z({
    id: 'seating-300-south',
    name: 'Upper Bowl — South (300s)',
    kind: 'seating',
    level: 300,
    center: offset(-80, -70),
    capacity: 11000,
    currentOccupancy: 8300,
    connectedZoneIds: ['concourse-upper', 'exit-south'],
    baseTraversalSeconds: 140,
    wheelchairAccessible: false,
    amenities: [],
  }),

  // --- Exits -----------------------------------------------------------------
  z({
    id: 'exit-north',
    name: 'North Emergency Egress',
    kind: 'exit',
    level: 0,
    center: offset(140, 90),
    capacity: 8000,
    currentOccupancy: 0,
    connectedZoneIds: ['seating-100-north', 'seating-300-north', 'plaza-east'],
    baseTraversalSeconds: 100,
    wheelchairAccessible: true,
    amenities: ['egress'],
  }),
  z({
    id: 'exit-south',
    name: 'South Emergency Egress',
    kind: 'exit',
    level: 0,
    center: offset(-140, -90),
    capacity: 8000,
    currentOccupancy: 0,
    connectedZoneIds: ['seating-100-south', 'seating-300-south', 'plaza-west'],
    baseTraversalSeconds: 100,
    wheelchairAccessible: true,
    amenities: ['egress'],
  }),
];

/**
 * Ensure every edge is bidirectional. Authoring one direction by hand is
 * error-prone, so we derive the reverse edges here — a single source of truth
 * that guarantees the walkable graph is symmetric for the router.
 */
function makeBidirectional(input: Zone[]): Zone[] {
  const index = new Map(input.map((zone) => [zone.id, new Set(zone.connectedZoneIds)]));
  for (const zone of input) {
    for (const neighborId of zone.connectedZoneIds) {
      index.get(neighborId)?.add(zone.id);
    }
  }
  return input.map((zone) => ({
    ...zone,
    connectedZoneIds: [...(index.get(zone.id) ?? [])].sort(),
  }));
}

export const METLIFE_STADIUM: Stadium = {
  id: 'metlife-2026',
  name: 'MetLife Stadium',
  city: 'East Rutherford, NJ',
  country: 'United States',
  capacity: 82_500,
  center: CENTER,
  bounds: [offset(-420, -360), offset(420, 360)],
  zones: makeBidirectional(zones),
};

/** Fast id → zone lookup used throughout the routing/crowd logic. */
export const METLIFE_ZONE_INDEX: ReadonlyMap<string, Zone> = new Map(
  METLIFE_STADIUM.zones.map((zone) => [zone.id, zone]),
);
