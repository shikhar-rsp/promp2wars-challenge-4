'use client';

import { Activity, Radio } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ThemeToggle } from '@/components/theme-toggle';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/command-center', label: 'Command Center' },
  { href: '/copilot', label: 'Fan Copilot' },
];

/** Global app chrome: brand, primary nav, live indicator and theme toggle. */
export function AppHeader({ live }: { live?: boolean }) {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-6 px-4 md:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-signal text-signal-foreground">
            <Activity className="h-4 w-4" />
          </span>
          ATLAS
        </Link>

        <nav aria-label="Primary" className="flex items-center gap-1">
          {NAV.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm transition-colors',
                  active
                    ? 'bg-accent text-accent-foreground font-medium'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          {live !== undefined && (
            <span
              className="flex items-center gap-1.5 text-xs text-muted-foreground"
              aria-live="polite"
            >
              <Radio
                className={cn('h-3.5 w-3.5', live ? 'text-signal' : 'text-sev-critical')}
                aria-hidden
              />
              {live ? 'Live' : 'Offline'}
            </span>
          )}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
