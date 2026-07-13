import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Decision } from '@/types';
import { DecisionFeed } from './DecisionFeed';

// framer-motion animates via rAF; jsdom handles it, no mock needed.

const decision = (over: Partial<Decision> = {}): Decision => ({
  id: 'dec-1',
  category: 'crowd-safety',
  title: 'Relieve congestion at Lower Concourse',
  insight: 'Density is at 96% and rising.',
  priority: 92,
  confidence: 0.9,
  status: 'proposed',
  createdAt: Date.now(),
  zoneId: 'concourse-lower',
  signals: [{ label: 'Density', value: '96%' }],
  actions: [{ id: 'a1', label: 'Deploy stewards', assignTo: 'stewards', etaMinutes: 3, primary: true }],
  generatedBy: 'deterministic-fallback',
  ...over,
});

describe('DecisionFeed', () => {
  it('renders the empty state when there are no decisions', () => {
    render(<DecisionFeed decisions={[]} onUpdated={vi.fn()} />);
    expect(screen.getByText(/All clear/i)).toBeInTheDocument();
  });

  it('renders a decision card with its insight and primary action', () => {
    render(<DecisionFeed decisions={[decision()]} onUpdated={vi.fn()} />);
    expect(screen.getByText('Relieve congestion at Lower Concourse')).toBeInTheDocument();
    expect(screen.getByText(/Density is at 96%/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Dispatch: Deploy stewards/i })).toBeInTheDocument();
  });

  it('shows a dispatched status for accepted decisions', () => {
    render(<DecisionFeed decisions={[decision({ status: 'accepted' })]} onUpdated={vi.fn()} />);
    expect(screen.getByText('Dispatched')).toBeInTheDocument();
  });
});
