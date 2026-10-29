(function () {
  'use strict';
  const C = window.OraysaCore;
  const Otz = window.Otz;

  const state = {
    tab: ['day', 'month', 'lookup', 'progress'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'day',
    today: C.todayDn(),
    viewDn: C.todayDn(),
    month: null, // {y, m}
    lookup: null, // {mi, daf, amud}
    settings: { review30: false, review90: false, shabbos2w: false },
    checks: {}, // key -> dn שבו סומן
  };

  const $ = (sel, root) => (root || document).querySelector(sel);
  const content = $('#content');
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ── מעקב ──
  // L:idx = למדתי, R:idx = חזרתי (חזרת יום), W:idx = חזרת שישי/שבת, X:type:idx = חזרת רשות
  const isDone = (key) => !!state.checks[key];
  async function toggle(key) {
    if (state.checks[key]) delete state.checks[key]; else state.checks[key] = state.today;
    await Otz.save('checks', state.checks);
    render();
  }
  function dayKeys(plan) {
    const keys = [];
    if (plan.kind === 'learn') { keys.push(`L:${plan.learn.idx}`); if (plan.review) keys.push(`R:${plan.review.idx}`); }
    for (const a of plan.weekly) keys.push(`W:${a.idx}`);
    return keys;
  }
  function dayStatus(dn) {
    const keys = dayKeys(C.dayPlan(dn));
    if (!keys.length) return null;
    const done = keys.filter(isDone).length;
    if (done === keys.length) return 'done';
    if (done > 0) return 'partial';
    return dn < state.today && dn >= trackingStart() ? 'missed' : null;
  }
  function trackingStart() {
    let min = Infinity;
    for (const k of Object.keys(state.checks)) {
      const idx = parseInt(k.split(':').pop(), 10);
      if (k.startsWith('L:') && Number.isInteger(idx)) min = Math.min(min, C.dayOfIndex(idx));
    }
    return min;
  }

  // ── עזרי תצוגה ──
  const ICON_BOOK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M2 5h7a3 3 0 0 1 3 3v12a2 2 0 0 0-2-2H2z"/><path d="M22 5h-7a3 3 0 0 0-3 3v12a2 2 0 0 1 2-2h8z"/></svg>';
  const ICON_CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>';

  function dateTitle(dn) {
    const h = C.hebrewDate(dn);
    return `${C.DAY_NAMES[C.dowOf(dn)]}, ${h ? h.text : ''}`;
  }

  function assignmentRow(a, key, doneText, todoText, small) {
    const done = isDone(key);
    return `<div class="assignment">
      <div class="amud-label${small ? ' small' : ''}">${esc(C.longLabel(a))}${a.projected ? '<span class="tag">(משוער)</span>' : ''}</div>
      <div class="actions">
        <button class="btn btn-tonal" data-open="${a.idx}">${ICON_BOOK} פתח</button>
        <button class="btn check${done ? ' done' : ''}" data-toggle="${key}">${ICON_CHECK} ${done ? doneText : todoText}</button>
      </div>
    </div>`;
  }

  // ── היום ──
  function renderDay() {
    const dn = state.viewDn;
    const plan = C.dayPlan(dn, state.settings);
    const isToday = dn === state.today;
    let html = `<div class="card"><div class="day-nav">
      <button class="icon-btn" data-day="-1" title="היום הקודם" aria-label="היום הקודם">›</button>
      <div class="date-block">
        <div class="date-main">${esc(dateTitle(dn))}</div>
        <div class="date-sub"><span class="ltr">${C.gregText(dn)}</span>${isToday ? ' · היום' : ''} <span id="holiday" class="holiday"></span></div>
      </div>
      <button class="icon-btn" data-day="1" title="היום הבא" aria-label="היום הבא">‹</button>
    </div>${isToday ? '' : '<div style="text-align:center;margin-top:8px"><button class="btn btn-outline" data-goto-today>חזרה להיום</button></div>'}</div>`;

    if (plan.kind === 'before') {
      html += '<div class="card"><p class="muted">התוכנית התחילה ביום א׳, י׳ טבת תש״פ (5.1.2020) במסכת ברכות.</p></div>';
    } else if (plan.kind === 'after') {
      html += '<div class="card"><p class="muted">סיום הש״ס! אין עוד עמודים בלוח.</p></div>';
    } else if (plan.kind === 'learn') {
      html += `<div class="card primary"><div class="card-title">שיעור היום</div>
        ${assignmentRow(plan.learn, `L:${plan.learn.idx}`, 'למדתי', 'סמן שלמדתי')}</div>`;
      if (plan.review) {
        html += `<div class="card"><div class="card-title">חזרה על עמוד אתמול</div>
          ${assignmentRow(plan.review, `R:${plan.review.idx}`, 'חזרתי', 'סמן שחזרתי', true)}</div>`;
      }
    } else {
      const title = plan.kind === 'friday' ? 'חזרה שבועית — יום שישי (עמודי א׳–ב׳)' : 'חזרה שבועית — שבת קודש (עמודי ג׳–ה׳)';
      html += `<div class="card primary"><div class="card-title">${title}</div>
        ${plan.weekly.map((a) => assignmentRow(a, `W:${a.idx}`, 'חזרתי', 'סמן שחזרתי', true)).join('')}</div>`;
    }

    if (plan.extras.length) {
      const names = { r30: 'חזרה אחרי 30 יום', r90: 'חזרה אחרי 90 יום', s2w: 'חזרת שבועיים' };
      html += `<div class="card"><div class="card-title">חזרות רשות</div>
        ${plan.extras.map((e) => `<div class="muted" style="margin-top:6px">${names[e.type]}</div>${assignmentRow(e.amud, `X:${e.type}:${e.amud.idx}`, 'חזרתי', 'סמן', true)}`).join('')}</div>`;
    }

    const cur = plan.learn || plan.weekly[plan.weekly.length - 1];
    if (cur) html += masechetCard(cur);
    content.innerHTML = `<div class="view">${html}</div>`;

    Otz.jewishDateInfo(C.isoOf(dn)).then((info) => {
      const el = $('#holiday');
      if (!el || !info || state.viewDn !== dn) return;
      const parts = [];
      if (info.holidays && info.holidays.length) parts.push(info.holidays.map((h) => h.text).join(', '));
      if (info.parasha && C.dowOf(dn) === 6) parts.push(`פרשת ${info.parasha}`);
      el.textContent = parts.length ? `· ${parts.join(' · ')}` : '';
    });
  }

  function masechetCard(a) {
    const m = C.MASECHTOS[a.masechetIndex];
    const span = C.masechetSpan(m);
    const next = C.MASECHTOS[m.index + 1];
    const pct = Math.round((a.pos / a.of) * 100);
    const h = (dn) => { const x = C.hebrewDate(dn); return x ? x.text : C.gregText(dn); };
    return `<div class="card"><div class="card-title">מסכת ${esc(m.name)} <span class="chip">${pct}%</span></div>
      <div class="progress"><span style="width:${pct}%"></span></div>
      <div class="kv"><span>עמוד</span><span>${a.pos} מתוך ${a.of}</span></div>
      <div class="kv"><span>התחלת המסכת</span><span>${esc(h(span.startDn))}</span></div>
      <div class="kv"><span>סיום המסכת${span.projected ? ' (משוער)' : ''}</span><span>${esc(h(span.endDn))}</span></div>
      ${next ? `<div class="kv"><span>המסכת הבאה</span><span>${esc(next.name)} — ${esc(h(C.masechetSpan(next).startDn))}</span></div>` : ''}
    </div>`;
  }

  // ── לוח חודשי ──
  function renderMonth() {
    if (!state.month) { const t = C.fromDayNum(state.viewDn); state.month = { y: t.y, m: t.m }; }
    const { y, m } = state.month;
    const first = C.dayNum(y, m, 1);
    const last = C.dayNum(m === 12 ? y + 1 : y, m === 12 ? 1 : m + 1, 1) - 1;
    const gridStart = first - C.dowOf(first);
    const gridEnd = last + (6 - C.dowOf(last));
    const h1 = C.hebrewDate(first), h2 = C.hebrewDate(last);
    const hebSpan = h1 && h2 ? (h1.month === h2.month ? `${h1.month} ${C.hebNum(h1.year % 1000, true)}` : `${h1.month}–${h2.month} ${C.hebNum(h2.year % 1000, true)}`) : '';

    let cells = C.DAY_LETTERS.map((d) => `<div class="dow">${d}</div>`).join('');
    for (let dn = gridStart; dn <= gridEnd; dn++) {
      const plan = C.dayPlan(dn);
      const g = C.fromDayNum(dn);
      const h = C.hebrewDate(dn);
      let what = '', mname = '';
      if (plan.kind === 'learn') {
        what = C.dafMark(plan.learn);
        if (plan.learn.pos === 1 || dn === gridStart || g.d === 1) mname = plan.learn.masechet;
      } else if (plan.kind === 'friday' || plan.kind === 'shabbos') {
        what = 'חזרה';
        if (plan.weekly.length) mname = plan.weekly.map(C.dafMark).join(' ');
      }
      const st = dayStatus(dn);
      const stText = st === 'done' ? '✓ הושלם' : st === 'partial' ? '◐ חלקי' : st === 'missed' ? '✗ חסר' : '';
      const cls = ['cell', g.m !== m ? 'other' : '', C.dowOf(dn) >= 5 ? 'weekend' : '', dn === state.today ? 'today' : '', dn === state.viewDn ? 'selected' : ''].join(' ');
      cells += `<button class="${cls}" data-pick="${dn}">
        <div class="nums"><span>${h ? h.dayText : ''}</span><span>${g.d}</span></div>
        <div class="what">${esc(what)}</div>
        ${mname ? `<div class="mname">${esc(mname)}</div>` : ''}
        ${stText ? `<div class="status ${st === 'missed' ? 'missed' : 'done'}">${stText}</div>` : ''}
      </button>`;
    }
    content.innerHTML = `<div class="view"><div class="card">
      <div class="month-head">
        <button class="icon-btn" data-month="-1" aria-label="החודש הקודם">›</button>
        <div class="title"><div class="date-main">${C.GREG_MONTHS[m - 1]} ${y}</div><div class="date-sub">${esc(hebSpan)}</div></div>
        <button class="icon-btn" data-month="1" aria-label="החודש הבא">‹</button>
      </div>
      <div style="text-align:center;margin:8px 0"><button class="btn btn-outline" data-month="0">החודש</button></div>
      <div class="grid">${cells}</div>
      <p class="muted">לחיצה על יום פותחת את פרטיו.</p>
    </div></div>`;
  }

  // ── איתור עמוד ──
  function renderLookup() {
    if (!state.lookup) {
      const a = C.amudAt(C.learningIndexOn(state.today) ?? C.weekStartIndex(state.today)) || C.amudAt(0);
      state.lookup = { mi: a.masechetIndex, daf: a.daf, amud: a.amud };
    }
    const L = state.lookup;
    const m = C.MASECHTOS[L.mi];
    if (L.daf < m.firstDaf) L.daf = m.firstDaf;
    if (L.daf > m.lastDaf) L.daf = m.lastDaf;
    let idx = C.indexOf(m, L.daf, L.amud);
    if (idx < 0) { L.amud = L.daf === m.firstDaf ? m.firstAmud : m.lastAmud; idx = C.indexOf(m, L.daf, L.amud); }
    const a = C.amudAt(idx);

    const mOpts = C.MASECHTOS.map((x) => `<option value="${x.index}"${x.index === L.mi ? ' selected' : ''}>${esc(x.name)}</option>`).join('');
    let dOpts = '';
    for (let d = m.firstDaf; d <= m.lastDaf; d++) dOpts += `<option value="${d}"${d === L.daf ? ' selected' : ''}>${C.hebNum(d, true)}</option>`;
    const aOpts = `<option value="0"${L.amud === 0 ? ' selected' : ''}>ע״א</option><option value="1"${L.amud === 1 ? ' selected' : ''}>ע״ב</option>`;

    const learnDn = C.dayOfIndex(idx);
    const reviewDn = C.dayOfIndex(idx + 1);
    const pos = idx % 5;
    const weeklyDn = learnDn + (pos <= 1 ? 5 - pos : 6 - pos);
    const line = (label, dn) => `<div class="kv"><span>${label}</span><span>${esc(dateTitle(dn))} · <span class="ltr">${C.gregText(dn)}</span></span></div>`;

    const rows = C.MASECHTOS.map((x) => {
      const s = C.masechetSpan(x);
      const cur = state.today >= s.startDn && state.today <= s.endDn;
      const hs = C.hebrewDate(s.startDn), he = C.hebrewDate(s.endDn);
      return `<tr class="clickable${cur ? ' current' : ''}" data-lookup-m="${x.index}"><td>${esc(x.name)}</td><td>${x.length / 2} דף</td><td>${esc(hs ? hs.text : '')}</td><td>${esc(he ? he.text : '')}${s.projected ? ' *' : ''}</td></tr>`;
    }).join('');

    content.innerHTML = `<div class="view">
      <div class="card"><div class="card-title">מתי לומדים את העמוד?</div>
        <div class="form-row">
          <select id="lk-m" aria-label="מסכת">${mOpts}</select>
          <select id="lk-d" aria-label="דף">${dOpts}</select>
          <select id="lk-a" aria-label="עמוד">${aOpts}</select>
        </div>
        <div style="margin-top:12px">
          ${assignmentRow(a, `L:${idx}`, 'למדתי', 'סמן שלמדתי')}
          ${line('לימוד העמוד', learnDn)}
          ${reviewDn !== learnDn ? line('חזרה למחרת', reviewDn) : ''}
          ${line('חזרה שבועית', weeklyDn)}
          ${a.projected ? '<p class="muted">* תאריך משוער — אחרי מסכת כתובות הלוח מחושב לפי סדר הש״ס.</p>' : ''}
          <div style="margin-top:8px"><button class="btn btn-outline" data-pick="${learnDn}">הצג את היום בלוח</button></div>
        </div>
      </div>
      <div class="card"><div class="card-title">סדר המסכתות בתוכנית</div>
        <table><thead><tr><th>מסכת</th><th>אורך</th><th>התחלה</th><th>סיום</th></tr></thead><tbody>${rows}</tbody></table>
        <p class="muted">* משוער. לאחר יבמות נלמדת קידושין, ואחריה כתובות; משם ממשיכים לפי סדר הש״ס.</p>
      </div>
    </div>`;
  }

  // ── התקדמות ──
  function renderProgress() {
    const todayIdx = C.learningIndexOn(state.today);
    const scheduled = todayIdx != null ? todayIdx + 1 : Math.min(C.TOTAL, C.weekStartIndex(state.today) + 5);
    const shasPct = ((scheduled / C.TOTAL) * 100).toFixed(1);
    const learned = Object.keys(state.checks).filter((k) => k.startsWith('L:')).length;
    const reviews = Object.keys(state.checks).length - learned;

    // רצף: ימי לימוד רצופים (עד היום, או עד אתמול אם היום טרם סומן)
    let streak = 0;
    let dn = state.today;
    if (C.learningIndexOn(dn) != null && !isDone(`L:${C.learningIndexOn(dn)}`)) dn--;
    for (let guard = 0; guard < 4000; guard++, dn--) {
      const i = C.learningIndexOn(dn);
      if (i == null) { if (dn < C.EPOCH) break; continue; }
      if (!isDone(`L:${i}`)) break;
      streak++;
    }

    const start = trackingStart();
    const missed = [];
    if (start !== Infinity) {
      for (let d = Math.max(start, state.today - 60); d < state.today; d++) {
        const i = C.learningIndexOn(d);
        if (i != null && !isDone(`L:${i}`)) missed.push(C.amudAt(i));
      }
    }

    content.innerHTML = `<div class="view">
      <div class="card"><div class="card-title">התקדמות התוכנית בש״ס</div>
        <div class="progress"><span style="width:${shasPct}%"></span></div>
        <div class="kv"><span>עמודים בלוח עד היום</span><span>${scheduled} מתוך ${C.TOTAL} (${shasPct}%)</span></div>
      </div>
      <div class="card"><div class="card-title">המעקב שלי</div>
        <div class="stat-grid">
          <div class="stat"><b>${learned}</b><span>עמודים שסומנו</span></div>
          <div class="stat"><b>${(learned / 2).toFixed(1)}</b><span>דפים</span></div>
          <div class="stat"><b>${reviews}</b><span>חזרות</span></div>
          <div class="stat"><b>${streak}</b><span>ימי לימוד ברצף</span></div>
        </div>
      </div>
      <div class="card"><div class="card-title">להשלים ${missed.length ? `<span class="chip warn">${missed.length}</span>` : ''}</div>
        ${start === Infinity ? '<p class="muted">סמנו "למדתי" בעמוד היומי, והתוסף יעקוב אחרי מה שנותר להשלים.</p>'
          : missed.length ? missed.map((a) => assignmentRow(a, `L:${a.idx}`, 'למדתי', 'סמן שלמדתי', true)).join('')
            : '<p class="muted">אין עמודים להשלמה. יישר כח!</p>'}
      </div>
    </div>`;
  }

  // ── ניתוב ──
  function render() {
    state.today = C.todayDn();
    document.querySelectorAll('.nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.tab === state.tab));
    const t = C.learningIndexOn(state.today);
    $('#topbar-sub').textContent = t != null ? `היום: ${C.shortLabel(C.amudAt(t))}` : 'היום: חזרה שבועית';
    ({ day: renderDay, month: renderMonth, lookup: renderLookup, progress: renderProgress })[state.tab]();
  }

  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toast.t);
    toast.t = setTimeout(() => { el.hidden = true; }, 3500);
  }

  async function openIdx(idx) {
    const r = await Otz.openAmud(C.amudAt(idx));
    if (r.message) { if (!(await Otz.notify(r.message, r.ok ? 'info' : 'error'))) toast(r.message); }
  }

  document.addEventListener('click', (ev) => {
    const el = ev.target.closest('button, tr');
    if (!el) return;
    const d = el.dataset;
    if (d.tab) { state.tab = d.tab; render(); content.scrollTop = 0; }
    else if (d.toggle) toggle(d.toggle);
    else if (d.open) openIdx(parseInt(d.open, 10));
    else if (d.day) { state.viewDn += parseInt(d.day, 10); render(); }
    else if (d.gotoToday !== undefined) { state.viewDn = state.today; render(); }
    else if (d.pick) { state.viewDn = parseInt(d.pick, 10); state.tab = 'day'; state.month = null; render(); content.scrollTop = 0; }
    else if (d.month) {
      const delta = parseInt(d.month, 10);
      if (delta === 0) { const t = C.fromDayNum(state.today); state.month = { y: t.y, m: t.m }; }
      else { let { y, m } = state.month; m += delta; if (m < 1) { m = 12; y--; } if (m > 12) { m = 1; y++; } state.month = { y, m }; }
      render();
    } else if (d.lookupM) { state.lookup = { mi: parseInt(d.lookupM, 10), daf: 2, amud: 0 }; render(); content.scrollTop = 0; }
  });

  document.addEventListener('change', (ev) => {
    const t = ev.target;
    if (t.id === 'lk-m') { state.lookup = { mi: parseInt(t.value, 10), daf: 0, amud: 0 }; render(); }
    else if (t.id === 'lk-d') { state.lookup.daf = parseInt(t.value, 10); render(); }
    else if (t.id === 'lk-a') { state.lookup.amud = parseInt(t.value, 10); render(); }
    else if (t.dataset.setting) {
      state.settings[t.dataset.setting] = t.checked;
      Otz.save('settings', state.settings);
      render();
    }
  });

  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') $('#settings').hidden = true;
    if (state.tab === 'day' && !ev.target.closest('select, input')) {
      if (ev.key === 'ArrowRight') { state.viewDn--; render(); }
      if (ev.key === 'ArrowLeft') { state.viewDn++; render(); }
    }
  });

  $('#btn-settings').addEventListener('click', () => {
    document.querySelectorAll('[data-setting]').forEach((i) => { i.checked = !!state.settings[i.dataset.setting]; });
    $('#settings').hidden = false;
  });
  $('#btn-settings-close').addEventListener('click', () => { $('#settings').hidden = true; });
  $('#settings').addEventListener('click', (ev) => { if (ev.target.id === 'settings') ev.target.hidden = true; });

  // רענון כשהיום מתחלף בזמן שהתוסף פתוח
  setInterval(() => {
    const t = C.todayDn();
    if (t !== state.today) { if (state.viewDn === state.today) state.viewDn = t; render(); }
  }, 60000);

  Otz.boot(async () => {
    const [settings, checks] = await Promise.all([Otz.load('settings'), Otz.load('checks')]);
    if (settings) Object.assign(state.settings, settings);
    if (checks && typeof checks === 'object') state.checks = checks;
    render();
  });
})();
