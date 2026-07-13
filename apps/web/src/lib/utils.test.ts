import { describe, expect, it } from 'vitest';
import { cn, formatDuration, matchClockLabel } from './utils';

describe('cn', () => {
  it('merges classes and resolves Tailwind conflicts', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
    expect(cn('text-sm', false && 'hidden', 'font-bold')).toBe('text-sm font-bold');
  });
});

describe('formatDuration', () => {
  it('formats seconds, minutes and combined', () => {
    expect(formatDuration(45)).toBe('45s');
    expect(formatDuration(120)).toBe('2m');
    expect(formatDuration(150)).toBe('2m 30s');
  });
});

describe('matchClockLabel', () => {
  it('describes each match phase', () => {
    expect(matchClockLabel(30)).toBe('KO −30′');
    expect(matchClockLabel(-10)).toBe('10′ 1st half');
    expect(matchClockLabel(-50)).toBe('Half-time');
    expect(matchClockLabel(-70)).toBe('55′ 2nd half');
    expect(matchClockLabel(-110)).toBe('Full-time +5′');
  });
});
