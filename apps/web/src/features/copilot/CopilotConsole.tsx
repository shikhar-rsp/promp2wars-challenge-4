'use client';

import { METLIFE_STADIUM } from '@atlas/shared';
import { motion } from 'framer-motion';
import { Accessibility, Loader2, MapPin, Mic, Send, Sparkles } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { AppHeader } from '@/components/app-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSpeech } from '@/hooks/useSpeech';
import { api } from '@/lib/api';
import { formatDuration } from '@/lib/utils';
import type { AccessibilityNeed, FanContext, Route } from '@/types';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  provider?: string;
  cached?: boolean;
  route?: Route;
}

const ACCESS_OPTIONS: { value: AccessibilityNeed; label: string }[] = [
  { value: 'wheelchair', label: 'Wheelchair' },
  { value: 'step-free', label: 'Step-free' },
  { value: 'low-sensory', label: 'Low-sensory' },
  { value: 'visual-assist', label: 'Visual assist' },
  { value: 'hearing-assist', label: 'Hearing assist' },
];

const SUGGESTIONS = [
  'Where is the nearest step-free restroom?',
  '¿Dónde puedo comprar comida halal?',
  'How do I get to my seat from Gate A?',
  'Quel est le chemin le plus rapide vers la sortie?',
];

let messageSeq = 0;
const nextId = () => `m${++messageSeq}`;

export function CopilotConsole() {
  const zones = METLIFE_STADIUM.zones;
  const seatingZones = useMemo(() => zones.filter((z) => z.kind === 'seating'), [zones]);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [currentZoneId, setCurrentZoneId] = useState('gate-a');
  const [seatZoneId, setSeatZoneId] = useState('seating-100-north');
  const [needs, setNeeds] = useState<AccessibilityNeed[]>([]);
  const { listening, supported, listen } = useSpeech();
  const listRef = useRef<HTMLDivElement>(null);

  function toggleNeed(need: AccessibilityNeed) {
    setNeeds((n) => (n.includes(need) ? n.filter((x) => x !== need) : [...n, need]));
  }

  async function send(question: string) {
    const q = question.trim();
    if (!q || pending) return;
    setInput('');
    const userMsg: Message = { id: nextId(), role: 'user', text: q };
    setMessages((m) => [...m, userMsg]);
    setPending(true);

    const fan: FanContext = {
      fanId: 'demo-fan',
      currentZoneId,
      seatZoneId,
      accessibilityNeeds: needs,
      minutesToKickoff: 35,
    };

    try {
      const res = await api.copilot(q, fan);
      setMessages((m) => [
        ...m,
        {
          id: nextId(),
          role: 'assistant',
          text: res.answer,
          provider: res.provider,
          cached: res.cached,
          route: res.route,
        },
      ]);
    } catch (e) {
      setMessages((m) => [
        ...m,
        { id: nextId(), role: 'assistant', text: `Sorry — I could not reach the assistant. (${(e as Error).message})` },
      ]);
    } finally {
      setPending(false);
      requestAnimationFrame(() => listRef.current?.scrollTo({ top: 1e9, behavior: 'smooth' }));
    }
  }

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main id="main" className="mx-auto grid max-w-[1440px] gap-4 px-4 py-5 md:px-6 lg:grid-cols-12">
        {/* Context sidebar */}
        <aside className="lg:col-span-4">
          <Card>
            <CardHeader>
              <CardTitle>Your match-day context</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">
                The copilot grounds every answer in this context — so guidance is specific to your
                location, seat and accessibility needs, in whatever language you ask.
              </p>

              <label className="block text-xs font-medium">
                <span className="mb-1 flex items-center gap-1.5 text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" /> Current location
                </span>
                <select
                  value={currentZoneId}
                  onChange={(e) => setCurrentZoneId(e.target.value)}
                  className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
                >
                  {zones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-xs font-medium">
                <span className="mb-1 block text-muted-foreground">Your seat</span>
                <select
                  value={seatZoneId}
                  onChange={(e) => setSeatZoneId(e.target.value)}
                  className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
                >
                  {seatingZones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.name}
                    </option>
                  ))}
                </select>
              </label>

              <div>
                <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Accessibility className="h-3.5 w-3.5" /> Accessibility needs
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {ACCESS_OPTIONS.map((opt) => {
                    const active = needs.includes(opt.value);
                    return (
                      <button
                        key={opt.value}
                        onClick={() => toggleNeed(opt.value)}
                        aria-pressed={active}
                        className={
                          'rounded-full border px-2.5 py-1 text-xs transition-colors ' +
                          (active
                            ? 'border-signal bg-signal/10 text-signal'
                            : 'text-muted-foreground hover:bg-accent')
                        }
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </aside>

        {/* Conversation */}
        <section className="flex h-[calc(100vh-6.5rem)] flex-col lg:col-span-8">
          <div ref={listRef} className="scroll-thin flex-1 space-y-4 overflow-y-auto pb-4">
            {messages.length === 0 ? (
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
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        onClick={() => send(s)}
                        className="rounded-md border bg-card px-3 py-2 text-left text-sm hover:bg-accent"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              messages.map((m) => <MessageBubble key={m.id} message={m} />)
            )}
            {pending && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> ATLAS is thinking…
              </div>
            )}
          </div>

          {/* Composer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
            className="flex items-center gap-2 rounded-lg border bg-card p-2"
          >
            {supported && (
              <Button
                type="button"
                variant={listening ? 'primary' : 'ghost'}
                size="icon"
                aria-label={listening ? 'Listening…' : 'Speak your question'}
                onClick={() => listen((text) => setInput(text))}
              >
                <Mic className="h-4 w-4" />
              </Button>
            )}
            <label htmlFor="copilot-input" className="sr-only">
              Ask the fan copilot
            </label>
            <input
              id="copilot-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask in any language…"
              className="flex-1 bg-transparent px-2 text-sm outline-none"
              autoComplete="off"
            />
            <Button type="submit" size="icon" disabled={pending || !input.trim()} aria-label="Send">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </section>
      </main>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
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
              {message.route.steps.map((s, i) => (
                <li key={s.zoneId} className="flex items-center gap-1">
                  {i > 0 && <span className="text-muted-foreground">→</span>}
                  <span>{s.zoneName}</span>
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
