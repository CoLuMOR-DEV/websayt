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
// Autoplay: browsers block audio with sound from autoplaying unless the
// element starts muted. So the element autoplays muted, and the instant
// playback actually starts we flip it to unmuted at low volume — this is
// allowed because the play() call itself was muted (no gesture needed),
// and toggling .muted on an already-playing element doesn't re-trigger
// the browser's gesture requirement. If even muted autoplay is blocked
// (rare, e.g. strict privacy settings), playback + unmute falls back to
// starting on the very first interaction with the page.

(() => {
  const dock = document.getElementById('musicDock');
  if (!dock) return;

  const handle = document.getElementById('musicHandle');
  const audio = document.getElementById('musicAudio');
  const playBtn = document.getElementById('musicPlay');
  const seek = document.getElementById('musicSeek');
  const currentEl = document.getElementById('musicCurrent');
  const durationEl = document.getElementById('musicDuration');
  const volumeSlider = document.getElementById('musicVolume');
  const muteBtn = document.getElementById('musicMute');

  const EDGE_ZONE = 90; // px from the bottom of the viewport that triggers a reveal
  const HIDE_DELAY = 250;
  const DEFAULT_VOLUME = 0.05; // 5%
  const VOLUME_KEY = 'bscsMusicVolume';

  let pinned = false;
  let hoveringDock = false;
  let hideTimer = null;
  let seeking = false;

  // ---------- slide up/down ----------
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
  handle.addEventListener('click', () => {
    pinned = !pinned;
    handle.setAttribute('aria-pressed', String(pinned));
    if (pinned) show();
    else scheduleHide();
  });

  // ---------- volume ----------
  function loadSavedVolume() {
    const raw = localStorage.getItem(VOLUME_KEY);
    const parsed = raw === null ? NaN : Number(raw);
    return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : DEFAULT_VOLUME;
  }

  function muteIcon(level) {
    if (level <= 0) {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4V5z"/><line x1="16" y1="9" x2="22" y2="15"/><line x1="22" y1="9" x2="16" y2="15"/></svg>';
    }
    if (level < 0.5) {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4V5z"/><path d="M15.5 9.5a4 4 0 0 1 0 5"/></svg>';
    }
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4V5z"/><path d="M15.5 8.5a5.5 5.5 0 0 1 0 7"/><path d="M18.5 6a9 9 0 0 1 0 12"/></svg>';
  }

  // Directly and immediately assigns audio.volume on every slider move
  // (the 'input' event, not just 'change') so the level always follows
  // the slider instead of occasionally sticking at an old value.
  function applyVolume(vol, { save = true } = {}) {
    const clamped = Math.min(1, Math.max(0, vol));
    audio.volume = clamped;
    audio.muted = false;
    volumeSlider.value = String(Math.round(clamped * 100));
    muteBtn.innerHTML = muteIcon(clamped);
    if (save) localStorage.setItem(VOLUME_KEY, String(clamped));
  }

  let volumeBeforeMute = loadSavedVolume();
  applyVolume(volumeBeforeMute, { save: false });

  volumeSlider.addEventListener('input', () => {
    applyVolume(Number(volumeSlider.value) / 100);
  });

  muteBtn.addEventListener('click', () => {
    if (audio.volume > 0) {
      volumeBeforeMute = audio.volume;
      applyVolume(0);
    } else {
      applyVolume(volumeBeforeMute > 0 ? volumeBeforeMute : DEFAULT_VOLUME);
    }
  });

  // ---------- autoplay ----------
  function unmuteToTarget() {
    audio.muted = false;
    audio.volume = loadSavedVolume();
    applyVolume(audio.volume, { save: false });
  }

  function tryAutoplay() {
    audio.muted = true;
    const p = audio.play();
    const onPlaying = () => {
      unmuteToTarget();
      audio.removeEventListener('playing', onPlaying);
    };
    audio.addEventListener('playing', onPlaying);

    if (p && typeof p.catch === 'function') {
      p.catch(() => {
        // Even muted autoplay was blocked — start on the person's
        // first interaction with the page instead.
        const startOnInteraction = () => {
          audio.muted = false;
          audio.volume = loadSavedVolume();
          audio.play().catch(() => {});
          applyVolume(audio.volume, { save: false });
          cleanup();
        };
        const cleanup = () => {
          document.removeEventListener('pointerdown', startOnInteraction);
          document.removeEventListener('keydown', startOnInteraction);
        };
        document.addEventListener('pointerdown', startOnInteraction, { once: true });
        document.addEventListener('keydown', startOnInteraction, { once: true });
      });
    }
  }
  tryAutoplay();

  // ---------- transport ----------
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
    handle.classList.toggle('is-playing', isPlaying);
  }

  playBtn.addEventListener('click', () => {
    if (audio.paused) {
      audio.muted = false;
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
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
