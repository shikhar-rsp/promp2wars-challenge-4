import type { Config } from 'tailwindcss';

/**
 * Design tokens for ATLAS. Colours are driven by CSS variables (see
 * globals.css) so light/dark are a single source of truth and the palette is
 * deliberately restrained — one signal accent, a semantic severity ramp, and
 * neutral surfaces — rather than a generic AI gradient.
 */
const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    container: { center: true, padding: '1.5rem', screens: { '2xl': '1440px' } },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
        popover: { DEFAULT: 'hsl(var(--popover))', foreground: 'hsl(var(--popover-foreground))' },
        accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
        signal: { DEFAULT: 'hsl(var(--signal))', foreground: 'hsl(var(--signal-foreground))' },
        // Semantic severity ramp — used by badges, the heatmap legend, decisions.
        sev: {
          info: 'hsl(var(--sev-info))',
          low: 'hsl(var(--sev-low))',
          medium: 'hsl(var(--sev-medium))',
          high: 'hsl(var(--sev-high))',
          critical: 'hsl(var(--sev-critical))',
        },
      },
      borderRadius: { lg: 'var(--radius)', md: 'calc(var(--radius) - 4px)', sm: 'calc(var(--radius) - 8px)' },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-ring': {
          '0%': { boxShadow: '0 0 0 0 hsl(var(--signal) / 0.5)' },
          '70%': { boxShadow: '0 0 0 8px hsl(var(--signal) / 0)' },
          '100%': { boxShadow: '0 0 0 0 hsl(var(--signal) / 0)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.35s cubic-bezier(0.22, 1, 0.36, 1)',
        'pulse-ring': 'pulse-ring 2s infinite',
      },
    },
  },
  plugins: [],
};

export default config;
