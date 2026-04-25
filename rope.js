/* ============================================================
   RoPE Interactive Explainer — rope.js
   Core math + canvas rendering for 4 visualizations
   ============================================================ */

// ---------- Tiny helpers ----------

function setupCanvas(canvas, logicalW, logicalH) {
  // DPR-aware sizing for crisp rendering on retina
  const dpr = window.devicePixelRatio || 1;
  canvas.width = logicalW * dpr;
  canvas.height = logicalH * dpr;
  // Use aspect-ratio so the canvas scales proportionally when CSS width:100% kicks in
  canvas.style.aspectRatio = `${logicalW} / ${logicalH}`;
  canvas.style.maxWidth = logicalW + "px";
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  return { ctx, w: logicalW, h: logicalH };
}

// Convert CSS var at runtime — allows the JS to stay aesthetically in sync
function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// Dynamic color palette — reads from CSS variables so theme toggle works
// We use a Proxy / getter object so every read always returns the current theme value
const COLORS = new Proxy(
  {},
  {
    get(_, key) {
      const map = {
        amber: "--amber",
        amberSoft: "--amber-soft",
        amberDeep: "--amber-deep",
        blue: "--blue",
        blueSoft: "--blue-soft",
        rose: "--rose",
        text0: "--text-0",
        text1: "--text-1",
        text2: "--text-2",
        text3: "--text-3",
        border: "--border",
        borderStrong: "--border-strong",
        bg0: "--bg-0",
        bg1: "--bg-1"
      };
      if (map[key]) return cssVar(map[key]);
      return "#000";
    }
  }
);

// Trigger re-render on theme change — panels register their draw() functions here
const _redrawCallbacks = [];
function onThemeChange(cb) {
  _redrawCallbacks.push(cb);
}
window.addEventListener("themechange", () => {
  _redrawCallbacks.forEach((cb) => {
    try {
      cb();
    } catch (e) {
      console.error("redraw failed", e);
    }
  });
});

// Draw an arrow with a filled triangular head
function drawArrow(ctx, x0, y0, x1, y1, color, width = 2.5, headSize = 10, glow = true) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy);
  if (len < 0.001) return;
  const ux = dx / len;
  const uy = dy / len;

  // Shorten line so it ends at head base
  const bx = x1 - ux * headSize * 0.85;
  const by = y1 - uy * headSize * 0.85;

  if (glow) {
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 14;
  }

  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(bx, by);
  ctx.stroke();

  // Arrow head
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(bx - uy * headSize * 0.45, by + ux * headSize * 0.45);
  ctx.lineTo(bx + uy * headSize * 0.45, by - ux * headSize * 0.45);
  ctx.closePath();
  ctx.fill();

  if (glow) ctx.restore();
}

function drawGrid(ctx, cx, cy, scale, w, h, step = 1, majorEvery = 5) {
  const halfW = w / 2;
  const halfH = h / 2;

  ctx.save();
  ctx.strokeStyle = COLORS.border;
  ctx.lineWidth = 1;

  // Vertical lines
  let x = 0;
  while (x <= halfW) {
    const isMajor = Math.round(x / (step * scale)) % majorEvery === 0;
    ctx.strokeStyle = isMajor ? COLORS.borderStrong : COLORS.border;
    ctx.beginPath();
    ctx.moveTo(cx + x, cy - halfH);
    ctx.lineTo(cx + x, cy + halfH);
    ctx.stroke();
    if (x > 0) {
      ctx.beginPath();
      ctx.moveTo(cx - x, cy - halfH);
      ctx.lineTo(cx - x, cy + halfH);
      ctx.stroke();
    }
    x += step * scale;
  }

  // Horizontal lines
  let y = 0;
  while (y <= halfH) {
    const isMajor = Math.round(y / (step * scale)) % majorEvery === 0;
    ctx.strokeStyle = isMajor ? COLORS.borderStrong : COLORS.border;
    ctx.beginPath();
    ctx.moveTo(cx - halfW, cy + y);
    ctx.lineTo(cx + halfW, cy + y);
    ctx.stroke();
    if (y > 0) {
      ctx.beginPath();
      ctx.moveTo(cx - halfW, cy - y);
      ctx.lineTo(cx + halfW, cy - y);
      ctx.stroke();
    }
    y += step * scale;
  }

  // Axes
  ctx.strokeStyle = COLORS.text3;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - halfW, cy);
  ctx.lineTo(cx + halfW, cy);
  ctx.moveTo(cx, cy - halfH);
  ctx.lineTo(cx, cy + halfH);
  ctx.stroke();

  ctx.restore();
}

function drawUnitCircle(ctx, cx, cy, r, color = COLORS.border, dashed = true) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  if (dashed) ctx.setLineDash([3, 4]);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawAngleArc(ctx, cx, cy, r, startAngle, endAngle, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  // Canvas y is flipped: negate angles to go counterclockwise visually
  ctx.arc(cx, cy, r, -startAngle, -endAngle, true);
  ctx.stroke();

  // Small fill to make it readable
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, r, -startAngle, -endAngle, true);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawLabel(ctx, text, x, y, color, size = 12, font = "JetBrains Mono, monospace", align = "left") {
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = `500 ${size}px ${font}`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y);
  ctx.restore();
}

