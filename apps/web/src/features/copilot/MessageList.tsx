'use client';

import { Loader2, Sparkles } from 'lucide-react';
import type { RefObject } from 'react';
import { MessageBubble } from './MessageBubble';
import { SUGGESTIONS, type Message } from './types';

interface MessageListProps {
  messages: Message[];
  pending: boolean;
  onPickSuggestion: (suggestion: string) => void;
  listRef: RefObject<HTMLDivElement | null>;
}

/** The scrolling conversation area, including the empty state and typing hint. */
export function MessageList({ messages, pending, onPickSuggestion, listRef }: MessageListProps) {
  return (
    <div ref={listRef} className="scroll-thin flex-1 space-y-4 overflow-y-auto pb-4">
      {messages.length === 0 ? (
        <EmptyState onPick={onPickSuggestion} />
      ) : (
        messages.map((message) => <MessageBubble key={message.id} message={message} />)
      )}
      {pending && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> ATLAS is thinking…
        </div>
      )}
    </div>
  );
}

function EmptyState({ onPick }: { onPick: (suggestion: string) => void }) {
  return (
    <div className="grid h-full place-items-center">
      <div className="max-w-md text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-signal/10 text-signal">
          <Sparkles className="h-6 w-6" />
        </span>
        <h2 className="mt-4 text-lg font-semibold">Fan Copilot</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Ask anything about getting around MetLife Stadium — in any language. Try:
        </p>
        <div className="mt-4 grid gap-2">
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => onPick(suggestion)}
              className="rounded-md border bg-card px-3 py-2 text-left text-sm hover:bg-accent"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
