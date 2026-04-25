# Rotary Position Embedding — Interactive Explainer

**Cornell CS 4782 / 5782 · Spring 2026 · Extra Credit Demo**
**Author:** Yung-Chia Chang

---

## How to run

Double-click `index.html`, or from a terminal:

```bash
# From this directory
open index.html          # macOS
xdg-open index.html      # Linux
start index.html         # Windows
```

The demo is a **static HTML page** — no build step, no server, no network.
All dependencies (KaTeX, webfonts) are bundled under `vendor/` so it runs
fully offline in any modern browser.

Tested on Chrome, Safari, and Firefox.

---

## What the demo covers

Four interactive panels that build up RoPE from first principles:

0. **Panel 00 — Why we need this.** Side-by-side attention matrices with
   a Shuffle button and a "position info" toggle. Demonstrates that raw
   attention is order-blind: shuffling tokens just permutes the same set
   of values. Once positional info is injected, every value changes,
   and each shuffle produces an entirely new pattern. Establishes the
   bug RoPE solves.

1. **Panel 01 — The rotation idea.** Slide position `m` and watch a 2-D
   query vector rotate by `m·θ` on the unit circle. Length stays fixed;
   only direction changes. Establishes "position = angle."

2. **Panel 02 — Many frequencies at once.** Shows that a `d`-dim vector
   is split into `d/2` planes, each rotating at its own frequency
   `θ_i = 10000^(-2i/d)`. Visualizes the multi-scale fast/slow
   structure that avoids periodicity in long contexts.

3. **Panel 03 — Relative position, for free.** The punchline. A
   *"Lock distance m−n"* toggle lets the user shift both positions
   simultaneously while watching the inner product ⟨q_m, k_n⟩ stay
   fixed — a live demonstration that RoPE attention depends only on
   relative position.

---

## For instructors using this in class

- **Open and go.** Just open `index.html` — no build, no install, no
  network required.
- **Day theme is default**, optimized for projectors. Top-right toggle
  for night mode if students are viewing on their own.
- **Each panel has one primary interaction** — no hidden controls, no
  cognitive overhead.
- **Suggested 5-minute classroom flow:**
  1. Panel 0 with PE off → shuffle a few times → "attention is
     order-blind"
  2. Toggle PE on → shuffle again → "now order matters; every shuffle
     gives a new pattern"
  3. Panel 1 → drag slider → "RoPE = rotation, position = angle"
  4. Panel 2 → drag slider → "many clocks at different speeds avoid
     periodicity"
  5. Panel 3 → enable Lock distance → drag slider → "only relative
     distance matters"
- All assets bundled locally — works offline, no CDN dependencies, no
  external fonts.

---

## File structure

```
rope-demo/
├── index.html                      # main page
├── styles.css                      # design system (editorial light/dark)
├── rope.js                         # canvas visualizations + math
├── vendor/
│   ├── katex/                      # bundled KaTeX 0.16.9
│   └── fonts/                      # Fraunces + Manrope + JetBrains Mono
└── README.md                       # this file
```

---

## Reference

Su, J., Lu, Y., Pan, S., Murtadha, A., Wen, B., & Liu, Y. (2021).
*RoFormer: Enhanced Transformer with Rotary Position Embedding.*
arXiv:2104.09864
