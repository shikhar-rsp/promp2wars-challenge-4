import { ArrowRight, Brain, Languages, MapPinned, ShieldCheck, Zap } from 'lucide-react';
import Link from 'next/link';
import { AppHeader } from '@/components/app-header';

const FEATURES = [
  {
    icon: Brain,
    title: 'Decision Feed, not a chatbot',
    body: 'ATLAS proactively emits ranked, explainable operational decisions — Signal → Insight → Action → one-tap dispatch.',
  },
  {
    icon: MapPinned,
    title: 'Live crowd intelligence',
    body: 'A real-time density map with 15-minute congestion forecasting and congestion-aware, accessible routing.',
  },
  {
    icon: Languages,
    title: 'Multilingual by design',
    body: 'Fan copilot and incident triage handle any language via LLM prompting — no dedicated translation API.',
  },
  {
    icon: ShieldCheck,
    title: 'Resilient AI core',
    body: 'Four providers behind one interface with automatic failover, caching, dedup and prompt-injection defense.',
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <AppHeader />
      <main id="main">
        {/* Hero */}
        <section className="bg-grid relative overflow-hidden border-b">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent to-background" />
          <div className="relative mx-auto max-w-[1440px] px-4 py-20 md:px-6 md:py-28">
            <div className="max-w-3xl">
              <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground">
                <Zap className="h-3.5 w-3.5 text-signal" />
                FIFA World Cup 2026 · MetLife Stadium
              </span>
              <h1 className="mt-6 text-4xl font-semibold tracking-tight md:text-6xl">
                The AI chief-of-staff for stadium operations.
              </h1>
              <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
                ATLAS turns a flood of crowd, incident and transport signals into a live stream of
                ranked, explainable decisions — so operators act, not scroll. Built for crowd
                safety, accessibility and multilingual fan assistance at World Cup scale.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/command-center"
                  className="inline-flex items-center gap-2 rounded-md bg-signal px-5 py-2.5 text-sm font-medium text-signal-foreground transition-colors hover:bg-signal/90"
                >
                  Open Command Center <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/copilot"
                  className="inline-flex items-center gap-2 rounded-md border px-5 py-2.5 text-sm font-medium transition-colors hover:bg-accent"
                >
                  Try the Fan Copilot
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Feature grid */}
        <section className="mx-auto max-w-[1440px] px-4 py-16 md:px-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-lg border bg-card p-5">
                <span className="grid h-10 w-10 place-items-center rounded-md bg-signal/10 text-signal">
                  <f.icon className="h-5 w-5" />
                </span>
                <h2 className="mt-4 text-sm font-semibold">{f.title}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
