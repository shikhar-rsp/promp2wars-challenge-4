'use client';

import { motion } from 'framer-motion';
import { memo } from 'react';
import { formatDuration } from '@/lib/utils';
import type { Message } from './types';

/**
 * A single conversation turn. Memoised so a new message (or a re-render of the
 * list) doesn't re-render every prior bubble.
 */
function MessageBubbleImpl({ message }: { message: Message }) {
  const isUser = message.role === 'user';
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={isUser ? 'flex justify-end' : 'flex justify-start'}
    >
      <div
        className={
          'max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ' +
          (isUser ? 'bg-signal text-signal-foreground' : 'border bg-card')
        }
      >
        <p className="whitespace-pre-wrap">{message.text}</p>

        {message.route?.found && (
          <div className="mt-2 rounded-lg border bg-background/60 p-2">
            <div className="text-[11px] font-medium text-muted-foreground">
              Suggested route · {formatDuration(message.route.totalSeconds)}
            </div>
            <ol className="mt-1 flex flex-wrap items-center gap-1 text-xs">
              {message.route.steps.map((step, i) => (
                <li key={step.zoneId} className="flex items-center gap-1">
                  {i > 0 && <span className="text-muted-foreground">→</span>}
                  <span>{step.zoneName}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {!isUser && message.provider && (
          <div className="mt-1.5 text-[10px] text-muted-foreground">
            via {message.provider}
            {message.cached ? ' · cached' : ''}
          </div>
        )}
      </div>
    </motion.div>
  );
}

export const MessageBubble = memo(MessageBubbleImpl);
