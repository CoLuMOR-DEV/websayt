// js/music-widget.js
//
// A small always-there music dock. Closed by default — only the handle
// tab is visible at the bottom edge of the screen. It rises when the
// mouse moves near the bottom of the viewport (or the handle is tapped
// on touch devices) and lowers again when the mouse moves away, the same
// idea as the camera monitor sliding up/down in FNAF2. Clicking the
// handle also "pins" it open so it stays up until clicked again — this
// is what makes it usable on touch screens, which have no hover to
// trigger the slide.
//
// The audio itself uses preload="none" in the markup, so the ~3MB file
// is never fetched until the person actually presses play — it doesn't
// add anything to the page's initial load.

(() => {
  const dock = document.getElementById('musicDock');
  if (!dock) return;

  const handle = document.getElementById('musicHandle');
  const audio = document.getElementById('musicAudio');
  const playBtn = document.getElementById('musicPlay');
  const seek = document.getElementById('musicSeek');
  const currentEl = document.getElementById('musicCurrent');
  const durationEl = document.getElementById('musicDuration');

  const EDGE_ZONE = 90; // px from the bottom of the viewport that triggers a reveal
  const HIDE_DELAY = 250;

  let pinned = false;
  let hoveringDock = false;
  let hideTimer = null;
  let seeking = false;

  function show() {
    clearTimeout(hideTimer);
    dock.classList.add('is-open');
    handle.setAttribute('aria-expanded', 'true');
  }

  function scheduleHide() {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      if (!pinned && !hoveringDock) {
        dock.classList.remove('is-open');
        handle.setAttribute('aria-expanded', 'false');
      }
    }, HIDE_DELAY);
  }

  // Desktop: reveal when the cursor gets near the bottom edge of the
  // screen — matches "point the mouse down and it slides up".
  window.addEventListener('mousemove', (e) => {
    if (pinned) return;
    if (e.clientY > window.innerHeight - EDGE_ZONE) show();
    else scheduleHide();
  });

  dock.addEventListener('pointerenter', () => { hoveringDock = true; show(); });
  dock.addEventListener('pointerleave', () => {
    hoveringDock = false;
    scheduleHide();
  });

  // Touch / click: tapping the handle pins it open, since touch screens
  // have no hover to trigger the reveal above.
  handle.addEventListener('click', () => {
    pinned = !pinned;
    handle.setAttribute('aria-pressed', String(pinned));
    if (pinned) show();
    else scheduleHide();
  });

  function formatTime(sec) {
    if (!isFinite(sec) || sec < 0) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  function setPlayIcon(isPlaying) {
    playBtn.innerHTML = isPlaying
      ? '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
  }

  playBtn.addEventListener('click', () => {
    if (audio.paused) audio.play().catch(() => {});
    else audio.pause();
  });

  audio.addEventListener('play', () => setPlayIcon(true));
  audio.addEventListener('pause', () => setPlayIcon(false));

  audio.addEventListener('loadedmetadata', () => {
    durationEl.textContent = formatTime(audio.duration);
    seek.max = String(Math.floor(audio.duration));
  });

  audio.addEventListener('timeupdate', () => {
    if (seeking) return;
    currentEl.textContent = formatTime(audio.currentTime);
    if (audio.duration) seek.value = String(Math.floor(audio.currentTime));
  });

  audio.addEventListener('ended', () => {
    setPlayIcon(false);
    audio.currentTime = 0;
    seek.value = '0';
    currentEl.textContent = '0:00';
  });

  seek.addEventListener('input', () => {
    seeking = true;
    currentEl.textContent = formatTime(Number(seek.value));
  });
  seek.addEventListener('change', () => {
    audio.currentTime = Number(seek.value);
    seeking = false;
  });

  setPlayIcon(false);
})();
