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

    list.innerHTML = filtered.map((w) => {
      const cd = countdownInfo(w.deadline);
      return `
        <article class="work-card ${cd.cardCls}">
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
  }

  async function init() {
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
