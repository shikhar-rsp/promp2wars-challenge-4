'use client';

import { Mic, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSpeech } from '@/hooks/useSpeech';

interface ComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  pending: boolean;
}

/** Message input with voice capture (Web Speech) and send. */
export function Composer({ value, onChange, onSubmit, pending }: ComposerProps) {
  const { listening, supported, listen } = useSpeech();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="flex items-center gap-2 rounded-lg border bg-card p-2"
    >
      {supported && (
        <Button
          type="button"
          variant={listening ? 'primary' : 'ghost'}
          size="icon"
          aria-label={listening ? 'Listening…' : 'Speak your question'}
          onClick={() => listen((text) => onChange(text))}
        >
          <Mic className="h-4 w-4" />
        </Button>
      )}
      <label htmlFor="copilot-input" className="sr-only">
        Ask the fan copilot
      </label>
      <input
        id="copilot-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Ask in any language…"
        className="flex-1 bg-transparent px-2 text-sm outline-none"
        autoComplete="off"
      />
      <Button type="submit" size="icon" disabled={pending || !value.trim()} aria-label="Send">
        <Send className="h-4 w-4" />
      </Button>
    </form>
  );
}
