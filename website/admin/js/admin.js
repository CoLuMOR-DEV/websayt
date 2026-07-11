(() => {
  const DAY_ORDER = { MON: 0, TUE: 1, WED: 2, THU: 3, FRI: 4, SAT: 5, SUN: 6 };

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function formatTime12(hhmm) {
    const [h, m] = hhmm.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${String(m).padStart(2, '0')} ${period}`;
  }

  async function api(path, options = {}) {
    const res = await fetch(path, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    });
    let body = null;
    try { body = await res.json(); } catch { /* no body */ }
    if (!res.ok) {
      const message = (body && body.error) || `Request failed (${res.status})`;
      throw new Error(message);
    }
    return body;
  }

  // ---------------- Auth ----------------

  async function checkSession() {
    try {
      const { authenticated } = await api('/api/session');
      showApp(authenticated);
    } catch {
      showApp(false);
    }
  }

  function showApp(authenticated) {
    document.getElementById('loginShell').style.display = authenticated ? 'none' : 'flex';
    document.getElementById('dashShell').style.display = authenticated ? 'block' : 'none';
    document.getElementById('statusPill').style.display = authenticated ? 'inline-block' : 'none';
    document.getElementById('logoutBtn').style.display = authenticated ? 'inline-flex' : 'none';
    if (authenticated) {
      loadSchedule();
      loadWorks();
    }
  }

  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = document.getElementById('password').value;
    const btn = document.getElementById('loginBtn');
    const errEl = document.getElementById('loginError');
    errEl.classList.remove('is-visible');
    btn.disabled = true;
    btn.textContent = 'Signing in…';
    try {
      await api('/api/login', { method: 'POST', body: JSON.stringify({ password }) });
      document.getElementById('password').value = '';
      showApp(true);
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.add('is-visible');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Sign in';
    }
  });

  document.getElementById('logoutBtn').addEventListener('click', async () => {
    await api('/api/logout', { method: 'POST' });
    showApp(false);
  });

  // ---------------- Tabs ----------------

  document.querySelectorAll('.dash-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.dash-tab').forEach((t) => t.classList.remove('is-active'));
      tab.classList.add('is-active');
      const target = tab.dataset.tab;
      document.getElementById('tab-schedule').style.display = target === 'schedule' ? 'grid' : 'none';
      document.getElementById('tab-works').style.display = target === 'works' ? 'grid' : 'none';
      document.getElementById('tab-bot').style.display = target === 'bot' ? 'grid' : 'none';
      if (target === 'bot') loadBotConfig();
    });
  });

  // ---------------- Schedule ----------------

  const scheduleForm = document.getElementById('scheduleForm');
  const scheduleCancel = document.getElementById('scheduleCancel');

  async function loadSchedule() {
    const list = document.getElementById('scheduleList');
    try {
      const entries = await api('/api/schedule');
      entries.sort((a, b) => DAY_ORDER[a.day] - DAY_ORDER[b.day] || a.startTime.localeCompare(b.startTime));
      if (!entries.length) {
        list.innerHTML = '<li class="empty-note-dark">No periods scheduled yet.</li>';
        return;
      }
      list.innerHTML = entries.map((e) => `
        <li class="admin-item" data-id="${e.id}">
          <div class="admin-item__main">
            <div class="admin-item__code">${escapeHtml(e.day)} · ${escapeHtml(e.courseCode)}</div>
            <div class="admin-item__title">${escapeHtml(e.courseName)}</div>
            <div class="admin-item__sub">${formatTime12(e.startTime)} – ${formatTime12(e.endTime)}${e.meetLink ? ' · has Meet link' : ''}</div>
          </div>
          <div class="admin-item__actions">
            <button class="icon-btn" data-action="edit">Edit</button>
            <button class="icon-btn danger" data-action="delete">Delete</button>
          </div>
        </li>
      `).join('');

      list.querySelectorAll('.admin-item').forEach((item) => {
        const id = item.dataset.id;
        const entry = entries.find((e) => e.id === id);
        item.querySelector('[data-action="edit"]').addEventListener('click', () => editSchedule(entry));
        item.querySelector('[data-action="delete"]').addEventListener('click', () => deleteSchedule(id));
      });
    } catch (err) {
      showToast(err.message, true);
    }
  }

  function editSchedule(entry) {
    document.getElementById('scheduleId').value = entry.id;
    document.getElementById('courseCode').value = entry.courseCode;
    document.getElementById('courseName').value = entry.courseName;
    document.getElementById('day').value = entry.day;
    document.getElementById('startTime').value = entry.startTime;
    document.getElementById('endTime').value = entry.endTime;
    document.getElementById('meetLink').value = entry.meetLink || '';
    document.getElementById('scheduleFormTitle').textContent = 'Edit schedule';
    document.getElementById('scheduleSubmit').textContent = 'Save changes';
    scheduleCancel.style.display = 'inline-flex';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function resetScheduleForm() {
    scheduleForm.reset();
    document.getElementById('scheduleId').value = '';
    document.getElementById('scheduleFormTitle').textContent = 'Add a schedule';
    document.getElementById('scheduleSubmit').textContent = 'Add schedule';
    scheduleCancel.style.display = 'none';
    document.getElementById('scheduleError').classList.remove('is-visible');
  }

  scheduleCancel.addEventListener('click', resetScheduleForm);

  scheduleForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('scheduleId').value;
    const payload = {
      courseCode: document.getElementById('courseCode').value.trim(),
      courseName: document.getElementById('courseName').value.trim(),
      day: document.getElementById('day').value,
      startTime: document.getElementById('startTime').value,
      endTime: document.getElementById('endTime').value,
      meetLink: document.getElementById('meetLink').value.trim(),
    };
    const errEl = document.getElementById('scheduleError');
    errEl.classList.remove('is-visible');
    try {
      if (id) {
        await api(`/api/schedule/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
        showToast('Schedule updated.');
      } else {
        await api('/api/schedule', { method: 'POST', body: JSON.stringify(payload) });
        showToast('Schedule added.');
      }
      resetScheduleForm();
      loadSchedule();
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.add('is-visible');
    }
  });

  async function deleteSchedule(id) {
    if (!confirm('Remove this period from the schedule?')) return;
    try {
      await api(`/api/schedule/${id}`, { method: 'DELETE' });
      showToast('Schedule removed.');
      loadSchedule();
    } catch (err) {
      showToast(err.message, true);
    }
  }

  // ---------------- School Works ----------------

  const worksForm = document.getElementById('worksForm');
  const worksCancel = document.getElementById('worksCancel');

  async function loadWorks() {
    const list = document.getElementById('worksList');
    try {
      const works = await api('/api/schoolworks');
      if (!works.length) {
        list.innerHTML = '<li class="empty-note-dark">No school works posted yet.</li>';
        return;
      }
      list.innerHTML = works.map((w) => `
        <li class="admin-item" data-id="${w.id}">
          <div class="admin-item__main">
            <div class="admin-item__code">${escapeHtml(w.courseCode)}</div>
            <div class="admin-item__title">${escapeHtml(w.title)}</div>
            <div class="admin-item__sub">Due ${new Date(w.deadline).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</div>
          </div>
          <div class="admin-item__actions">
            <button class="icon-btn" data-action="edit">Edit</button>
            <button class="icon-btn danger" data-action="delete">Delete</button>
          </div>
        </li>
      `).join('');

      list.querySelectorAll('.admin-item').forEach((item) => {
        const id = item.dataset.id;
        const entry = works.find((w) => w.id === id);
        item.querySelector('[data-action="edit"]').addEventListener('click', () => editWork(entry));
        item.querySelector('[data-action="delete"]').addEventListener('click', () => deleteWork(id));
      });
    } catch (err) {
      showToast(err.message, true);
    }
  }

  function toDatetimeLocal(iso) {
    const d = new Date(iso);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function editWork(entry) {
    document.getElementById('workId').value = entry.id;
    document.getElementById('workCourseCode').value = entry.courseCode;
    document.getElementById('title').value = entry.title;
    document.getElementById('description').value = entry.description || '';
    document.getElementById('deadline').value = toDatetimeLocal(entry.deadline);
    document.getElementById('worksFormTitle').textContent = 'Edit school work';
    document.getElementById('worksSubmit').textContent = 'Save changes';
    worksCancel.style.display = 'inline-flex';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function resetWorksForm() {
    worksForm.reset();
    document.getElementById('workId').value = '';
    document.getElementById('worksFormTitle').textContent = 'Post a school work';
    document.getElementById('worksSubmit').textContent = 'Post school work';
    worksCancel.style.display = 'none';
    document.getElementById('worksError').classList.remove('is-visible');
  }

  worksCancel.addEventListener('click', resetWorksForm);

  worksForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('workId').value;
    const payload = {
      courseCode: document.getElementById('workCourseCode').value.trim(),
      title: document.getElementById('title').value.trim(),
      description: document.getElementById('description').value.trim(),
      deadline: document.getElementById('deadline').value,
    };
    const errEl = document.getElementById('worksError');
    errEl.classList.remove('is-visible');
    try {
      if (id) {
        await api(`/api/schoolworks/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
        showToast('School work updated.');
      } else {
        await api('/api/schoolworks', { method: 'POST', body: JSON.stringify(payload) });
        showToast('School work posted.');
      }
      resetWorksForm();
      loadWorks();
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.add('is-visible');
    }
  });

  async function deleteWork(id) {
    if (!confirm('Remove this school work?')) return;
    try {
      await api(`/api/schoolworks/${id}`, { method: 'DELETE' });
      showToast('School work removed.');
      loadWorks();
    } catch (err) {
      showToast(err.message, true);
    }
  }

  // ---------------- Discord Bot ----------------

  let botStatusTimer = null;

  async function loadBotConfig() {
    try {
      const cfg = await api('/api/bot/config');
      document.getElementById('botToken').value = '';
      document.getElementById('botToken').placeholder = cfg.hasToken
        ? `Currently set (${cfg.tokenPreview}) — paste to replace`
        : 'Paste to set — leave blank to keep the current one';
      document.getElementById('botTokenStatus').textContent = cfg.hasToken
        ? `Token saved (${cfg.tokenPreview}).`
        : 'No token saved yet.';
      document.getElementById('botClientId').value = cfg.clientId || '';
      document.getElementById('botGuildId').value = cfg.guildId || '';
      document.getElementById('botChannelId').value = cfg.announceChannelId || '';
      document.getElementById('botDailyEnabled').checked = !!cfg.dailyScheduleEnabled;
      document.getElementById('botDailyHour').value = cfg.dailyScheduleHour ?? 7;
      document.getElementById('botRemindersEnabled').checked = !!cfg.deadlineRemindersEnabled;
      document.getElementById('botLeadHours').value = cfg.reminderLeadHours ?? 24;
      document.getElementById('botNewWorkEnabled').checked = cfg.newWorkAnnounceEnabled !== false;
    } catch (err) {
      showToast(err.message, true);
    }
    refreshBotStatus();
    if (!botStatusTimer) botStatusTimer = setInterval(refreshBotStatus, 6000);
  }

  async function refreshBotStatus() {
    const box = document.getElementById('botStatusBox');
    const dot = document.getElementById('botStatusDot');
    const text = document.getElementById('botStatusText');
    try {
      const status = await api('/api/bot/status');
      box.classList.remove('is-online', 'is-offline', 'is-error');
      if (status.running) {
        box.classList.add('is-online');
        text.textContent = `Online as ${status.tag}`;
      } else if (status.lastError) {
        box.classList.add('is-error');
        text.textContent = status.lastError;
      } else {
        box.classList.add('is-offline');
        text.textContent = 'Offline';
      }
    } catch (err) {
      text.textContent = 'Could not check status.';
    }
  }

  document.getElementById('botConfigForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = document.getElementById('botConfigError');
    errEl.classList.remove('is-visible');
    const payload = {
      clientId: document.getElementById('botClientId').value.trim(),
      guildId: document.getElementById('botGuildId').value.trim(),
      announceChannelId: document.getElementById('botChannelId').value.trim(),
    };
    const token = document.getElementById('botToken').value.trim();
    if (token) payload.token = token;
    try {
      await api('/api/bot/config', { method: 'POST', body: JSON.stringify(payload) });
      showToast('Bot config saved.');
      loadBotConfig();
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.add('is-visible');
    }
  });

  document.getElementById('botFeaturesSaveBtn').addEventListener('click', async () => {
    const payload = {
      dailyScheduleEnabled: document.getElementById('botDailyEnabled').checked,
      dailyScheduleHour: Number(document.getElementById('botDailyHour').value) || 7,
      deadlineRemindersEnabled: document.getElementById('botRemindersEnabled').checked,
      reminderLeadHours: Number(document.getElementById('botLeadHours').value) || 24,
      newWorkAnnounceEnabled: document.getElementById('botNewWorkEnabled').checked,
    };
    try {
      await api('/api/bot/config', { method: 'POST', body: JSON.stringify(payload) });
      showToast('Feature settings saved.');
    } catch (err) {
      showToast(err.message, true);
    }
  });

  document.getElementById('botStartBtn').addEventListener('click', async () => {
    const errEl = document.getElementById('botActionError');
    errEl.classList.remove('is-visible');
    try {
      const status = await api('/api/bot/start', { method: 'POST' });
      if (status.lastError) {
        errEl.textContent = status.lastError;
        errEl.classList.add('is-visible');
      } else {
        showToast('Starting bot…');
      }
      refreshBotStatus();
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.add('is-visible');
    }
  });

  document.getElementById('botStopBtn').addEventListener('click', async () => {
    try {
      await api('/api/bot/stop', { method: 'POST' });
      showToast('Bot stopped.');
      refreshBotStatus();
    } catch (err) {
      showToast(err.message, true);
    }
  });

  document.getElementById('botDeployBtn').addEventListener('click', async () => {
    const errEl = document.getElementById('botConfigError');
    errEl.classList.remove('is-visible');
    try {
      const result = await api('/api/bot/deploy-commands', { method: 'POST' });
      showToast(`Registered ${result.count} command(s) (${result.scope}).`);
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.add('is-visible');
    }
  });

  document.addEventListener('DOMContentLoaded', checkSession);
})();
