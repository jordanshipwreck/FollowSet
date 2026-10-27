# Followset design spec

Modeled on Rondesign Lab's app work (Instagram @rondesignlabs). Jordan sent 10 screenshots on 2026-10-26: TD Bank payment timeline, crypto wallet, inventory iPad, credit score dashboards, glucose monitoring, automatic payments, invoice "Pay in full". The screenshots are not in this repo (they are Rondesign's work, and the repo is public). This file records what we took from them.

Tokens live at the top of `src/styles.css`. Change them there, not in components.

## Principles

1. **Airy, with a dark twin.** Warm off-white canvas in Light (`--bg #ecebe7`), near-black in Dark (`#0d0d0c`), with soft blurred color glows behind (`<Aura />`).
2. **White frosted cards.** `--card` is translucent white with backdrop blur, 28–34 px radius, and a soft drop shadow with a top highlight.
3. **Numbers are the hero.** Big numerals in a light weight (Outfit 300, tight tracking), with a small superscript unit: `24k lb`, `~60 min`, `1/5`.
4. **One loud accent.** Neon lime `--accent #d9f34a` means done / active / go: check dots, the live state, the knob, the current week. Never decoration. (Hot pink was tried on 2026-10-27 and rejected.)
5. **Ink for action.** Ink circle ↗ buttons open detail; an ink pill marks the active tab or nav item. Ink is black in Light and near-white in Dark.
6. **Instrument-style data.** Tick rings (`<TickRing />`), dot rows (`<DotRow />`), tick-line charts with a dot marker, dot-matrix digits (Doto) for timers.
7. **Small uppercase labels.** `.label`: 11 px, 0.14 em tracking, muted.

## Type

| Use | Font | Weight | Size |
|---|---|---|---|
| Page titles, workout title, numerals | Outfit | 300 | 40–60 px |
| Headline second word ("Workout") | Outfit | 500 | 40 px |
| Body | Outfit | 300–400 | 15–16 px |
| Labels | Outfit | 500, uppercase | 11 px |
| Timers and clock | Doto | 700 | 22–58 px |

Both fonts are bundled (latin subset only) and work offline.

## Color

Two themes, chosen under You → Appearance: **Auto** (follows the phone), **Light**, **Dark**. Tokens live in `:root` (light) and `:root[data-theme="dark"]` in `src/styles.css`. `src/lib/theme.ts` sets `data-theme`, and an inline script in `index.html` does the same before first paint, so there is no flash.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | #ecebe7 | #0d0d0c | Canvas |
| `--card` | white 78% + blur | white 6% + blur | Cards |
| `--text` | #0e0e0c | #f4f4f1 | Body text |
| `--ink` / `--on-ink` | #0e0e0c / #fff | #f4f4f1 / #0e0e0c | "Black" action fills (they invert in dark) and the text on them |
| `--accent` | #d9f34a | #d9f34a | Neon lime: done / active / go |
| `--accent-ink` | #141600 | #141600 | Text on lime (never white: white on lime is unreadable) |
| `--accent-deep` | #b6d21f | #d9f34a | Lime for text or thin lines on the page background |
| `--glow-1..3` | amber, rose, lime | mauve, indigo, olive | Background aura |
| `--green` | #5cc27a | #5cc27a | "Done" status pill |
| `--red` | #e5533f | #e5533f | Destructive, pain notes |

Borders and tracks use `rgba(var(--ink-rgb), a)`, so they flip with the theme. Never hardcode `#000`, `#fff`, or ink rgba in new CSS.

In dark mode the main knob pill (Start workout) is lime instead of inverted white, so it stays the loudest thing on screen. The active nav icon turns dark on its white pill. The workout screen is dark in both themes.

## Components

| Component | Where | Reference cue |
|---|---|---|
| `KnobButton` | Start workout, Log set | "Pay in full" pill with a round knob and chevrons |
| `StatCard` | Today bento | Credit-score tiles: outline icon chip, label, big number, ↗ black circle |
| `TickRing` | Gains Grade, rest timer, work timer, muscle ratings | Gauge / variability dial |
| `DotRow` | Week progress | Dot progress rows |
| `Pills` | Library filter | "Karma / Credits / Money" switcher |
| Week strip | Today | Payment timeline months with lime check circles |
| Tick chart | Progress → Weekly volume | Glucose tick chart with dot markers |
| Status pills | Hero "Ready / Live / Done" | Green glass "Active" pill |

## Workout screen (dark variant)

The runner uses the reference's dark mauve glass (crypto wallet shots), so it reads well under gym lighting and the demo stays the brightest thing on screen.

- The background is `#141116`, plus the current exercise's still frame blurred at 48 px as a glow.
- Cards are white at 8% with an inner top highlight.
- The rest overlay is frosted dark. At zero it flips to full lime with dark text ("Time's up. Go.").

## Rules for new screens

- Start from `.glass` (card) or `.stat` (number tile). Don't invent new surfaces.
- One lime element per card at most.
- Numbers use `<Num>` so the weight and unit treatment stays consistent.
- Every tappable thing is at least 44 px.
- Check at 390 px wide in Light, Dark, and the workout screen.
