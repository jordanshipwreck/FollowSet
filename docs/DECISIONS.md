# Decision record

| # | Decision | Options considered | Chosen | Why | Date |
|---|---|---|---|---|---|
| 1 | Rebuild from source | Keep patching the minified bundle; recover the private Origin repo; rewrite | Rewrite in this repo | The source repo was unreachable, and every fix since was a hand edit of minified output. Nothing could be tested or reviewed. | 2026-10-27 |
| 2 | Stack | Vanilla JS single file; React + Vite + TS; Svelte | React + Vite + TS | Same framework the original used, typed, small output, no server. | 2026-10-27 |
| 3 | Data format | New schema with a migration; keep v2 | Keep v2 plus optional fields | Phones already hold real history. No migration means nothing to get wrong. | 2026-10-27 |
| 4 | Program calendar | Fixed week (Oct 26–Nov 1); repeat weekly; dated blocks | Repeat weekly | The fixed week made the app useless after Nov 1. History stays keyed by date. | 2026-10-27 |
| 5 | Drive merge | Union of logs; session last-writer-wins; per-log CRDT | Session last-writer-wins | Predictable for one person on one or two devices. A union would resurrect deleted sets. | 2026-10-27 |
| 6 | Navigation | Swipe-up sheet with 7 tabs (old); bottom tab bar | Floating 5-tab pill nav, full-screen runner | The drag sheet hid most features and fought scrolling. | 2026-10-27 |
| 7 | Visual direction | Keep old look; generic Rondesign-style dark bento; match Jordan's Rondesign screenshots | Match the screenshots (light glass, dark runner) | Jordan wants @rondesignlabs as the guide and sent 10 posts. Light canvas and frosted cards for browsing; dark mauve glass for the workout screen so the demo stays brightest in the gym. Spec: docs/DESIGN.md. | 2026-10-27 |
| 8 | Weight entry | Keyboard only; steppers | Steppers + editable field | One-handed between sets; the keyboard still works. | 2026-10-27 |
| 9 | Accent color and themes | Keep lime; hot pink; neon pink; light only; light + dark | Neon hot pink #ff3d9a, Auto/Light/Dark | Jordan asked for hot or neon pink in both modes. #ff3d9a reads as neon on both backgrounds. Dark text on pink (7:1) instead of white (3:1) keeps buttons legible. | 2026-10-27 |
