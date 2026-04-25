# Rotary Position Embedding — Interactive Explainer

**Cornell CS 4782 / 5782 · Spring 2026 · Extra Credit Demo**
**Author:** Yung-Chia Chang (NetID: yc2998)

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

Three interactive panels that build up RoPE from first principles:

1. **Panel 01 — The rotation idea.** Slide position `m` and frequency `θ`
   and watch a 2-D query vector rotate by `m·θ` on the unit circle.
   Establishes "position = angle."

2. **Panel 02 — Many frequencies at once.** Shows that a `d`-dim vector is
   split into `d/2` planes, each rotating at its own frequency
   `θ_i = 10000^(-2i/d)`. An amber→blue gradient makes the fast/slow
   multi-scale structure visible at a glance.

3. **Panel 03 — Relative position, for free.** The punchline. A
   *"Lock distance m−n"* toggle lets the user shift both positions
   simultaneously while watching the inner product ⟨q_m, k_n⟩ stay fixed —
   a live demonstration that RoPE attention depends only on relative
   position.

---

## File structure

```
rope-demo/
├── index.html                      # main page
├── styles.css                      # design system (editorial dark theme)
├── rope.js                         # canvas visualizations + math
├── vendor/
│   ├── katex/                      # bundled KaTeX 0.16.9
│   └── fonts/                      # Fraunces + Manrope + JetBrains Mono
├── yc2998_demo_rationale.pdf       # 300-word design rationale
├── yc2998_demo_video.mp4           # 2-min screen recording
└── README.md                       # this file
```

---

## Reference

Su, J., Lu, Y., Pan, S., Murtadha, A., Wen, B., & Liu, Y. (2021).
*RoFormer: Enhanced Transformer with Rotary Position Embedding.*
arXiv:2104.09864
