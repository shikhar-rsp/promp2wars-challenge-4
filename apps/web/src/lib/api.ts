import type {
  CrowdReading,
  Decision,
  FanContext,
  Incident,
  ProviderMetricsLike,
  Route,
  StadiumSnapshot,
} from '@/types';
import { API_URL } from './config';

/** Thin, typed fetch wrapper. Throws on non-2xx with a useful message. */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${detail.slice(0, 160)}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  snapshot: () => request<StadiumSnapshot>('/api/stadium'),
  crowd: () => request<{ readings: CrowdReading[] }>('/api/crowd'),
  incidents: () => request<{ incidents: Incident[] }>('/api/incidents'),
  decisions: () => request<{ decisions: Decision[] }>('/api/decisions'),
  metrics: () =>
    request<{ providers: ProviderMetricsLike[]; cache: { hits: number; misses: number; hitRate: number; size: number } }>(
      '/api/metrics',
    ),

  setDecisionStatus: (id: string, status: Decision['status']) =>
    request<{ decision: Decision }>(`/api/decisions/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    }),

  reportIncident: (input: Pick<Incident, 'type' | 'zoneId' | 'reportedBy' | 'raw'>) =>
    request<{ incident: Incident }>('/api/incidents', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  copilot: (question: string, fan: FanContext) =>
    request<{ answer: string; provider: string; cached: boolean; route?: Route }>('/api/copilot', {
      method: 'POST',
      body: JSON.stringify({ question, fan }),
    }),
};
