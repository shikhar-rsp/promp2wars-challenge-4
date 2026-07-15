'use client';

import { useCallback, useRef, useState } from 'react';
import { api } from '@/lib/api';
import type { FanContext } from '@/types';
import type { Message } from './types';

let messageSeq = 0;
const nextId = (): string => `m${++messageSeq}`;

export interface UseCopilot {
  messages: Message[];
  pending: boolean;
  listRef: React.RefObject<HTMLDivElement | null>;
  send: (question: string, fan: FanContext) => Promise<void>;
}

/**
 * Owns the copilot conversation state and the request lifecycle, keeping the
 * view components purely presentational. Isolating this here means the send
 * flow (optimistic user message → API call → assistant reply / error) is
 * testable and reusable independently of the UI.
 */
export function useCopilot(): UseCopilot {
  const [messages, setMessages] = useState<Message[]>([]);
  const [pending, setPending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => listRef.current?.scrollTo({ top: 1e9, behavior: 'smooth' }));
  }, []);

  const send = useCallback(
    async (question: string, fan: FanContext) => {
      const text = question.trim();
      if (!text || pending) return;

      setMessages((prev) => [...prev, { id: nextId(), role: 'user', text }]);
      setPending(true);
      try {
        const res = await api.copilot(text, fan);
        setMessages((prev) => [
          ...prev,
          {
            id: nextId(),
            role: 'assistant',
            text: res.answer,
            provider: res.provider,
            cached: res.cached,
            // Attach a route only when present, so the optional stays absent.
            ...(res.route ? { route: res.route } : {}),
          },
        ]);
      } catch (e) {
        setMessages((prev) => [
          ...prev,
          {
            id: nextId(),
            role: 'assistant',
            text: `Sorry — I could not reach the assistant. (${(e as Error).message})`,
          },
        ]);
      } finally {
        setPending(false);
        scrollToEnd();
      }
    },
    [pending, scrollToEnd],
  );

  return { messages, pending, listRef, send };
}
