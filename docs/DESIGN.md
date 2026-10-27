# Followset design spec

Modeled on Rondesign Lab's app work (Instagram @rondesignlabs). Jordan sent 10 screenshots on 2026-10-26: TD Bank payment timeline, crypto wallet, inventory iPad, credit score dashboards, glucose monitoring, automatic payments, invoice "Pay in full". The screenshots are not in this repo (they are Rondesign's work, and the repo is public). This file records what we took from them.

Tokens live at the top of `src/styles.css`. Change them there, not in components.

## Principles

1. **Light, warm, airy.** Off-white canvas (`--bg #ecebe7`) with soft blurred color glows behind (`<Aura />`).
2. **White frosted cards.** `--card` is translucent white with backdrop blur, 28–34 px radius, and a soft drop shadow with a top highlight.
3. **Numbers are the hero.** Big numerals in a light weight (Outfit 300, tight tracking), with a small superscript unit: `24k lb`, `~60 min`, `1/5`.
4. **One loud accent.** Neon lime `--lime #d9f34a` means done / active / go: check dots, the live state, the knob, the current week. Never decoration.
5. **Black for action.** Black circle ↗ buttons open detail. A black pill marks the active tab or nav item.
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

| Token | Value | Use |
|---|---|---|
| `--bg` | #ecebe7 | Canvas |
| `--card` | white 78% + blur | Cards |
| `--ink` | #0e0e0c | Text, black buttons, active pills |
| `--muted` | #8b8a84 | Secondary text, labels |
| `--lime` | #d9f34a | Done / active / go |
| `--lime-deep` | #b6d21f | Lime on white where #d9f34a is too faint |
| `--green` | #5cc27a | "Done" status pill (glassy, like the reference's "Active") |
| `--rose`, `--peach` | #e9a6c0, #f4b98a | Glow colors, warnings |
| `--red` | #e5533f | Destructive, pain notes |

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
- The rest overlay is frosted dark. At zero it flips to full lime with ink text ("Time's up. Go.").

## Rules for new screens

- Start from `.glass` (card) or `.stat` (number tile). Don't invent new surfaces.
- One lime element per card at most.
- Numbers use `<Num>` so the weight and unit treatment stays consistent.
- Every tappable thing is at least 44 px.
- Check at 390 px wide, in both the light app and the dark runner.
