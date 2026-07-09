(() => {
  const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
  const DAY_FULL = {
    MON: 'Monday', TUE: 'Tuesday', WED: 'Wednesday', THU: 'Thursday',
    FRI: 'Friday', SAT: 'Saturday', SUN: 'Sunday',
  };
  const START_HOUR = 7;   // grid starts at 7:00
  const END_HOUR = 21;    // grid ends at 21:00 (9 PM)
  const ROW_MIN = 30;
  const ROW_PX = 44;
  const TOTAL_ROWS = ((END_HOUR - START_HOUR) * 60) / ROW_MIN;

  const todayIndex = (new Date().getDay() + 6) % 7; // Mon=0 ... Sun=6
  const todayCode = DAYS[todayIndex];

  function toMinutes(hhmm) {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
  }

  function formatTime(hhmm) {
    const [h, m] = hhmm.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${String(m).padStart(2, '0')} ${period}`;
  }

  function buildGridShell() {
    const grid = document.getElementById('scheduleGrid');
    grid.innerHTML = '';

    // corner cell
    const corner = document.createElement('div');
    corner.className = 'grid-corner';
    corner.textContent = 'TIME \\ DAY';
    grid.appendChild(corner);

    // day headers
    DAYS.forEach((day) => {
      const head = document.createElement('div');
      head.className = 'day-head' + (day === todayCode ? ' is-today' : '');
      head.innerHTML = `<div class="day-head__name">${day}</div>` +
        (day === todayCode ? '<span class="day-head__badge">TODAY</span>' : '');
      grid.appendChild(head);
    });

    // time column
    const timeCol = document.createElement('div');
    timeCol.className = 'time-col';
    timeCol.style.gridColumn = '1';
    timeCol.style.gridRow = '2';
    for (let i = 0; i < TOTAL_ROWS; i++) {
      const minutes = START_HOUR * 60 + i * ROW_MIN;
      const row = document.createElement('div');
      row.className = 'time-row';
      if (minutes % 60 === 0) {
        row.textContent = formatTime(`${String(Math.floor(minutes / 60)).padStart(2, '0')}:00`);
      }
      timeCol.appendChild(row);
    }
    grid.appendChild(timeCol);

    // day columns
    DAYS.forEach((day, colIdx) => {
      const col = document.createElement('div');
      col.className = 'day-col' + (day === todayCode ? ' is-today' : '');
      col.dataset.day = day;
      col.style.gridColumn = String(colIdx + 2);
      col.style.gridRow = '2';
      for (let i = 0; i < TOTAL_ROWS; i++) {
        const slot = document.createElement('div');
        slot.className = 'slot-row';
        col.appendChild(slot);
      }
      grid.appendChild(col);
    });

    grid.style.gridTemplateRows = `auto repeat(1, ${TOTAL_ROWS * ROW_PX}px)`;
    return grid;
  }

  function placeNowLine() {
    const now = new Date();
    const minutes = now.getHours() * 60 + now.getMinutes();
    const startMin = START_HOUR * 60, endMin = END_HOUR * 60;
    if (minutes < startMin || minutes > endMin) return;

    const col = document.querySelector(`.day-col[data-day="${todayCode}"]`);
    if (!col) return;
    const line = document.createElement('div');
    line.className = 'now-line';
    line.style.top = `${((minutes - startMin) / ROW_MIN) * ROW_PX}px`;
    col.appendChild(line);
  }

  function renderBlocks(entries) {
    entries.forEach((entry) => {
      const col = document.querySelector(`.day-col[data-day="${entry.day}"]`);
      if (!col) return;

      const startMin = toMinutes(entry.startTime);
      const endMin = toMinutes(entry.endTime);
      const gridStartMin = START_HOUR * 60;

      const top = ((startMin - gridStartMin) / ROW_MIN) * ROW_PX;
      const height = Math.max(((endMin - startMin) / ROW_MIN) * ROW_PX - 4, 30);

      const block = document.createElement('button');
      block.type = 'button';
      block.className = 'block';
      block.style.top = `${top + 2}px`;
      block.style.height = `${height}px`;
      block.style.borderLeftColor = entry.color || 'var(--green)';
      block.innerHTML = `
        <div class="block__code">${entry.meetLink ? '<span class="block__meet-dot"></span>' : ''}${escapeHtml(entry.courseCode)}</div>
        <div class="block__name">${escapeHtml(entry.courseName)}</div>
        <div class="block__time">${formatTime(entry.startTime)} – ${formatTime(entry.endTime)}</div>
      `;
      block.addEventListener('click', () => openModal(entry));
      col.appendChild(block);
    });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function openModal(entry) {
    const backdrop = document.getElementById('classModal');
    document.getElementById('modalEyebrow').textContent = `${DAY_FULL[entry.day]} · ${entry.courseCode}`;
    document.getElementById('modalTitle').textContent = entry.courseName;
    document.getElementById('modalTime').textContent = `${formatTime(entry.startTime)} – ${formatTime(entry.endTime)}`;
    const joinBtn = document.getElementById('modalJoin');
    if (entry.meetLink) {
      joinBtn.href = entry.meetLink;
      joinBtn.style.display = 'inline-flex';
      joinBtn.textContent = 'Join Google Meet →';
    } else {
      joinBtn.style.display = 'none';
    }
    backdrop.classList.add('is-open');
  }

  function closeModal() {
    document.getElementById('classModal').classList.remove('is-open');
  }

  // ---------- Mobile day-tabs + agenda list (the grid doesn't fit
  // narrow screens, so under 860px this is what's actually shown) ----------
  let selectedDay = todayCode;

  function buildDayTabs() {
    const wrap = document.getElementById('dayTabs');
    if (!wrap) return;
    wrap.innerHTML = DAYS.map((day) => `
      <button type="button" class="day-tab${day === selectedDay ? ' is-active' : ''}${day === todayCode ? ' is-today' : ''}" data-day="${day}">
        ${day}
      </button>
    `).join('');
    wrap.querySelectorAll('.day-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedDay = btn.dataset.day;
        buildDayTabs();
        renderAgenda(window.__scheduleEntries || []);
      });
    });
  }

  function renderAgenda(entries) {
    const list = document.getElementById('agendaList');
    if (!list) return;
    const dayEntries = entries
      .filter((e) => e.day === selectedDay)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));

    if (!dayEntries.length) {
      list.innerHTML = `<div class="empty-note" style="padding:32px 8px;">No classes on ${DAY_FULL[selectedDay]}.</div>`;
      return;
    }

    list.innerHTML = dayEntries.map((entry, i) => `
      <button type="button" class="agenda-item" data-index="${i}" style="border-left-color:${entry.color || 'var(--cyan)'}">
        <div class="agenda-item__time">${formatTime(entry.startTime)}<br>${formatTime(entry.endTime)}</div>
        <div>
          <div class="agenda-item__code">${entry.meetLink ? '<span class="block__meet-dot"></span>' : ''}${escapeHtml(entry.courseCode)}</div>
          <div class="agenda-item__name">${escapeHtml(entry.courseName)}</div>
        </div>
      </button>
    `).join('');

    list.querySelectorAll('.agenda-item').forEach((item, i) => {
      item.addEventListener('click', () => openModal(dayEntries[i]));
    });
  }

  async function init() {
    buildGridShell();
    buildDayTabs();

    document.getElementById('modalClose').addEventListener('click', closeModal);
    document.getElementById('classModal').addEventListener('click', (e) => {
      if (e.target.id === 'classModal') closeModal();
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

    try {
      const res = await fetch('/api/schedule');
      if (!res.ok) throw new Error('Failed to load schedule');
      const entries = await res.json();
      window.__scheduleEntries = entries;
      if (!entries.length) {
        document.getElementById('emptyNote').style.display = 'block';
      } else {
        renderBlocks(entries);
        renderAgenda(entries);
      }
    } catch (err) {
      showToast('Could not load the schedule. Try refreshing.', true);
    }

    placeNowLine();
    setInterval(() => {
      document.querySelectorAll('.now-line').forEach((n) => n.remove());
      placeNowLine();
    }, 60000);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
