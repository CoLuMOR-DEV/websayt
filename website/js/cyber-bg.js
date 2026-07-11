// js/cyber-bg.js
//
// "Cybersigilism" background, take two: ONE clean sigil — a sharp
// starburst of blades over faint concentric guide-circles and radial
// spokes, like a wireframe target/rune — instead of scattered clutter.
// A sparse field of faint particles drifts behind it.
//
// Mouse interaction (tracked on `window`, canvas itself stays
// pointer-events:none so it never blocks clicks):
//   - the sigil leans/tilts toward the cursor
//   - nearby particles are gently pushed away from the cursor
//   - the sigil glows brighter the closer the cursor gets to it
//
// Respects prefers-reduced-motion: draws one static frame, skips the
// animation loop and the mouse-driven effects entirely.

(() => {
  const canvas = document.getElementById('cyberBg');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let W = 0, H = 0, DPR = Math.min(window.devicePixelRatio || 1, 2);
  let sigil = null;
  let particles = [];
  let t = 0;

  const mouse = { x: null, y: null };
  let tilt = 0; // current, eased
  let glow = 0; // current, eased

  window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  });
  window.addEventListener('mouseleave', () => {
    mouse.x = null;
    mouse.y = null;
  });

  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let x = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  }

  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    buildSigil();
    buildParticles();
  }

  // ---------- one tapering blade, local space, base at (0,0) pointing
  // "up" by `angle` radians off vertical ----------
  function buildBlade(rng, { length, baseWidth, angle, curve, segments = 16 }) {
    const tipX = Math.sin(angle) * length;
    const tipY = -Math.cos(angle) * length;
    const ctrlX = Math.sin(angle + curve) * length * 0.55;
    const ctrlY = -Math.cos(angle + curve) * length * 0.55;

    const center = [];
    for (let i = 0; i <= segments; i++) {
      const s = i / segments;
      const x = 2 * (1 - s) * s * ctrlX + s * s * tipX;
      const y = 2 * (1 - s) * s * ctrlY + s * s * tipY;
      center.push([x, y, s]);
    }

    const left = [], right = [];
    for (let i = 0; i < center.length; i++) {
      const [x, y, s] = center[i];
      const prev = center[Math.max(i - 1, 0)];
      const next = center[Math.min(i + 1, center.length - 1)];
      let dx = next[0] - prev[0], dy = next[1] - prev[1];
      const len = Math.hypot(dx, dy) || 1;
      dx /= len; dy /= len;
      const px = -dy, py = dx;
      const w = (baseWidth / 2) * Math.pow(1 - s, 1.8) + 0.25;
      left.push([x + px * w, y + py * w]);
      right.push([x - px * w, y - py * w]);
    }

    return { outline: [...left, ...right.slice().reverse()], center };
  }

  function buildSigil() {
    const narrow = W < 700;
    const minDim = Math.min(W, H);
    const rng = mulberry32(42);

    const focalX = W * 0.5;
    const focalY = H * (narrow ? 0.32 : 0.34);
    const scale = (narrow ? 0.6 : 1) * minDim * 0.0026;

    // Fan of blades within a broad upward arc, plus two extra-tall slender
    // ones near the center of the fan (the "antenna" spikes in the ref art).
    const bladeCount = 8;
    const blades = [];
    for (let i = 0; i < bladeCount; i++) {
      const spread = -0.62 + (i / (bladeCount - 1)) * 1.24;
      blades.push(buildBlade(rng, {
        length: (95 + rng() * 55) * scale,
        baseWidth: (7 + rng() * 4) * scale,
        angle: spread,
        curve: (rng() - 0.5) * 0.5,
      }));
    }
    [-0.06, 0.1].forEach((a) => {
      blades.push(buildBlade(rng, {
        length: (170 + rng() * 40) * scale,
        baseWidth: 3.2 * scale,
        angle: a,
        curve: (rng() - 0.5) * 0.2,
      }));
    });

    // Faint radial spokes reaching off toward the edges, a couple with a
    // small tick mark at the tip.
    const spokeCount = 6;
    const spokes = [];
    for (let i = 0; i < spokeCount; i++) {
      const angle = (i / spokeCount) * Math.PI * 2 + rng() * 0.3;
      const len = minDim * (0.55 + rng() * 0.5);
      spokes.push({
        x1: Math.cos(angle) * minDim * 0.16,
        y1: Math.sin(angle) * minDim * 0.16,
        x2: Math.cos(angle) * len,
        y2: Math.sin(angle) * len,
        tick: rng() < 0.5,
        angle,
      });
    }

    sigil = {
      focalX, focalY, scale,
      blades,
      spokes,
      ringR1: minDim * 0.13,
      ringR2: minDim * 0.205,
    };
  }

  function buildParticles() {
    const count = Math.round((W * H) / 85000);
    particles = [];
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.08,
        vy: (Math.random() - 0.5) * 0.08,
        ox: 0, oy: 0,
      });
    }
  }

  function drawSpokes() {
    if (!sigil) return;
    ctx.save();
    ctx.translate(sigil.focalX, sigil.focalY);
    sigil.spokes.forEach((s) => {
      ctx.beginPath();
      ctx.moveTo(s.x1, s.y1);
      ctx.lineTo(s.x2, s.y2);
      ctx.strokeStyle = 'rgba(210,214,232,0.07)';
      ctx.lineWidth = 1;
      ctx.stroke();
      if (s.tick) {
        const tx = Math.cos(s.angle), ty = Math.sin(s.angle);
        const px = -ty, py = tx;
        const size = 7;
        ctx.beginPath();
        ctx.moveTo(s.x2 - px * size, s.y2 - py * size);
        ctx.lineTo(s.x2 + px * size, s.y2 + py * size);
        ctx.moveTo(s.x2 - tx * size * 0.4, s.y2 - ty * size * 0.4);
        ctx.lineTo(s.x2 + tx * size * 1.4, s.y2 + ty * size * 1.4);
        ctx.strokeStyle = 'rgba(210,214,232,0.12)';
        ctx.stroke();
      }
    });
    ctx.restore();
  }

  function drawRings() {
    if (!sigil) return;
    ctx.save();
    ctx.translate(sigil.focalX, sigil.focalY);
    [sigil.ringR1, sigil.ringR2].forEach((r) => {
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(210,214,232,0.08)';
      ctx.lineWidth = 1;
      ctx.stroke();
    });
    ctx.restore();
  }

  function drawParticles() {
    const REPEL_R = 130, REPEL_STRENGTH = 46;
    ctx.save();
    particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0 || p.x > W) p.vx *= -1;
      if (p.y < 0 || p.y > H) p.vy *= -1;

      let tx = 0, ty = 0;
      if (mouse.x !== null) {
        const dx = p.x - mouse.x, dy = p.y - mouse.y;
        const dist = Math.hypot(dx, dy);
        if (dist < REPEL_R && dist > 0.01) {
          const force = (REPEL_R - dist) / REPEL_R;
          tx = (dx / dist) * force * REPEL_STRENGTH;
          ty = (dy / dist) * force * REPEL_STRENGTH;
        }
      }
      p.ox += (tx - p.ox) * 0.12;
      p.oy += (ty - p.oy) * 0.12;

      ctx.beginPath();
      ctx.arc(p.x + p.ox, p.y + p.oy, 1.2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(200,205,224,0.28)';
      ctx.fill();
    });
    ctx.restore();
  }

  function drawSigilBlades(glowAmount) {
    ctx.save();
    ctx.translate(sigil.focalX, sigil.focalY);
    ctx.rotate(tilt);
    ctx.scale(sigil.scale, sigil.scale);

    sigil.blades.forEach((blade) => {
      const ys = blade.outline.map((p) => p[1]);
      const y0 = Math.min(...ys), y1 = Math.max(...ys);
      const grad = ctx.createLinearGradient(0, y0, 0, y1);
      grad.addColorStop(0, `rgba(255,255,255,${0.95})`);
      grad.addColorStop(0.5, `rgba(190,196,214,${0.7})`);
      grad.addColorStop(1, `rgba(70,74,92,${0.35})`);

      ctx.beginPath();
      blade.outline.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.shadowColor = `rgba(220,226,255,${0.25 + glowAmount * 0.5})`;
      ctx.shadowBlur = (6 + glowAmount * 24) / sigil.scale;
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    ctx.restore();
  }

  function drawMouseGlow() {
    if (mouse.x === null) return;
    const r = 220;
    const grad = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, r);
    grad.addColorStop(0, 'rgba(200,210,255,0.05)');
    grad.addColorStop(1, 'rgba(200,210,255,0)');
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(mouse.x, mouse.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function step() {
    ctx.fillStyle = '#06070c';
    ctx.fillRect(0, 0, W, H);

    drawSpokes();
    drawRings();
    drawParticles();
    drawMouseGlow();

    if (sigil) {
      let targetTilt = 0;
      let targetGlow = 0;
      if (mouse.x !== null) {
        const dx = mouse.x - sigil.focalX;
        const dy = mouse.y - sigil.focalY;
        targetTilt = Math.max(-0.22, Math.min(0.22, dx / W * 0.9));
        const dist = Math.hypot(dx, dy);
        targetGlow = Math.max(0, 1 - dist / (Math.min(W, H) * 0.55));
      }
      tilt += (targetTilt - tilt) * 0.05;
      glow += (targetGlow - glow) * 0.08;
      drawSigilBlades(glow);
    }

    t += 0.016;
    if (!prefersReducedMotion) requestAnimationFrame(step);
  }

  window.addEventListener('resize', () => {
    resize();
    if (prefersReducedMotion) step();
  });

  resize();
  step();
})();
