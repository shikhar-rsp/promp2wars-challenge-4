'use client';

import { METLIFE_STADIUM } from '@atlas/shared';
import { useMemo, useState } from 'react';
import { AppHeader } from '@/components/app-header';
import { Composer } from './Composer';
import { ContextPanel } from './ContextPanel';
import { MessageList } from './MessageList';
import { useCopilot } from './useCopilot';
import { useFanContext } from './useFanContext';

/**
 * The Fan Copilot screen. Purely compositional: conversation state lives in
 * {@link useCopilot}, the fan's context in {@link useFanContext}, and each
 * region (sidebar, message list, composer) is its own focused component.
 */
export function CopilotConsole() {
  const zones = METLIFE_STADIUM.zones;
  const seatingZones = useMemo(() => zones.filter((z) => z.kind === 'seating'), [zones]);

  const { messages, pending, listRef, send } = useCopilot();
  const context = useFanContext();
  const [input, setInput] = useState('');

  const submit = (question: string) => {
    setInput('');
    void send(question, context.fan);
  };

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main id="main" className="mx-auto grid max-w-[1440px] gap-4 px-4 py-5 md:px-6 lg:grid-cols-12">
        <aside className="lg:col-span-4">
          <ContextPanel
            zones={zones}
            seatingZones={seatingZones}
            currentZoneId={context.currentZoneId}
            seatZoneId={context.seatZoneId}
            needs={context.needs}
            onCurrentZone={context.setCurrentZoneId}
            onSeatZone={context.setSeatZoneId}
            onToggleNeed={context.toggleNeed}
          />
        </aside>

        <section className="flex h-[calc(100vh-6.5rem)] flex-col lg:col-span-8">
          <MessageList
            messages={messages}
            pending={pending}
            onPickSuggestion={submit}
            listRef={listRef}
          />
          <Composer
            value={input}
            onChange={setInput}
            onSubmit={() => submit(input)}
            pending={pending}
          />
        </section>
      </main>
    </div>
  );
}
