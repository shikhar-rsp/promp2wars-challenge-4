'use client';

import type { Decision, DecisionCategory } from '@/types';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Accessibility,
  Ambulance,
  Check,
  ChevronDown,
  Leaf,
  ShieldAlert,
  Sparkles,
  TrainFront,
  Users,
  X,
} from 'lucide-react';
import { memo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

const CATEGORY_META: Record<DecisionCategory, { icon: typeof Users; label: string }> = {
  'crowd-safety': { icon: Users, label: 'Crowd safety' },
  medical: { icon: Ambulance, label: 'Medical' },
  transport: { icon: TrainFront, label: 'Transport' },
  accessibility: { icon: Accessibility, label: 'Accessibility' },
  sustainability: { icon: Leaf, label: 'Sustainability' },
  security: { icon: ShieldAlert, label: 'Security' },
  'guest-experience': { icon: Sparkles, label: 'Guest experience' },
};

function priorityTone(priority: number): string {
  if (priority >= 90) return 'text-sev-critical';
  if (priority >= 75) return 'text-sev-high';
  if (priority >= 55) return 'text-sev-medium';
  return 'text-sev-low';
}

const DecisionCard = memo(function DecisionCard({
  decision,
  onUpdated,
}: {
  decision: Decision;
  onUpdated: (d: Decision) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const meta = CATEGORY_META[decision.category];
  const Icon = meta.icon;
  const primary = decision.actions.find((a) => a.primary) ?? decision.actions[0];

  async function act(status: Decision['status']) {
    setBusy(true);
    try {
      const { decision: updated } = await api.setDecisionStatus(decision.id, status);
      onUpdated(updated);
    } catch {
      // Non-fatal: leave the card in place if the update fails.
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        'rounded-lg border bg-card p-4',
        decision.priority >= 90 && 'border-sev-critical/40',
      )}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-md bg-accent">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {meta.label}
            </span>
            <span className={cn('text-[11px] font-semibold tabular-nums', priorityTone(decision.priority))}>
              P{decision.priority}
            </span>
            <span className="ml-auto text-[11px] text-muted-foreground">
              {Math.round(decision.confidence * 100)}% conf
            </span>
          </div>
          <h3 className="mt-1 text-sm font-semibold leading-snug">{decision.title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{decision.insight}</p>

          {/* Evidence toggle — the "why" behind the decision. */}
          <button
            onClick={() => setExpanded((v) => !v)}
            className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            aria-expanded={expanded}
          >
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', expanded && 'rotate-180')} />
            {decision.signals.length} signals · {decision.generatedBy}
          </button>
          <AnimatePresence initial={false}>
            {expanded && (
              <motion.ul
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="mt-2 space-y-1 overflow-hidden border-l-2 border-border pl-3"
              >
                {decision.signals.map((s, i) => (
                  <li key={i} className="text-xs">
                    <span className="text-muted-foreground">{s.label}: </span>
                    <span className="font-medium">{s.value}</span>
                  </li>
                ))}
              </motion.ul>
            )}
          </AnimatePresence>

          {/* Actions */}
          {decision.status === 'proposed' ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button size="sm" disabled={busy} onClick={() => act('accepted')}>
                <Check className="h-3.5 w-3.5" />
                Dispatch: {primary?.label}
                {primary && (
                  <span className="ml-1 rounded bg-black/10 px-1 text-[10px]">
                    ~{primary.etaMinutes}m · {primary.assignTo}
                  </span>
                )}
              </Button>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => act('dismissed')}>
                <X className="h-3.5 w-3.5" />
                Dismiss
              </Button>
            </div>
          ) : (
            <div className="mt-3 text-xs">
              <span
                className={cn(
                  'rounded-full border px-2 py-0.5 font-medium',
                  decision.status === 'accepted'
                    ? 'border-sev-low/40 bg-sev-low/10 text-sev-low'
                    : 'border-border text-muted-foreground',
                )}
              >
                {decision.status === 'accepted' ? 'Dispatched' : 'Dismissed'}
              </span>
            </div>
          )}
        </div>
      </div>
    </motion.article>
  );
});

/** The ranked, live Decision Feed — ATLAS's signature surface. */
export function DecisionFeed({
  decisions,
  onUpdated,
}: {
  decisions: Decision[];
  onUpdated: (d: Decision) => void;
}) {
  if (decisions.length === 0) {
    return (
      <div className="grid place-items-center rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        <Sparkles className="mb-2 h-5 w-5 text-signal" />
        All clear. ATLAS will surface decisions here as conditions develop.
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <AnimatePresence mode="popLayout">
        {decisions.map((d) => (
          <DecisionCard key={d.id} decision={d} onUpdated={onUpdated} />
        ))}
      </AnimatePresence>
    </div>
  );
}
