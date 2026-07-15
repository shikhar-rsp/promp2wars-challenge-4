import type { AccessibilityNeed, Route } from '@/types';

/** A single turn in the copilot conversation. */
export interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  provider?: string;
  cached?: boolean;
  route?: Route;
}

export const ACCESS_OPTIONS: ReadonlyArray<{ value: AccessibilityNeed; label: string }> = [
  { value: 'wheelchair', label: 'Wheelchair' },
  { value: 'step-free', label: 'Step-free' },
  { value: 'low-sensory', label: 'Low-sensory' },
  { value: 'visual-assist', label: 'Visual assist' },
  { value: 'hearing-assist', label: 'Hearing assist' },
];

/** Multilingual example prompts shown on the empty state. */
export const SUGGESTIONS: readonly string[] = [
  'Where is the nearest step-free restroom?',
  '¿Dónde puedo comprar comida halal?',
  'How do I get to my seat from Gate A?',
  'Quel est le chemin le plus rapide vers la sortie?',
];
