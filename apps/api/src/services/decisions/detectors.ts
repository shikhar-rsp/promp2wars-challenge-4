import {
  SEVERITY_WEIGHT,
  type AIDecisionDraft,
  type DecisionCategory,
  type Incident,
} from '@atlas/shared';
import {
  CONFIDENCE,
  DENSITY,
  MIN_INCIDENT_SEVERITY_WEIGHT,
  PRIORITY,
  RAIL_ZONE_ID,
} from './thresholds.js';
import type { DetectionContext, Trigger, TriggerDetector } from './types.js';

const pct = (density: number): number => Math.round(density * 100);

/** Priority for an incident scales with its severity. */
const incidentPriority = (incident: Incident): number =>
  PRIORITY.incidentBase + SEVERITY_WEIGHT[incident.severity] * PRIORITY.incidentPerSeverityStep;

/** Map an incident type onto the decision category it belongs to. */
function categoryForIncident(incident: Incident): DecisionCategory {
  const byType: Partial<Record<Incident['type'], DecisionCategory>> = {
    medical: 'medical',
    'crowd-surge': 'crowd-safety',
    transport: 'transport',
    accessibility: 'accessibility',
    security: 'security',
  };
  return byType[incident.type] ?? 'guest-experience';
}

/** The primary dispatch action appropriate to an incident type. */
function actionForIncident(incident: Incident): AIDecisionDraft['actions'][number] {
  const byType: Partial<Record<Incident['type'], AIDecisionDraft['actions'][number]>> = {
    medical: { label: 'Dispatch nearest paramedic team', assignTo: 'medical', etaMinutes: 3, primary: true },
    'crowd-surge': { label: 'Deploy stewards to meter flow', assignTo: 'stewards', etaMinutes: 2, primary: true },
    'lost-child': { label: 'Escort to Accessibility/Family desk & broadcast', assignTo: 'volunteers', etaMinutes: 4, primary: true },
    security: { label: 'Send security to assess and cordon', assignTo: 'security', etaMinutes: 3, primary: true },
    accessibility: { label: 'Dispatch facilities to restore access', assignTo: 'facilities', etaMinutes: 6, primary: true },
    transport: { label: 'Coordinate with transport control', assignTo: 'transport', etaMinutes: 5, primary: true },
  };
  return byType[incident.type] ?? { label: 'Investigate and confirm', assignTo: 'stewards', etaMinutes: 5, primary: true };
}

const titleCase = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, ' ');

/** Flag any zone at or over the crowded threshold. */
const detectCrowdSafety: TriggerDetector = ({ readings, zoneIndex }) =>
  readings
    .filter((reading) => reading.density >= DENSITY.crowdedZone)
    .map((reading) => {
      const zone = zoneIndex.get(reading.zoneId);
      const density = pct(reading.density);
      const priority = reading.level === 'critical' ? PRIORITY.crowdCritical : PRIORITY.crowdHigh;
      return {
        signature: `crowd:${reading.zoneId}:${reading.level}`,
        category: 'crowd-safety',
        trigger: `High crowd density in ${zone?.name ?? reading.zoneId}`,
        zone,
        facts: [
          `Density at ${density}% of capacity (${reading.occupancy}/${reading.capacity})`,
          `Flow rate ${reading.flowRate > 0 ? '+' : ''}${reading.flowRate}/min`,
          reading.predictedDensity15m
            ? `Predicted ${pct(reading.predictedDensity15m)}% in 15 min`
            : 'Trend rising',
        ],
        fallback: {
          category: 'crowd-safety',
          title: `Relieve congestion at ${zone?.name ?? reading.zoneId}`,
          insight: `${zone?.name ?? 'Zone'} is at ${density}% capacity and rising. Proactively redirect inbound flow to prevent a dangerous bottleneck.`,
          priority,
          confidence: CONFIDENCE.crowd,
          signals: [
            { label: 'Density', value: `${density}%`, ...(zone ? { zoneId: zone.id } : {}) },
            { label: 'Flow', value: `${reading.flowRate}/min` },
          ],
          actions: [
            { label: 'Deploy stewards to meter inflow', assignTo: 'stewards', etaMinutes: 3, primary: true },
            { label: 'Open alternate concourse route', assignTo: 'facilities', etaMinutes: 5, primary: false },
          ],
        },
      } satisfies Trigger;
    });

/** Turn each open, medium-or-higher incident into a decision trigger. */
const detectIncidents: TriggerDetector = ({ incidents, zoneIndex }) =>
  incidents
    .filter(
      (incident) =>
        incident.status !== 'resolved' &&
        SEVERITY_WEIGHT[incident.severity] >= MIN_INCIDENT_SEVERITY_WEIGHT,
    )
    .map((incident) => {
      const zone = zoneIndex.get(incident.zoneId);
      const category = categoryForIncident(incident);
      return {
        signature: `incident:${incident.id}`,
        category,
        trigger: `${incident.type} incident (${incident.severity})`,
        zone,
        facts: [
          incident.aiSummary ?? incident.raw,
          `Reported by ${incident.reportedBy}`,
          zone ? `At ${zone.name}` : 'Location pending',
        ],
        fallback: {
          category,
          title: `${titleCase(incident.type)} response at ${zone?.name ?? 'venue'}`,
          insight:
            incident.aiSummary ??
            `A ${incident.severity} ${incident.type} incident was reported. Dispatch the appropriate team and confirm on scene.`,
          priority: incidentPriority(incident),
          confidence: CONFIDENCE.incident,
          signals: [
            { label: 'Type', value: incident.type, ...(zone ? { zoneId: zone.id } : {}) },
            { label: 'Severity', value: incident.severity },
          ],
          actions: [actionForIncident(incident)],
        },
      } satisfies Trigger;
    });

/** Watch the rail plaza saturating during egress. */
const detectTransportEgress: TriggerDetector = ({ readings, zoneIndex }) => {
  const rail = readings.find((r) => r.zoneId === RAIL_ZONE_ID);
  if (!rail || rail.density < DENSITY.railSurge) return [];
  const zone = zoneIndex.get(rail.zoneId);
  const load = pct(rail.density);
  return [
    {
      signature: `transport:rail-surge:${rail.level}`,
      category: 'transport',
      trigger: 'Rail plaza approaching capacity',
      zone,
      facts: [`Rail plaza at ${load}% capacity`, 'Post-match egress in progress'],
      fallback: {
        category: 'transport',
        title: 'Stagger egress toward rail plaza',
        insight:
          'The NJ Transit rail plaza is nearing capacity during egress. Hold and stagger outflow from upper bowls to smooth passenger loading.',
        priority: PRIORITY.transportRail,
        confidence: CONFIDENCE.transport,
        signals: [{ label: 'Rail load', value: `${load}%`, zoneId: rail.zoneId }],
        actions: [
          { label: 'Announce staggered egress by section', assignTo: 'stewards', etaMinutes: 2, primary: true },
          { label: 'Request additional shuttle capacity', assignTo: 'transport', etaMinutes: 8, primary: false },
        ],
      },
    } satisfies Trigger,
  ];
};

/**
 * The detector registry. Order is irrelevant (decisions are re-ranked by
 * priority downstream). To add a new decision class, append a detector here.
 */
export const DECISION_DETECTORS: readonly TriggerDetector[] = [
  detectCrowdSafety,
  detectIncidents,
  detectTransportEgress,
];

/** Run every detector and flatten the resulting triggers. */
export function detectTriggers(context: DetectionContext): Trigger[] {
  return DECISION_DETECTORS.flatMap((detect) => detect(context));
}
