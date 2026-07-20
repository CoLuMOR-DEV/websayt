// js/cyber-bg.js
//
// "Sigilism" background — a single ornate, symmetric sigil: two
// thorned, layered wings sweeping outward from a slender blade at the
// center, drawn as pure white/gray linework on an ink-black canvas.
// No color anywhere — this is a strictly black & white theme.
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

  // ---------- one tapering, hook-tipped thorn/blade, local space,
  // base at (0,0), pointing "up" by `angle` radians off vertical,
  // with an optional curl (`hook`) bending the outer third of the
  // shape back on itself for a claw/thorn silhouette ----------
  function buildBlade(rng, { length, baseWidth, angle, curve, hook = 0, segments = 18 }) {
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

    if (hook) {
      const pivotIdx = Math.floor(0.72 * segments);
      const [px, py] = center[pivotIdx];
      for (let i = pivotIdx + 1; i < center.length; i++) {
        const [x, y, s] = center[i];
        const hs = (s - 0.72) / 0.28;
        const a = hook * hs * hs * hs;
        const dx = x - px, dy = y - py;
        const ca = Math.cos(a), sa = Math.sin(a);
        center[i] = [dx * ca - dy * sa + px, dx * sa + dy * ca + py, s];
      }
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
      const w = (baseWidth / 2) * Math.pow(1 - s, 1.9) + 0.35;
      left.push([x + px * w, y + py * w]);
      right.push([x - px * w, y - py * w]);
    }

    const last = center[center.length - 1];
    return { outline: [...left, ...right.slice().reverse()], tip: [last[0], last[1]] };
  }

  // ---------- one wing: a fan of layered thorn-blades sweeping from
  // near-vertical (close to the blade) out to near-horizontal, with a
  // bell-shaped length profile and shorter inner "barb" blades woven
  // between the main ones ----------
  function buildWing(rng, side) {
    const n = 11;
    const blades = [];
    const tips = [];
    for (let i = 0; i < n; i++) {
      const tt = i / (n - 1);
      const angle = side * (0.16 + tt * 1.42);
      const bell = Math.pow(Math.sin(Math.PI * (0.12 + 0.82 * tt)), 0.6);
      const length = 70 + bell * 205;
      const baseWidth = 4.5 + bell * 5.5;
      const curve = side * (-0.22 - tt * 0.4);
      const hook = side * (1.15 - tt * 0.6);
      const b = buildBlade(rng, { length, baseWidth, angle, curve, hook });
      blades.push({ ...b, opacity: 0.55 + bell * 0.4 });
      tips.push({ pos: b.tip, angle });

      if (i % 2 === 1) {
        const b2 = buildBlade(rng, {
          length: length * 0.62,
          baseWidth: baseWidth * 0.55,
          angle: angle - side * 0.09,
          curve: curve * 1.3,
          hook: hook * 1.4,
        });
        blades.push({ ...b2, opacity: 0.38 });
      }
    }

    // thin webbing lines between neighboring tips (skip the first
    // couple nearest the body so it doesn't clutter the hilt)
    const webs = [];
    for (let i = 2; i < tips.length - 1; i++) {
      const a = tips[i].pos, b = tips[i + 1].pos;
      webs.push({
        x1: a[0], y1: a[1],
        mx: (a[0] + b[0]) / 2, my: (a[1] + b[1]) / 2 + 20,
        x2: b[0], y2: b[1],
      });
    }

    // a few small curling flourishes low on the wing for texture
    const curls = [];
    [2, 4, 6, 8].forEach((i) => {
      const { pos, angle } = tips[i];
      const bx = pos[0] * 0.4, by = pos[1] * 0.4;
      const a1 = angle + side * 0.7;
      const x1 = bx + Math.cos(a1) * 46 * 0.5;
      const y1 = by + Math.sin(a1) * 46 * 0.5;
      const a2 = angle + side * 1.9;
      const x2 = x1 + Math.cos(a2) * 46 * 0.6;
      const y2 = y1 + Math.sin(a2) * 46 * 0.6;
      curls.push({ x0: bx, y0: by, cx: x1, cy: y1, x1: x2, y1: y2 });
    });

    return { blades, webs, curls };
  }

  // ---------- the central blade: sword shape (blade + curled
  // crossguard + grip + pommel) ----------
  function buildSword() {
    const bladeLen = 230, bladeW = 26;
    const bladePath = `M 0,-6 L ${-bladeW / 2},18 L -6,${bladeLen - 30} L 0,${bladeLen} L 6,${bladeLen - 30} L ${bladeW / 2},18 Z`;
    const cg = 70;
    const guardPath = `M ${-cg},-2 Q ${-cg * 0.6},14 -14,10 L 14,10 Q ${cg * 0.6},14 ${cg},-2 ` +
      `Q ${cg * 0.75},-16 ${cg * 0.55},-6 L 14,-2 L -14,-2 L ${-cg * 0.55},-6 Q ${-cg * 0.75},-16 ${-cg},-2 Z`;
    const gripPath = `M -7,-2 L -5,-38 L 5,-38 L 7,-2 Z`;
    const pommelPath = `M 0,-38 m -9,0 a 9,9 0 1,0 18,0 a 9,9 0 1,0 -18,0`;
    return [bladePath, guardPath, gripPath, pommelPath];
  }

  function buildSigil() {
    const narrow = W < 700;
    const minDim = Math.min(W, H);
    const rng = mulberry32(42);

    const focalX = W * 0.5;
    const focalY = H * (narrow ? 0.3 : 0.34);
    const scale = (narrow ? 0.62 : 1) * minDim * 0.0026;

    const wingL = buildWing(rng, -1);
    const wingR = buildWing(rng, 1);
    const sword = buildSword();

    sigil = { focalX, focalY, scale, wingL, wingR, sword };
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
      ctx.fillStyle = 'rgba(230,230,235,0.22)';
      ctx.fill();
    });
    ctx.restore();
  }

  function drawMouseGlow() {
    if (mouse.x === null) return;
    const r = 220;
    const grad = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, r);
    grad.addColorStop(0, 'rgba(255,255,255,0.045)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(mouse.x, mouse.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawWing(wing, glowAmount) {
    wing.blades.forEach((blade) => {
      ctx.beginPath();
      blade.outline.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
      ctx.closePath();
      ctx.fillStyle = `rgba(230,230,236,${blade.opacity * 0.13})`;
      ctx.strokeStyle = `rgba(240,241,248,${Math.min(blade.opacity + 0.15, 1)})`;
      ctx.lineWidth = 1 / sigil.scale;
      ctx.shadowColor = `rgba(255,255,255,${0.18 + glowAmount * 0.45})`;
      ctx.shadowBlur = (5 + glowAmount * 20) / sigil.scale;
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
    });

    wing.webs.forEach((w) => {
      ctx.beginPath();
      ctx.moveTo(w.x1, w.y1);
      ctx.quadraticCurveTo(w.mx, w.my, w.x2, w.y2);
      ctx.strokeStyle = 'rgba(220,220,228,0.14)';
      ctx.lineWidth = 0.8 / sigil.scale;
      ctx.stroke();
    });

    wing.curls.forEach((c) => {
      ctx.beginPath();
      ctx.moveTo(c.x0, c.y0);
      ctx.quadraticCurveTo(c.cx, c.cy, c.x1, c.y1);
      ctx.strokeStyle = 'rgba(225,225,232,0.24)';
      ctx.lineWidth = 1 / sigil.scale;
      ctx.stroke();
    });
  }

  function drawSword(glowAmount) {
    ctx.save();
    sigil.sword.forEach((d) => {
      const p = new Path2D(d);
      ctx.fillStyle = 'rgba(244,244,250,0.92)';
      ctx.strokeStyle = 'rgba(255,255,255,0.95)';
      ctx.lineWidth = 1.1 / sigil.scale;
      ctx.shadowColor = `rgba(255,255,255,${0.28 + glowAmount * 0.5})`;
      ctx.shadowBlur = (6 + glowAmount * 22) / sigil.scale;
      ctx.fill(p);
      ctx.stroke(p);
      ctx.shadowBlur = 0;
    });
    ctx.restore();
  }

  function drawSigilShape(glowAmount) {
    ctx.save();
    ctx.translate(sigil.focalX, sigil.focalY);
    ctx.rotate(tilt);
    ctx.scale(sigil.scale, sigil.scale);

    drawWing(sigil.wingL, glowAmount);
    drawWing(sigil.wingR, glowAmount);
    drawSword(glowAmount);

    ctx.restore();
  }

  function step() {
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, W, H);

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
      drawSigilShape(glow);
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
