// js/cyber-bg.js
//
// Draws the sigilism background: monochrome thorned sigils built from
// tapered, hand-inked spike shapes (not uniform stroked lines) — long
// compass spikes anchoring a dense bramble of shorter thorns, faint
// rings, a couple of small satellite thorn-clusters, and a wavering
// thorned vine trailing down from each node. A handful of solitary
// dust motes drift in the empty space; there is no connect-the-dots
// particle mesh, which reads as generic "AI background" filler.
//
// Runs on <canvas id="cyberBg">, which every page includes right after
// <body>. Respects prefers-reduced-motion: draws one static frame.

(() => {
  const canvas = document.getElementById('cyberBg');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const BG = '#050505';
  const INK = 'rgba(235, 236, 240, ALPHA)';

  let W = 0, H = 0, DPR = Math.min(window.devicePixelRatio || 1, 2);
  let sigils = [];
  let motes = [];
  let t = 0;

  function withAlpha(a) {
    return INK.replace('ALPHA', Math.max(a, 0).toFixed(3));
  }

  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    buildSigils();
    buildMotes();
  }

  // A single hand-inked thorn: tapers from a base width down to a point,
  // with a slight asymmetric bow so it doesn't read as a ruler-straight
  // vector line. All randomness for a given thorn is precomputed and
  // passed in — draw() never calls Math.random(), so nothing flickers.
  function drawThorn(ox, oy, angle, length, baseWidth, bow, alpha) {
    const dx = Math.cos(angle), dy = Math.sin(angle);
    const px = -dy, py = dx;
    const tipX = ox + dx * length, tipY = oy + dy * length;
    const midX = ox + dx * length * 0.52 + px * bow;
    const midY = oy + dy * length * 0.52 + py * bow;
    const baseLX = ox + px * baseWidth * 0.5, baseLY = oy + py * baseWidth * 0.5;
    const baseRX = ox - px * baseWidth * 0.5, baseRY = oy - py * baseWidth * 0.5;

    ctx.beginPath();
    ctx.moveTo(baseLX, baseLY);
    ctx.quadraticCurveTo(midX, midY, tipX, tipY);
    ctx.quadraticCurveTo(
      ox + dx * length * 0.5 - px * bow * 0.35,
      oy + dy * length * 0.5 - py * bow * 0.35,
      baseRX, baseRY
    );
    ctx.closePath();
    ctx.fillStyle = withAlpha(alpha);
    ctx.fill();
  }

  // All randomness lives here, at build time.
  function buildSigils() {
    const count = W < 700 ? 4 : 6;
    sigils = [];
    for (let i = 0; i < count; i++) {
      const weight = 0.5 + Math.random() * 0.55; // 0.5 (background/minor) – 1.05 (hero)
      const major = weight > 0.75;

      const cx = Math.random() * W * 0.94 + W * 0.03;
      const cy = Math.random() * H * 0.86 + H * 0.06;
      const r = Math.min(W, H) * (0.07 + weight * 0.1);

      // Long compass spikes — only the more prominent sigils get these.
      const cross = [];
      if (major) {
        const crossCount = 4 + Math.floor(Math.random() * 3);
        const crossBase = Math.random() * Math.PI * 2;
        for (let c = 0; c < crossCount; c++) {
          cross.push({
            angle: crossBase + (c / crossCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.35,
            length: r * (1.1 + Math.random() * 0.55),
            baseWidth: 1.1 + Math.random() * 0.9,
            bow: (Math.random() - 0.5) * r * 0.16,
            endTick: Math.random() < 0.5,
          });
        }
      }

      // Dense thorn bramble, built from 2–3 loosely offset sub-origins
      // near the center rather than one perfectly symmetric burst — this
      // is what keeps it from reading as a tidy vector starburst.
      const subOrigins = [];
      const subCount = major ? 2 + Math.floor(Math.random() * 2) : 1;
      for (let so = 0; so < subCount; so++) {
        subOrigins.push({
          x: (Math.random() - 0.5) * r * 0.35,
          y: (Math.random() - 0.5) * r * 0.35,
        });
      }
      const burstCenter = Math.random() * Math.PI * 2;
      const burstSpread = 1.5 + Math.random() * 1.1;
      const burstCount = major ? 20 + Math.floor(Math.random() * 14) : 9 + Math.floor(Math.random() * 8);
      const burst = [];
      for (let b = 0; b < burstCount; b++) {
        const origin = subOrigins[Math.floor(Math.random() * subOrigins.length)];
        burst.push({
          ox: origin.x,
          oy: origin.y,
          angle: burstCenter + (Math.random() - 0.5) * burstSpread,
          length: r * (0.18 + Math.random() * 0.78),
          baseWidth: 0.6 + Math.random() * 0.9,
          bow: (Math.random() - 0.5) * r * 0.2,
          alpha: 0.14 + Math.random() * 0.16,
          barb: Math.random() < 0.3,
          barbSide: Math.random() < 0.5 ? 1 : -1,
          barbAt: 0.5 + Math.random() * 0.3,
          barbLen: r * (0.06 + Math.random() * 0.07),
        });
      }

      // Small satellite thorn-clusters — deliberately asymmetric (never
      // 4-6 evenly-spaced spikes) so they don't collapse into a "*" star
      // glyph at a distance.
      const satCount = major ? 2 + Math.floor(Math.random() * 2) : Math.random() < 0.5 ? 1 : 0;
      const satellites = [];
      for (let s = 0; s < satCount; s++) {
        const sa = Math.random() * Math.PI * 2;
        const sr = r * (1.35 + Math.random() * 1.0);
        const spikeCount = 3 + Math.floor(Math.random() * 3);
        const spikes = [];
        const baseAngle = Math.random() * Math.PI * 2;
        for (let k = 0; k < spikeCount; k++) {
          spikes.push({
            angle: baseAngle + Math.random() * Math.PI * 1.5,
            length: r * (0.05 + Math.random() * 0.11),
            baseWidth: 0.5 + Math.random() * 0.5,
            bow: (Math.random() - 0.5) * r * 0.05,
          });
        }
        satellites.push({
          x: Math.cos(sa) * sr, y: Math.sin(sa) * sr,
          spikes, angle: Math.random() * Math.PI * 2,
          rotSpeed: (Math.random() - 0.5) * 0.015,
        });
      }

      // Thorned vine.
      const hasVine = major || Math.random() < 0.5;
      const vineLength = r * (1.5 + Math.random() * 1.3);
      const vineSegments = 22;
      const vineBarbs = [];
      for (let v = 3; v < vineSegments - 2; v += 2) {
        if (Math.random() < 0.55) {
          vineBarbs.push({ seg: v, side: Math.random() < 0.5 ? 1 : -1, len: 4 + Math.random() * 6 });
        }
      }

      sigils.push({
        cx, cy, r, weight, major, cross, burst, subOrigins, satellites,
        hasVine, vineLength, vineSegments, vineBarbs,
        angle: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() < 0.5 ? 1 : -1) * (0.0004 + Math.random() * 0.0006),
        vinePhase: Math.random() * Math.PI * 2,
        pulsePhase: Math.random() * Math.PI * 2,
        baseAlpha: major ? 0.75 + Math.random() * 0.25 : 0.4 + Math.random() * 0.25,
      });
    }
  }

  function buildMotes() {
    const count = Math.round((W * H) / 130000);
    motes = [];
    for (let i = 0; i < count; i++) {
      motes.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: 0.5 + Math.random() * 0.7,
        alpha: 0.08 + Math.random() * 0.14,
        vy: -0.01 - Math.random() * 0.015,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  function drawSigil(s, time) {
    const { cx, cy, r, baseAlpha } = s;
    const pulse = baseAlpha * (0.9 + Math.sin(time * 0.006 + s.pulsePhase) * 0.1);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(s.angle);

    // Faint rings.
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.9, 0, Math.PI * 2);
    ctx.strokeStyle = withAlpha(0.09 * pulse);
    ctx.lineWidth = 1;
    ctx.stroke();
    if (s.major) {
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.52, 0, Math.PI * 2);
      ctx.strokeStyle = withAlpha(0.06 * pulse);
      ctx.stroke();
    }

    // Central mark — a small solid point plus a tiny crossed tick, no
    // glow/bloom (glow is what makes procedural backgrounds read as
    // generic AI art).
    ctx.beginPath();
    ctx.arc(0, 0, 1.6, 0, Math.PI * 2);
    ctx.fillStyle = withAlpha(0.55 * pulse);
    ctx.fill();

    // Long compass spikes.
    s.cross.forEach((c) => {
      drawThorn(0, 0, c.angle, c.length, c.baseWidth, c.bow, 0.24 * pulse);
      if (c.endTick) {
        const x2 = Math.cos(c.angle) * c.length;
        const y2 = Math.sin(c.angle) * c.length;
        const perp = c.angle + Math.PI / 2;
        const tickLen = r * 0.05;
        drawThorn(x2 - Math.cos(perp) * tickLen, y2 - Math.sin(perp) * tickLen, perp, tickLen * 2, 0.8, 0, 0.18 * pulse);
      }
    });

    // Dense thorn bramble.
    s.burst.forEach((b) => {
      drawThorn(b.ox, b.oy, b.angle, b.length, b.baseWidth, b.bow, b.alpha * pulse * 4.5);
      if (b.barb) {
        const bx = b.ox + Math.cos(b.angle) * b.length * b.barbAt;
        const by = b.oy + Math.sin(b.angle) * b.length * b.barbAt;
        const barbAngle = b.angle + b.barbSide * 0.65;
        drawThorn(bx, by, barbAngle, b.barbLen, b.baseWidth * 0.7, 0, b.alpha * pulse * 3.2);
      }
    });

    ctx.restore();

    // Satellite thorn-clusters, drifting slowly in world space.
    s.satellites.forEach((sat) => {
      sat.angle += sat.rotSpeed;
      ctx.save();
      ctx.translate(cx + sat.x, cy + sat.y);
      ctx.rotate(sat.angle);
      sat.spikes.forEach((sp) => {
        drawThorn(0, 0, sp.angle, sp.length, sp.baseWidth, sp.bow, 0.22 * pulse);
      });
      ctx.beginPath();
      ctx.arc(0, 0, 0.9, 0, Math.PI * 2);
      ctx.fillStyle = withAlpha(0.3 * pulse);
      ctx.fill();
      ctx.restore();
    });

    if (s.hasVine) drawVine(s, time, pulse);
  }

  function drawVine(s, time, pulse) {
    const { cx, cy, r, vineLength, vineSegments, vineBarbs, vinePhase } = s;
    const originY = cy + r * 0.85;
    const points = [];
    for (let i = 0; i <= vineSegments; i++) {
      const f = i / vineSegments;
      const sway = Math.sin(time * 0.0045 + vinePhase + f * 3.2) * (2.5 + f * f * 16);
      const drift = f * f * r * 0.1;
      points.push([cx + sway + drift, originY + f * vineLength]);
    }

    // Tapering stroke: a few overlapping passes with decreasing width so
    // the vine reads as thick-at-the-root, thin-at-the-tip.
    const passes = [
      { upto: 0.4, width: 1.6 },
      { upto: 0.75, width: 1.1 },
      { upto: 1.0, width: 0.7 },
    ];
    let start = 0;
    passes.forEach((p) => {
      const end = Math.floor(vineSegments * p.upto);
      ctx.beginPath();
      for (let i = start; i <= end; i++) {
        const [x, y] = points[i];
        if (i === start) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = withAlpha(0.16 * pulse);
      ctx.lineWidth = p.width;
      ctx.lineCap = 'round';
      ctx.stroke();
      start = end;
    });

    vineBarbs.forEach(({ seg, side, len }) => {
      if (seg >= points.length - 1) return;
      const [x1, y1] = points[seg];
      const [x2, y2] = points[seg + 1];
      const ang = Math.atan2(y2 - y1, x2 - x1) + side * 1.0;
      drawThorn(x1, y1, ang, len, 0.7, 0, 0.13 * pulse * 3);
    });

    const [tx, ty] = points[points.length - 1];
    ctx.beginPath();
    ctx.arc(tx, ty + 3, 3, 0, Math.PI * 1.3);
    ctx.strokeStyle = withAlpha(0.14 * pulse);
    ctx.lineWidth = 0.9;
    ctx.stroke();
  }

  function drawMotes() {
    motes.forEach((m) => {
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
      ctx.fillStyle = withAlpha(m.alpha);
      ctx.fill();
    });
  }

  function step() {
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);

    drawMotes();
    motes.forEach((m) => {
      m.y += m.vy;
      if (m.y < -4) { m.y = H + 4; m.x = Math.random() * W; }
    });

    sigils.forEach((s) => {
      s.angle += s.rotSpeed;
      drawSigil(s, t);
    });

    t += 1;
    if (!prefersReducedMotion) requestAnimationFrame(step);
  }

  window.addEventListener('resize', () => {
    resize();
    if (prefersReducedMotion) step();
  });

  resize();
  step();
})();
