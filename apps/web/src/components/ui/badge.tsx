import type { HTMLAttributes } from 'react';
import type { IncidentSeverity } from '@atlas/shared';
import { cn } from '@/lib/utils';

const SEVERITY_CLASS: Record<IncidentSeverity, string> = {
  info: 'bg-sev-info/15 text-sev-info border-sev-info/30',
  low: 'bg-sev-low/15 text-sev-low border-sev-low/30',
  medium: 'bg-sev-medium/15 text-sev-medium border-sev-medium/30',
  high: 'bg-sev-high/15 text-sev-high border-sev-high/30',
  critical: 'bg-sev-critical/15 text-sev-critical border-sev-critical/40',
};

export function Badge({
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
        className,
      )}
      {...props}
    />
  );
}

/** Severity-coloured badge, driven by the shared semantic ramp. */
export function SeverityBadge({ severity }: { severity: IncidentSeverity }) {
  return (
    <Badge className={cn('uppercase tracking-wide', SEVERITY_CLASS[severity])}>{severity}</Badge>
  );
}
