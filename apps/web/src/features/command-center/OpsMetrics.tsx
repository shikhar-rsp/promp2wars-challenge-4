'use client';

import { useEffect, useState } from 'react';
import { Database, Server } from 'lucide-react';
import type { ProviderMetricsLike } from '@/types';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

const CIRCUIT_TONE = {
  closed: 'text-sev-low',
  'half-open': 'text-sev-medium',
  open: 'text-sev-critical',
};

/**
 * AI resilience panel. Surfaces the provider failover chain, per-provider
 * request/failure counts, circuit-breaker state and the response-cache hit
 * rate — making the platform's efficiency and reliability visible, not just
 * claimed. Polls the metrics endpoint on a light interval.
 */
export function OpsMetrics() {
  const [providers, setProviders] = useState<ProviderMetricsLike[]>([]);
  const [cache, setCache] = useState<{ hitRate: number; hits: number; size: number } | null>(null);

  useEffect(() => {
    let active = true;
    const load = () =>
      api
        .metrics()
        .then((m) => {
          if (!active) return;
          setProviders(m.providers);
          setCache(m.cache);
        })
        .catch(() => undefined);
    load();
    const id = setInterval(load, 5000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-lg border bg-card p-3">
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          <Database className="h-3.5 w-3.5" /> Response cache
        </span>
        <span className="text-sm font-semibold tabular-nums text-signal">
          {cache ? `${Math.round(cache.hitRate * 100)}% hit` : '—'}
        </span>
      </div>

      <ul className="space-y-1.5">
        {providers.map((p) => (
          <li
            key={p.provider}
            className={cn(
              'flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-xs',
              p.requests === 0 && 'opacity-60',
            )}
          >
            <Server className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-medium capitalize">{p.provider}</span>
            <span className={cn('text-[10px] uppercase', CIRCUIT_TONE[p.circuit])}>
              ● {p.circuit}
            </span>
            <span className="ml-auto tabular-nums text-muted-foreground">
              {p.requests} req · {p.failures} fail
            </span>
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-muted-foreground">
        Requests route top-down; a rate-limited or failing provider is skipped automatically.
      </p>
    </div>
  );
}
