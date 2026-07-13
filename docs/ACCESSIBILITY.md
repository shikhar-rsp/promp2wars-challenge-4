# Accessibility

ATLAS treats accessibility as both a **product feature** (accessibility-aware routing for fans) and a **UI standard** (WCAG-minded interface).

## In the product
- **Accessibility-aware routing**: when a fan declares needs (wheelchair, step-free), `StadiumRouter` filters to wheelchair-accessible zones only, and the Copilot is instructed to suggest only step-free options.
- **Accessibility as a first-class incident type** and decision category, with dedicated dispatch (facilities restore access).
- Zone model carries `wheelchairAccessible` and amenity flags (accessible stalls, sensory room, assistance desk).

## In the interface (WCAG 2.1 AA-minded)
- **Keyboard navigation**: all interactive elements are focusable; the tactical-map zones are `role="button"` with `tabIndex` and Enter/Space handlers; a **skip link** jumps to `#main`.
- **Visible focus**: a global `:focus-visible` ring (never removed).
- **Screen readers**: ARIA labels on the crowd map (`role="img"` with a descriptive label; each zone announces name, level and % full), on the theme toggle, the live indicator (`aria-live`), and form controls (labelled selects/inputs; `sr-only` labels where visual context suffices).
- **Colour**: the density ramp is a colour-blind-safe (viridis-like) scale, and colour is never the *only* signal — badges carry text, decisions carry priority numbers, tiles carry labels.
- **Contrast**: light and dark palettes are tuned for AA text contrast on their surfaces.
- **Motion**: `prefers-reduced-motion` disables animations/transitions globally.
- **Semantics**: landmark elements (`header`, `main`, `nav`, `aside`, `article`), heading hierarchy, `aria-current` on active nav.
- **Voice input**: browser-native Web Speech API offers an alternative to typing in the Copilot.

## Verifying
- Keyboard-only: tab through Command Center and Copilot; every control is reachable and operable.
- Screen reader: VoiceOver/NVDA announce map zones, decisions and incident summaries.
- Automated: run axe/Lighthouse against `/`, `/command-center`, `/copilot`.