// ============================================================
// HERO CANVAS — ambient rotating vector, ring of dots
// ============================================================

(function renderHero() {
  const canvas = document.getElementById("hero-canvas");
  if (!canvas) return;
  const { ctx, w, h } = setupCanvas(canvas, 420, 420);
  const cx = w / 2;
  const cy = h / 2;

  let t = 0;

  function frame() {
    ctx.clearRect(0, 0, w, h);

    // Concentric rings of dots, each rotating at different speeds
    const rings = [
      { r: 60,  n: 6,  speed: 0.012,  color: COLORS.amber,     size: 3 },
      { r: 110, n: 12, speed: 0.006,  color: COLORS.amberSoft, size: 2.4 },
      { r: 160, n: 24, speed: 0.003,  color: COLORS.blue,      size: 2 },
      { r: 200, n: 48, speed: 0.0015, color: COLORS.text2,     size: 1.4 }
    ];

    rings.forEach((ring) => {
      for (let i = 0; i < ring.n; i++) {
        const theta = (i / ring.n) * Math.PI * 2 + t * ring.speed;
        const px = cx + ring.r * Math.cos(theta);
        const py = cy + ring.r * Math.sin(theta);
        ctx.fillStyle = ring.color;
        ctx.globalAlpha = 0.9;
        ctx.shadowColor = ring.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(px, py, ring.size, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

    // Center crosshair
    ctx.strokeStyle = COLORS.borderStrong;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - 8, cy);
    ctx.lineTo(cx + 8, cy);
    ctx.moveTo(cx, cy - 8);
    ctx.lineTo(cx, cy + 8);
    ctx.stroke();

    // The main rotating vector
    const angle = t * 0.008;
    const vx = cx + 150 * Math.cos(angle);
    const vy = cy + 150 * Math.sin(angle);
    drawArrow(ctx, cx, cy, vx, vy, COLORS.amber, 2.5, 12, true);

    // Tick label "m" that orbits
    ctx.save();
    ctx.font = "italic 400 22px Fraunces, serif";
    ctx.fillStyle = COLORS.amberSoft;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("m", vx + 20 * Math.cos(angle), vy + 20 * Math.sin(angle));
    ctx.restore();

    t += 1;
    requestAnimationFrame(frame);
  }

  frame();
})();

// ============================================================
// PANEL 0 — The problem: attention is order-blind
// ============================================================

(function renderPanel0() {
  const canvas = document.getElementById("p0-canvas");
  if (!canvas) return;
  const { ctx, w, h } = setupCanvas(canvas, 720, 460);

  const shuffleBtn = document.getElementById("p0-shuffle");
  const resetBtn = document.getElementById("p0-reset");
  const peToggle = document.getElementById("p0-pe");

  // Original token sequence
  const baseTokens = ["the", "dog", "bit", "the", "man"];
  const N = baseTokens.length;
  const d = 4; // embedding dim

  // Stable identity embeddings — one vector per UNIQUE word
  // So "the" in position 0 and position 3 start with the same embedding
  // (which is the whole point — only position info differentiates them)
  function hashStr(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = (h * 16777619) >>> 0;
    }
    return h;
  }
  function rng(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  const wordEmbeds = {};
  for (const tok of baseTokens) {
    if (wordEmbeds[tok]) continue;
    const r = rng(hashStr(tok));
    wordEmbeds[tok] = Array.from({ length: d }, () => r() * 2 - 1);
  }

  // Current permutation of token indices
  let perm = [0, 1, 2, 3, 4];

  // Positional embedding — a simple sinusoidal PE
  function positionalEmbed(pos) {
    // Returns a length-d vector that depends on pos
    const v = new Array(d);
    for (let i = 0; i < d; i++) {
      const freq = Math.pow(10, -i / d);
      v[i] = i % 2 === 0 ? Math.sin(pos * freq) : Math.cos(pos * freq);
    }
    return v;
  }

  // Build the N×d embedding matrix given current permutation and PE flag
  function buildEmbeddings(withPE) {
    const X = [];
    for (let posIdx = 0; posIdx < N; posIdx++) {
      const token = baseTokens[perm[posIdx]];
      const base = wordEmbeds[token].slice();
      if (withPE) {
        const pe = positionalEmbed(posIdx);
        for (let i = 0; i < d; i++) base[i] += pe[i];
      }
      X.push(base);
    }
    return X;
  }

  // Compute attention matrix: softmax(X X^T / sqrt(d))
  function attention(X) {
    const scale = 1 / Math.sqrt(d);
    const scores = [];
    for (let i = 0; i < N; i++) {
      const row = [];
      for (let j = 0; j < N; j++) {
        let s = 0;
        for (let k = 0; k < d; k++) s += X[i][k] * X[j][k];
        row.push(s * scale);
      }
      scores.push(row);
    }
    // Softmax per row
    const out = [];
    for (let i = 0; i < N; i++) {
      const mx = Math.max(...scores[i]);
      const exps = scores[i].map((s) => Math.exp(s - mx));
      const sum = exps.reduce((a, b) => a + b, 0);
      out.push(exps.map((e) => e / sum));
    }
    return out;
  }

  // Shuffle helper (Fisher-Yates)
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // Helper: draw one matrix + tokens at a given position
  // origValueSet (optional): a sorted array of values from the Original matrix.
  // When provided (for the Current matrix), each cell is colored amber if its
  // value also exists in the Original (a "permuted" value) or rose if it's new.
  function drawMatrix(originX, title, tokens, A, withPE, isCurrent, origValueSet, currentlyShuffled) {
    const cellSize = 44;
    const matSize = cellSize * N;
    const matX = originX + 30;  // leave space for row labels
    const tokStartY = 60;
    const tokCellW = cellSize;
    const matY = 145;

    // Title above
    ctx.save();
    ctx.font = "italic 500 14px Fraunces, serif";
    ctx.fillStyle = isCurrent ? COLORS.text1 : COLORS.text2;
    ctx.textAlign = "center";
    ctx.fillText(title, matX + matSize / 2, 30);
    ctx.restore();

    // Token pills
    for (let i = 0; i < N; i++) {
      const tok = tokens[i];
      const x = matX + i * tokCellW;
      const y = tokStartY;

      ctx.save();
      ctx.fillStyle = COLORS.bg1;
      ctx.strokeStyle = COLORS.border;
      ctx.lineWidth = 1;
      roundRect(ctx, x + 3, y, tokCellW - 6, 32, 5);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = COLORS.text0;
      ctx.font = "500 13px Manrope, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(tok, x + tokCellW / 2, y + 16);
      ctx.restore();
    }

    // Arrow indicator
    ctx.save();
    ctx.strokeStyle = COLORS.text3;
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.moveTo(matX + matSize / 2, tokStartY + 50);
    ctx.lineTo(matX + matSize / 2, matY - 6);
    ctx.stroke();
    ctx.restore();

    // Matrix cells
    // Blue family hues that cycle on each shuffle to signal "new set" each time
    const blueCycle = ["#2e6a91", "#3d7a5e", "#5a4e8c", "#1f6878", "#4a6741"];

    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const v = A[i][j];
        const cx0 = matX + j * cellSize;
        const cy0 = matY + i * cellSize;

        // Stretch [0, 0.4] → [0.08, 0.95] so values are visually distinct
        const alpha = Math.min(0.95, 0.08 + (v / 0.4) * 0.87);

        // 3-tier color logic for the Current matrix:
        //   PE off                → amber (same set as Original, possibly rearranged)
        //   PE on  + no shuffle   → rose  (PE changed every value)
        //   PE on  + shuffle      → blue family, hue cycles per shuffle (new set every time)
        let cellColor = COLORS.amber;
        if (isCurrent) {
          if (withPE && currentlyShuffled) {
            const idx = (shuffleCount - 1) % blueCycle.length;
            cellColor = blueCycle[idx >= 0 ? idx : 0];
          } else if (withPE) {
            cellColor = COLORS.rose;
          }
        }

        ctx.save();
        ctx.fillStyle = `rgba(${hexRGB(cellColor)}, ${alpha})`;
        ctx.fillRect(cx0 + 1, cy0 + 1, cellSize - 2, cellSize - 2);

        ctx.fillStyle = alpha > 0.55 ? COLORS.bg0 : COLORS.text1;
        ctx.font = "500 11px JetBrains Mono, monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(v.toFixed(2), cx0 + cellSize / 2, cy0 + cellSize / 2);
        ctx.restore();
      }

      // Row label
      ctx.save();
      ctx.fillStyle = COLORS.text3;
      ctx.font = "500 11px JetBrains Mono, monospace";
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText(tokens[i], matX - 6, matY + i * cellSize + cellSize / 2);
      ctx.restore();
    }

    // Matrix border
    ctx.save();
    let borderColor = COLORS.borderStrong;
    let borderWidth = 1;
    if (isCurrent && withPE && currentlyShuffled) {
      const idx = (shuffleCount - 1) % blueCycle.length;
      borderColor = blueCycle[idx >= 0 ? idx : 0];
      borderWidth = 2;
    } else if (isCurrent && withPE) {
      borderColor = COLORS.rose;
      borderWidth = 2;
    }
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = borderWidth;
    ctx.strokeRect(matX, matY, matSize, matSize);
    ctx.restore();

    return { matX, matY, matSize };
  }

  // Compute sorted-set similarity between two matrices for the verdict text
  function setsEqual(A, B, tol = 0.01) {
    const flatA = A.flat().slice().sort((a, b) => a - b);
    const flatB = B.flat().slice().sort((a, b) => a - b);
    for (let i = 0; i < flatA.length; i++) {
      if (Math.abs(flatA[i] - flatB[i]) > tol) return false;
    }
    return true;
  }

  // ----------- Rendering ------------
  function draw(animatedA) {
    const withPE = peToggle.checked;

    // Original matrix — always [the, dog, bit, the, man], no PE (the reference)
    const origPerm = [0, 1, 2, 3, 4];
    const origTokens = origPerm.map((i) => baseTokens[i]);
    const origX = buildEmbeddingsForPerm(origPerm, false);
    const origA = attention(origX);

    // Current matrix — uses current perm and PE toggle
    const currTokens = perm.map((i) => baseTokens[i]);
    const currX = buildEmbeddings(withPE);
    const currA = animatedA || attention(currX);

    ctx.clearRect(0, 0, w, h);

    // Layout: two matrices side by side
    // Each matrix needs: 30 (row label) + 220 (5×44 cells) = 250 wide
    // Canvas 720 / 2 = 360 per side, plenty of room
    const leftX = 30;
    const rightX = w / 2 + 30;

    drawMatrix(leftX, "Original", origTokens, origA, false, false, null, false);
    const origFlat = origA.flat();
    const isShuffled = perm.some((v, i) => v !== i);

    // Title reflects current state explicitly
    let currentTitle;
    if (!withPE && !isShuffled) currentTitle = "Current";
    else if (!withPE && isShuffled) currentTitle = "Current (after shuffle)";
    else if (withPE && !isShuffled) currentTitle = "Current (with position info)";
    else currentTitle = "Current (shuffle + position info)";

    const r = drawMatrix(rightX, currentTitle, currTokens, currA, withPE, true, origFlat, isShuffled);

    // ---- Verdict line below ----
    const verdictY = r.matY + r.matSize + 38;
    const sameSet = setsEqual(origA, currA);

    let verdictText, verdictColor;
    if (!withPE) {
      // PE off: same set, but message depends on whether shuffled
      verdictText = isShuffled
        ? "Same set of values — just reshuffled. Attention is order-blind."
        : "No changes yet — try Shuffle, or turn on position info.";
      verdictColor = COLORS.text2;
    } else if (!isShuffled) {
      // PE on, no shuffle: PE alone changed every value
      verdictText = "Position info changed every value — even without shuffle.";
      verdictColor = COLORS.rose;
    } else {
      // PE on + shuffle: each shuffle = a brand new set; cycle hue to make that visible
      const blueCycleVerdict = ["#2e6a91", "#3d7a5e", "#5a4e8c", "#1f6878", "#4a6741"];
      const idx = (shuffleCount - 1) % blueCycleVerdict.length;
      verdictColor = blueCycleVerdict[idx >= 0 ? idx : 0];
      verdictText = `New set #${shuffleCount} — every reshuffle gives a fresh pattern.`;
    }

    ctx.save();
    ctx.font = "italic 500 15px Fraunces, serif";
    ctx.fillStyle = verdictColor;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const textW = ctx.measureText(verdictText).width;
    const dotX = w / 2 - textW / 2 - 14;
    ctx.beginPath();
    ctx.arc(dotX, verdictY, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillText(verdictText, w / 2, verdictY);
    ctx.restore();
  }

  // Build embeddings for an arbitrary permutation (used for the original reference)
  function buildEmbeddingsForPerm(p, withPE) {
    const X = [];
    for (let posIdx = 0; posIdx < N; posIdx++) {
      const token = baseTokens[p[posIdx]];
      const base = wordEmbeds[token].slice();
      if (withPE) {
        const pe = positionalEmbed(posIdx);
        for (let i = 0; i < d; i++) base[i] += pe[i];
      }
      X.push(base);
    }
    return X;
  }

  // Helpers
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function hexRGB(hex) {
    // Accepts #RRGGBB (trimmed by cssVar). Returns "r, g, b" string.
    const c = hex.replace("#", "");
    const r = parseInt(c.substr(0, 2), 16);
    const g = parseInt(c.substr(2, 2), 16);
    const b = parseInt(c.substr(4, 2), 16);
    return `${r}, ${g}, ${b}`;
  }

  function wrapText(ctx, text, x, y, maxW, lineH) {
    const words = text.split(" ");
    let line = "";
    let yy = y;
    for (let i = 0; i < words.length; i++) {
      const test = line + words[i] + " ";
      if (ctx.measureText(test).width > maxW && line !== "") {
        ctx.fillText(line, x, yy);
        line = words[i] + " ";
        yy += lineH;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, x, yy);
  }

  // Animated shuffle — brief flash then draw
  let shuffleCount = 0;
  function doShuffle() {
    perm = shuffle(perm);
    shuffleCount++;
    draw();
  }

  function doReset() {
    perm = [0, 1, 2, 3, 4];
    shuffleCount = 0;
    draw();
  }

  shuffleBtn.addEventListener("click", doShuffle);
  resetBtn.addEventListener("click", doReset);
  peToggle.addEventListener("change", () => draw());
  onThemeChange(() => draw());
  draw();
})();

// ============================================================
// PANEL 1 — Single 2D rotation
// ============================================================

(function renderPanel1() {
  const canvas = document.getElementById("p1-canvas");
  if (!canvas) return;
  const { ctx, w, h } = setupCanvas(canvas, 640, 640);
  const cx = w / 2;
  const cy = h / 2;
  const unitScale = 180; // pixels per unit length

  const mInput = document.getElementById("p1-m");
  const mVal = document.getElementById("p1-m-val");

  // Base query vector (constant through interaction)
  const q = [1.0, 0.2]; // slight tilt so it's visually interesting
  const theta = 1.0;    // fixed — Panel 2 is where frequency becomes the story

  function draw() {
    const m = parseFloat(mInput.value);
    const angle = m * theta;

    // RoPE rotation: R(mθ) * q
    const qm = [
      q[0] * Math.cos(angle) - q[1] * Math.sin(angle),
      q[0] * Math.sin(angle) + q[1] * Math.cos(angle)
    ];

    mVal.textContent = m.toFixed(1);

    // --- Canvas render ---
    ctx.clearRect(0, 0, w, h);

    // Grid
    drawGrid(ctx, cx, cy, unitScale, w, h, 0.2, 5);

    // Unit circle
    drawUnitCircle(ctx, cx, cy, unitScale, COLORS.borderStrong, true);

    // Axis labels
    drawLabel(ctx, "x", cx + w / 2 - 14, cy - 10, COLORS.text3, 12, "JetBrains Mono, monospace", "right");
    drawLabel(ctx, "y", cx + 10, cy - h / 2 + 14, COLORS.text3, 12, "JetBrains Mono, monospace", "left");

    // Ghost base vector (original q)
    const bx = cx + q[0] * unitScale;
    const by = cy - q[1] * unitScale;
    ctx.save();
    ctx.globalAlpha = 0.3;
    drawArrow(ctx, cx, cy, bx, by, COLORS.text1, 1.5, 8, false);
    ctx.restore();
    drawLabel(ctx, "q", bx + 14, by - 4, COLORS.text2, 16, "italic 500 16px Fraunces, serif", "left");

    // Angle arc between base and rotated
    const baseAngle = Math.atan2(q[1], q[0]);
    const newAngle = baseAngle + angle;
    drawAngleArc(ctx, cx, cy, 50, baseAngle, newAngle, COLORS.amberSoft);

    // Arc label
    const midAngle = baseAngle + angle / 2;
    drawLabel(
      ctx,
      `m·θ`,
      cx + 75 * Math.cos(midAngle),
      cy - 75 * Math.sin(midAngle),
      COLORS.amberSoft,
      16,
      "italic 500 16px Fraunces, serif",
      "center"
    );

    // Rotated vector q_m
    const vx = cx + qm[0] * unitScale;
    const vy = cy - qm[1] * unitScale;
    drawArrow(ctx, cx, cy, vx, vy, COLORS.amber, 3, 12, true);
    drawLabel(ctx, "q_m", vx + 14, vy - 4, COLORS.amber, 18, "italic 600 18px Fraunces, serif", "left");
  }

  mInput.addEventListener("input", draw);
  onThemeChange(draw);
  draw();
})();

// ============================================================
// PANEL 2 — Multi-frequency rotation grid
// ============================================================

(function renderPanel2() {
  const canvas = document.getElementById("p2-canvas");
  if (!canvas) return;
  const { ctx, w, h } = setupCanvas(canvas, 720, 360);

  const mInput = document.getElementById("p2-m");
  const mVal = document.getElementById("p2-m-val");
  const d = 8;  // fixed — 4 planes is the sweet spot for teaching multi-scale

  function draw() {
    const m = parseFloat(mInput.value);
    const numPairs = d / 2;

    mVal.textContent = m.toFixed(2);

    ctx.clearRect(0, 0, w, h);

    // Layout: numPairs cells in a row
    const padding = 40;
    const cellW = (w - padding * 2) / numPairs;
    const cellSize = Math.min(cellW, h - 130);
    const startX = padding;
    const startY = 40;
    const radius = cellSize * 0.42;

    for (let i = 0; i < numPairs; i++) {
      const cx = startX + cellW * i + cellW / 2;
      const cy = startY + cellSize / 2;

      // Frequency θ_i = 10000^(-2i/d)
      const thetaI = Math.pow(10000, (-2 * i) / d);
      const angle = m * thetaI;

      // Cell border
      ctx.save();
      ctx.strokeStyle = COLORS.border;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.rect(cx - cellW / 2 + 8, cy - cellSize / 2 + 8, cellW - 16, cellSize - 16);
      ctx.stroke();
      ctx.restore();

      // Unit circle
      drawUnitCircle(ctx, cx, cy, radius, COLORS.borderStrong, true);

      // Axes
      ctx.save();
      ctx.strokeStyle = COLORS.text3;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - radius - 10, cy);
      ctx.lineTo(cx + radius + 10, cy);
      ctx.moveTo(cx, cy - radius - 10);
      ctx.lineTo(cx, cy + radius + 10);
      ctx.stroke();
      ctx.restore();

      // Interpolate color: low index (fast) = amber, high index (slow) = blue
      const t = i / Math.max(1, numPairs - 1);
      const color = lerpColor(COLORS.amber, COLORS.blue, t);

      // Trail — faint previous angles (from 0 up to current)
      const trailSteps = 24;
      for (let s = 0; s < trailSteps; s++) {
        const frac = s / trailSteps;
        const a = angle * frac;
        const px = cx + radius * Math.cos(a);
        const py = cy - radius * Math.sin(a);
        ctx.save();
        ctx.globalAlpha = frac * 0.35;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(px, py, 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Base vector (at angle 0) — faint
      ctx.save();
      ctx.globalAlpha = 0.25;
      drawArrow(ctx, cx, cy, cx + radius, cy, COLORS.text1, 1, 6, false);
      ctx.restore();

      // Current rotated vector
      const vx = cx + radius * Math.cos(angle);
      const vy = cy - radius * Math.sin(angle);
      drawArrow(ctx, cx, cy, vx, vy, color, 2.2, 9, true);

      // Labels below cell
      const labelY = cy + cellSize / 2 + 8;
      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      // Plane index
      ctx.fillStyle = COLORS.text2;
      ctx.font = "italic 400 16px Fraunces, serif";
      ctx.fillText(`pair ${i}`, cx, labelY);
      // theta value
      ctx.fillStyle = color;
      ctx.font = "500 13px JetBrains Mono, monospace";
      ctx.fillText(`θ = ${formatTheta(thetaI)}`, cx, labelY + 24);
      // current angle
      ctx.fillStyle = COLORS.text3;
      ctx.font = "400 12px JetBrains Mono, monospace";
      ctx.fillText(`m·θ = ${angle.toFixed(2)}`, cx, labelY + 44);
      ctx.restore();
    }

    // Title arrows
    ctx.save();
    ctx.strokeStyle = COLORS.text3;
    ctx.lineWidth = 1;
    ctx.fillStyle = COLORS.text2;
    ctx.font = "italic 500 15px Fraunces, serif";
    ctx.textAlign = "left";
    ctx.fillText("fast ← ", startX, 20);
    ctx.textAlign = "right";
    ctx.fillText(" → slow", w - padding, 20);
    ctx.restore();
  }

  function lerpColor(hexA, hexB, t) {
    const a = hexToRgb(hexA);
    const b = hexToRgb(hexB);
    return `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)}, ${Math.round(a[1] + (b[1] - a[1]) * t)}, ${Math.round(a[2] + (b[2] - a[2]) * t)})`;
  }

  function hexToRgb(h) {
    const c = h.replace("#", "");
    return [
      parseInt(c.substr(0, 2), 16),
      parseInt(c.substr(2, 2), 16),
      parseInt(c.substr(4, 2), 16)
    ];
  }

  function formatTheta(v) {
    if (v >= 0.01) return v.toFixed(3);
    if (v >= 0.0001) return v.toExponential(2);
    return v.toExponential(1);
  }

  mInput.addEventListener("input", draw);
  onThemeChange(draw);
  draw();
})();

// ============================================================
// PANEL 3 — Relative position & inner product
// ============================================================

(function renderPanel3() {
  const canvas = document.getElementById("p3-canvas");
  if (!canvas) return;
  const { ctx, w, h } = setupCanvas(canvas, 720, 420);

  const mInput = document.getElementById("p3-m");
  const nInput = document.getElementById("p3-n");
  const lockInput = document.getElementById("p3-lock");
  const mValEl = document.getElementById("p3-m-val");
  const nValEl = document.getElementById("p3-n-val");
  const distEl = document.getElementById("p3-dist");
  const dotEl = document.getElementById("p3-dot");

  // Base q and k in 2D (unit vectors, same direction for clean cosine curve)
  const q = [1.0, 0.0];
  const k = [1.0, 0.0];
  const theta = 0.6; // frequency for this demo

  // Layout: left half is two-vector diagram, right half is dot-product plot
  const split = w / 2;

  // Left side diagram center
  const lcx = split / 2;
  const lcy = h / 2;
  const unitScaleL = 130;

  // Right plot area
  const plotX0 = split + 60;
  const plotX1 = w - 40;
  const plotY0 = 50;
  const plotY1 = h - 70;
  const plotW = plotX1 - plotX0;
  const plotH = plotY1 - plotY0;

  // Lock mechanism
  let lockedDistance = null;
  let lastM = parseFloat(mInput.value);
  let lastN = parseFloat(nInput.value);

  lockInput.addEventListener("change", () => {
    if (lockInput.checked) {
      lockedDistance = parseFloat(mInput.value) - parseFloat(nInput.value);
    } else {
      lockedDistance = null;
    }
    draw();
  });

  mInput.addEventListener("input", () => {
    const m = parseFloat(mInput.value);
    if (lockInput.checked && lockedDistance !== null) {
      const newN = m - lockedDistance;
      const clamped = Math.max(0, Math.min(32, newN));
      nInput.value = clamped;
      // If we had to clamp, re-adjust m to keep distance locked
      if (clamped !== newN) {
        mInput.value = clamped + lockedDistance;
      }
    }
    draw();
  });

  nInput.addEventListener("input", () => {
    const n = parseFloat(nInput.value);
    if (lockInput.checked && lockedDistance !== null) {
      const newM = n + lockedDistance;
      const clamped = Math.max(0, Math.min(32, newM));
      mInput.value = clamped;
      if (clamped !== newM) {
        nInput.value = clamped - lockedDistance;
      }
    }
    draw();
  });

  function rotate2D(v, ang) {
    return [
      v[0] * Math.cos(ang) - v[1] * Math.sin(ang),
      v[0] * Math.sin(ang) + v[1] * Math.cos(ang)
    ];
  }

  function innerProduct(dist) {
    // <q_m, k_n> where q and k are unit along x, equals cos((n-m)*theta)
    // But we plotted m-n on x-axis, so use cos(-dist * theta) = cos(dist * theta)
    return Math.cos(dist * theta);
  }

  function draw() {
    const m = parseFloat(mInput.value);
    const n = parseFloat(nInput.value);
    const dist = m - n;
    const dot = innerProduct(dist);

    mValEl.textContent = m.toFixed(1);
    nValEl.textContent = n.toFixed(1);
    distEl.textContent = dist.toFixed(2);
    dotEl.textContent = dot.toFixed(3);

    ctx.clearRect(0, 0, w, h);

    // ==========================================
    // LEFT: vector diagram
    // ==========================================
    drawGrid(ctx, lcx, lcy, unitScaleL, split, h, 0.2, 5);
    drawUnitCircle(ctx, lcx, lcy, unitScaleL, COLORS.borderStrong, true);

    // Title
    ctx.save();
    ctx.fillStyle = COLORS.text2;
    ctx.font = "italic 500 15px Fraunces, serif";
    ctx.textAlign = "center";
    ctx.fillText("vectors in 2-D", lcx, 30);
    ctx.restore();

    // Rotated q_m
    const qm = rotate2D(q, m * theta);
    const qmx = lcx + qm[0] * unitScaleL;
    const qmy = lcy - qm[1] * unitScaleL;
    drawArrow(ctx, lcx, lcy, qmx, qmy, COLORS.amber, 2.8, 11, true);
    drawLabel(ctx, "q_m", qmx + 12 * Math.cos(m * theta), qmy - 12 * Math.sin(m * theta) - 4, COLORS.amber, 17, "italic 600 17px Fraunces, serif", "center");

    // Rotated k_n
    const kn = rotate2D(k, n * theta);
    const knx = lcx + kn[0] * unitScaleL;
    const kny = lcy - kn[1] * unitScaleL;
    drawArrow(ctx, lcx, lcy, knx, kny, COLORS.blue, 2.8, 11, true);
    drawLabel(ctx, "k_n", knx + 12 * Math.cos(n * theta), kny - 12 * Math.sin(n * theta) + 14, COLORS.blue, 17, "italic 600 17px Fraunces, serif", "center");

    // Angle between them
    const angleBetween = (m - n) * theta;
    const arcR = 35;
    if (Math.abs(angleBetween) > 0.01) {
      const qAngle = m * theta;
      const kAngle = n * theta;
      drawAngleArc(ctx, lcx, lcy, arcR, kAngle, qAngle, COLORS.rose);
      const midAng = (qAngle + kAngle) / 2;
      drawLabel(
        ctx,
        `(m-n)θ`,
        lcx + (arcR + 22) * Math.cos(midAng),
        lcy - (arcR + 22) * Math.sin(midAng),
        COLORS.rose,
        15,
        "italic 500 15px Fraunces, serif",
        "center"
      );
    }

    // ==========================================
    // RIGHT: dot product plot vs distance
    // ==========================================

    // Plot area background
    ctx.save();
    ctx.fillStyle = "rgba(245, 239, 230, 0.015)";
    ctx.fillRect(plotX0, plotY0, plotW, plotH);

    // Plot border
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 1;
    ctx.strokeRect(plotX0, plotY0, plotW, plotH);
    ctx.restore();

    // Title
    ctx.save();
    ctx.fillStyle = COLORS.text2;
    ctx.font = "italic 500 15px Fraunces, serif";
    ctx.textAlign = "center";
    ctx.fillText("inner product vs distance m−n", (plotX0 + plotX1) / 2, 30);
    ctx.restore();

    // Plot the cosine curve
    const distRange = 16;
    const xToPlot = (d) => plotX0 + ((d + distRange) / (2 * distRange)) * plotW;
    const yToPlot = (v) => plotY0 + ((1 - v) / 2) * plotH;

    // Zero line (y = 0)
    ctx.save();
    ctx.strokeStyle = COLORS.borderStrong;
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 4]);
    ctx.beginPath();
    const zeroY = yToPlot(0);
    ctx.moveTo(plotX0, zeroY);
    ctx.lineTo(plotX1, zeroY);
    // Center vertical (x = 0)
    ctx.moveTo(xToPlot(0), plotY0);
    ctx.lineTo(xToPlot(0), plotY1);
    ctx.stroke();
    ctx.restore();

    // Axis tick labels
    ctx.save();
    ctx.fillStyle = COLORS.text3;
    ctx.font = "500 12px JetBrains Mono, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (let dx = -distRange; dx <= distRange; dx += 4) {
      const px = xToPlot(dx);
      // Tick mark
      ctx.strokeStyle = COLORS.text3;
      ctx.beginPath();
      ctx.moveTo(px, plotY1);
      ctx.lineTo(px, plotY1 + 4);
      ctx.stroke();
      ctx.fillText(dx.toString(), px, plotY1 + 8);
    }
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let vy = -1; vy <= 1; vy += 0.5) {
      const py = yToPlot(vy);
      ctx.beginPath();
      ctx.moveTo(plotX0 - 4, py);
      ctx.lineTo(plotX0, py);
      ctx.stroke();
      ctx.fillText(vy.toFixed(1), plotX0 - 8, py);
    }
    ctx.restore();

    // Axis labels
    ctx.save();
    ctx.fillStyle = COLORS.text2;
    ctx.font = "italic 500 14px Fraunces, serif";
    ctx.textAlign = "center";
    ctx.fillText("m − n", (plotX0 + plotX1) / 2, plotY1 + 32);
    ctx.save();
    ctx.translate(plotX0 - 42, (plotY0 + plotY1) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("⟨q_m, k_n⟩", 0, 0);
    ctx.restore();
    ctx.restore();

    // The curve itself
    ctx.save();
    ctx.strokeStyle = COLORS.amberDeep;
    ctx.lineWidth = 2;
    ctx.shadowColor = COLORS.amber;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    const steps = 400;
    for (let i = 0; i <= steps; i++) {
      const d = -distRange + (i / steps) * 2 * distRange;
      const v = innerProduct(d);
      const px = xToPlot(d);
      const py = yToPlot(v);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.restore();

    // Current point marker
    const currX = xToPlot(Math.max(-distRange, Math.min(distRange, dist)));
    const currY = yToPlot(dot);

    // Guide lines
    ctx.save();
    ctx.strokeStyle = COLORS.rose;
    ctx.globalAlpha = 0.35;
    ctx.setLineDash([2, 4]);
    ctx.beginPath();
    ctx.moveTo(currX, plotY1);
    ctx.lineTo(currX, currY);
    ctx.moveTo(plotX0, currY);
    ctx.lineTo(currX, currY);
    ctx.stroke();
    ctx.restore();

    // Marker dot
    ctx.save();
    ctx.shadowColor = COLORS.rose;
    ctx.shadowBlur = 14;
    ctx.fillStyle = COLORS.rose;
    ctx.beginPath();
    ctx.arc(currX, currY, 6, 0, Math.PI * 2);
    ctx.fill();
    // Inner ring
    ctx.fillStyle = COLORS.text0;
    ctx.beginPath();
    ctx.arc(currX, currY, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Marker label
    drawLabel(
      ctx,
      `(${dist.toFixed(1)}, ${dot.toFixed(2)})`,
      currX + 12,
      currY - 14,
      COLORS.rose,
      13,
      "600 13px JetBrains Mono, monospace",
      "left"
    );
  }

  onThemeChange(draw);
  draw();
})();

// ============================================================
// THEME TOGGLE — day / night
// ============================================================

(function wireThemeToggle() {
  const html = document.documentElement;
  const dayBtn = document.getElementById("theme-day");
  const nightBtn = document.getElementById("theme-night");
  if (!dayBtn || !nightBtn) return;

  function setTheme(theme) {
    if (theme === "night") {
      html.setAttribute("data-theme", "night");
      nightBtn.classList.add("active");
      dayBtn.classList.remove("active");
    } else {
      html.removeAttribute("data-theme"); // default = day
      dayBtn.classList.add("active");
      nightBtn.classList.remove("active");
    }
    // Let CSS vars update, then trigger canvas redraw
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.dispatchEvent(new CustomEvent("themechange"));
      });
    });
  }

  dayBtn.addEventListener("click", () => setTheme("day"));
  nightBtn.addEventListener("click", () => setTheme("night"));
})();
