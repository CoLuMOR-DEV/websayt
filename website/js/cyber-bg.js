// js/cyber-bg.js
//
// A quiet, slow snowfall drifting behind the page — deliberately cheap to
// run. No shadowBlur, no per-frame path building, no mouse tracking; just
// a handful of soft dots drifting down with a little sideways drift.
//
// Perf choices that matter on low-end mobile:
//   - flake count is capped low and scaled to screen area, not viewport
//     count alone, so a small phone screen gets very few flakes
//   - the animation loop is paused entirely (not just "drawing nothing")
//     whenever the tab is hidden, via the Page Visibility API
//   - prefers-reduced-motion draws one static frame and stops
//   - toggling snow off via the button this script injects halts the
//     rAF loop completely rather than merely skipping the draw calls
//
// The on/off state persists in localStorage so it's remembered next visit.

(() => {
  const STORAGE_KEY = 'bscs-snow-enabled';
  const canvas = document.getElementById('cyberBg');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let W = 0, H = 0, DPR = Math.min(window.devicePixelRatio || 1, 1.5);
  let flakes = [];
  let running = false;
  let rafId = null;
  let lastT = 0;

  function isEnabled() {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === null ? true : saved === '1';
  }

  function setEnabled(on) {
    localStorage.setItem(STORAGE_KEY, on ? '1' : '0');
    if (on) startLoop();
    else stopLoop();
  }

  function buildFlakes() {
    const area = W * H;
    const count = Math.max(10, Math.min(90, Math.round(area / 26000)));
    flakes = Array.from({ length: count }, () => spawnFlake(Math.random() * H));
  }

  function spawnFlake(y) {
    return {
      x: Math.random() * W,
      y,
      r: 1 + Math.random() * 1.8,
      speed: 8 + Math.random() * 16, // px/sec, downward
      drift: 6 + Math.random() * 14, // px amplitude, sideways
      phase: Math.random() * Math.PI * 2,
      freq: 0.15 + Math.random() * 0.25, // sideways sway speed
      alpha: 0.25 + Math.random() * 0.45,
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
    buildFlakes();
  }

  function drawStatic() {
    ctx.clearRect(0, 0, W, H);
    flakes.forEach((f) => {
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(235,235,240,${f.alpha})`;
      ctx.fill();
    });
  }

  function tick(t) {
    if (!running) return;
    const dt = lastT ? Math.min((t - lastT) / 1000, 0.05) : 0;
    lastT = t;

    ctx.clearRect(0, 0, W, H);
    flakes.forEach((f) => {
      f.y += f.speed * dt;
      f.phase += f.freq * dt;
      const x = f.x + Math.sin(f.phase) * f.drift * dt * 6;
      f.x = x;
      if (f.y > H + 4) {
        Object.assign(f, spawnFlake(-4));
      }
      if (f.x < -10) f.x = W + 10;
      if (f.x > W + 10) f.x = -10;

      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(235,235,240,${f.alpha})`;
      ctx.fill();
    });

    rafId = requestAnimationFrame(tick);
  }

  function startLoop() {
    canvas.style.display = '';
    if (prefersReducedMotion) {
      drawStatic();
      return;
    }
    if (running) return;
    running = true;
    lastT = 0;
    rafId = requestAnimationFrame(tick);
  }

  function stopLoop() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    ctx.clearRect(0, 0, W, H);
  }

  document.addEventListener('visibilitychange', () => {
    if (!isEnabled()) return;
    if (document.hidden) {
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = null;
    } else if (!prefersReducedMotion) {
      running = true;
      lastT = 0;
      rafId = requestAnimationFrame(tick);
    }
  });

  window.addEventListener('resize', () => {
    resize();
    if (!running && isEnabled()) drawStatic();
  });

  // ---------- small toggle button, injected once, shared by every
  // page that includes this script ----------
  function injectToggle() {
    if (document.getElementById('snowToggle')) return;
    const btn = document.createElement('button');
    btn.id = 'snowToggle';
    btn.type = 'button';
    btn.className = 'snow-toggle';
    btn.setAttribute('aria-label', 'Toggle snow effect');
    btn.setAttribute('aria-pressed', String(isEnabled()));
    btn.innerHTML = snowIcon(isEnabled());
    btn.addEventListener('click', () => {
      const next = !isEnabled();
      setEnabled(next);
      btn.setAttribute('aria-pressed', String(next));
      btn.innerHTML = snowIcon(next);
    });
    document.body.appendChild(btn);
  }

  function snowIcon(on) {
    return on
      ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 2v20M4.5 6l15 12M19.5 6l-15 12M2 12h20"/></svg>'
      : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 2v20M4.5 6l15 12M19.5 6l-15 12M2 12h20" opacity="0.35"/><path d="M4 4l16 16"/></svg>';
  }

  resize();
  injectToggle();
  if (isEnabled()) startLoop();
})();
