// js/music-widget.js
//
// A small music player that lives as a toggle button in the top nav.
// Clicking it drops open a panel with play/pause, a seek bar, and a
// volume slider. The track attempts to autoplay at low volume as soon
// as the page loads; if the browser blocks that (most browsers block
// unmuted autoplay until the person has interacted with the page),
// it starts automatically on the very first click/tap/keypress
// anywhere on the page instead.

(() => {
  const toggle = document.getElementById('musicToggle');
  const panel = document.getElementById('musicPanel');
  const audio = document.getElementById('musicAudio');
  if (!toggle || !panel || !audio) return;

  const playBtn = document.getElementById('musicPlay');
  const seek = document.getElementById('musicSeek');
  const currentEl = document.getElementById('musicCurrent');
  const durationEl = document.getElementById('musicDuration');
  const volumeSlider = document.getElementById('musicVolume');
  const muteBtn = document.getElementById('musicMute');

  const DEFAULT_VOLUME = 0.1; // 10%
  const VOLUME_KEY = 'bscsMusicVolume';
  let seeking = false;

  // ---------- volume ----------
  // Always read/write audio.volume directly and immediately (on the
  // 'input' event, not just 'change') so the level reliably follows
  // the slider instead of occasionally sticking at the old value.
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

  function applyVolume(vol, { save = true } = {}) {
    const clamped = Math.min(1, Math.max(0, vol));
    audio.volume = clamped;
    audio.muted = false;
    volumeSlider.value = String(Math.round(clamped * 100));
    muteBtn.innerHTML = muteIcon(clamped);
    if (save) localStorage.setItem(VOLUME_KEY, String(clamped));
  }

  audio.volume = loadSavedVolume();
  applyVolume(audio.volume, { save: false });

  volumeSlider.addEventListener('input', () => {
    applyVolume(Number(volumeSlider.value) / 100);
  });

  let volumeBeforeMute = audio.volume;
  muteBtn.addEventListener('click', () => {
    if (audio.volume > 0) {
      volumeBeforeMute = audio.volume;
      applyVolume(0);
    } else {
      applyVolume(volumeBeforeMute > 0 ? volumeBeforeMute : DEFAULT_VOLUME);
    }
  });

  // ---------- autoplay ----------
  function tryAutoplay() {
    audio.volume = loadSavedVolume();
    const p = audio.play();
    if (p && typeof p.catch === 'function') {
      p.catch(() => {
        // Blocked by the browser's autoplay policy — fall back to
        // starting on the person's first interaction with the page.
        const startOnInteraction = () => {
          audio.play().catch(() => {});
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

  // ---------- panel open/close ----------
  function openPanel() {
    panel.classList.add('is-open');
    toggle.setAttribute('aria-expanded', 'true');
  }
  function closePanel() {
    panel.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
  }
  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    if (panel.classList.contains('is-open')) closePanel();
    else openPanel();
  });
  document.addEventListener('click', (e) => {
    if (!panel.classList.contains('is-open')) return;
    if (panel.contains(e.target) || toggle.contains(e.target)) return;
    closePanel();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closePanel();
  });

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
    toggle.classList.toggle('is-playing', isPlaying);
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
