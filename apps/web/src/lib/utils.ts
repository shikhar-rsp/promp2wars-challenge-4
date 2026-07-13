import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge conditional class names, resolving Tailwind conflicts. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Format seconds as a compact "Xm Ys" walk time. */
export function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.round(totalSeconds % 60);
  if (m === 0) return `${s}s`;
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
}

/** Human match-clock label from minutes-to-kickoff. */
export function matchClockLabel(minutesToKickoff: number): string {
  if (minutesToKickoff > 0) return `KO −${minutesToKickoff}′`;
  const elapsed = -minutesToKickoff;
  if (elapsed <= 45) return `${elapsed}′ 1st half`;
  if (elapsed <= 60) return `Half-time`;
  if (elapsed <= 105) return `${elapsed - 15}′ 2nd half`;
  return `Full-time +${elapsed - 105}′`;
}
