(() => {
  let allWorks = [];
  let activeFilter = 'ALL';

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function formatDeadline(iso) {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      weekday: 'short', month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit',
    });
  }

  function countdownInfo(iso) {
    const diffMs = new Date(iso) - new Date();
    const diffHrs = diffMs / (1000 * 60 * 60);

    if (diffMs < 0) return { label: 'Past due', cls: 'is-past', cardCls: 'is-past' };
    if (diffHrs < 24) {
      const h = Math.max(1, Math.round(diffHrs));
      return { label: `Due in ${h}h`, cls: 'is-urgent', cardCls: 'is-urgent' };
    }
    const days = Math.round(diffHrs / 24);
    if (days <= 3) return { label: `Due in ${days}d`, cls: '', cardCls: 'is-soon' };
    return { label: `Due in ${days}d`, cls: '', cardCls: '' };
  }

  function renderFilters() {
    const codes = ['ALL', ...new Set(allWorks.map((w) => w.courseCode))];
    const wrap = document.getElementById('worksFilter');
    wrap.innerHTML = codes.map((code) =>
      `<button class="filter-chip ${code === activeFilter ? 'is-active' : ''}" data-code="${escapeHtml(code)}">${escapeHtml(code)}</button>`
    ).join('');
    wrap.querySelectorAll('.filter-chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeFilter = btn.dataset.code;
        renderFilters();
        renderList();
      });
    });
  }

  function fullDeadlineLabel(iso) {
    return new Date(iso).toLocaleString(undefined, {
      weekday: 'long', month: 'long', day: 'numeric',
      hour: 'numeric', minute: '2-digit',
    });
  }

  function openModal(work) {
    const cd = countdownInfo(work.deadline);
    document.getElementById('workModalEyebrow').textContent = `${work.courseCode} · ${cd.label}`;
    document.getElementById('workModalTitle').textContent = work.title;
    document.getElementById('workModalDeadline').textContent = `Due ${fullDeadlineLabel(work.deadline)}`;
    document.getElementById('workModalDesc').textContent = work.description || 'No further details were posted.';
    document.getElementById('workModal').classList.add('is-open');
  }

  function closeModal() {
    document.getElementById('workModal').classList.remove('is-open');
  }

  function renderList() {
    const list = document.getElementById('worksList');
    const empty = document.getElementById('emptyNote');
    const filtered = activeFilter === 'ALL'
      ? allWorks
      : allWorks.filter((w) => w.courseCode === activeFilter);

    if (!filtered.length) {
      list.innerHTML = '';
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';

    list.innerHTML = filtered.map((w, i) => {
      const cd = countdownInfo(w.deadline);
      return `
        <article class="work-card ${cd.cardCls}" data-index="${i}" tabindex="0" role="button" aria-label="View details for ${escapeHtml(w.title)}">
          <div class="work-card__code">${escapeHtml(w.courseCode)}</div>
          <div class="work-card__title">${escapeHtml(w.title)}</div>
          ${w.description ? `<div class="work-card__desc">${escapeHtml(w.description)}</div>` : '<div class="work-card__desc"></div>'}
          <div class="work-card__footer">
            <span class="work-card__deadline">${formatDeadline(w.deadline)}</span>
            <span class="countdown-chip ${cd.cls}">${cd.label}</span>
          </div>
        </article>
      `;
    }).join('');

    list.querySelectorAll('.work-card').forEach((card) => {
      const work = filtered[Number(card.dataset.index)];
      card.addEventListener('click', () => openModal(work));
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openModal(work); }
      });
    });
  }

  async function init() {
    document.getElementById('workModalClose').addEventListener('click', closeModal);
    document.getElementById('workModal').addEventListener('click', (e) => {
      if (e.target.id === 'workModal') closeModal();
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

    try {
      const res = await fetch('/api/schoolworks');
      if (!res.ok) throw new Error('Failed to load school works');
      allWorks = await res.json();
      renderFilters();
      renderList();
    } catch (err) {
      showToast('Could not load school works. Try refreshing.', true);
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
