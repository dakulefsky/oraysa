(function () {
  'use strict';
  const C = window.OraysaCore;
  const Otz = window.Otz;
  const ResourceSync = window.OraysaResources.create({ core: C, call: Otz.call, load: Otz.load, save: Otz.save });
  let resourceStatus = { configured: false, downloadedCount: 0, lastSync: null, lastMessage: '', busy: false };

  const state = {
    tab: ['day', 'month', 'lookup', 'bechinos', 'progress', 'resources'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'day',
    today: C.todayDn(),
    viewDn: C.todayDn(),
    month: null, // {y, m}
    lookup: null, // {mi, daf, amud}
    settings: { review30: false, review90: false, shabbos2w: false, bechinaParity: 1, meforshim: ['רש״י', 'תוספות'] },
    mef: null, // מצב המפרשים בטאב הקריאה שנפתח אחרון: { idx, available, active }
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

  const MEFORSHIM = ['רש״י', 'תוספות', 'רשב״א', 'ריטב״א', 'רמב״ן', 'ר״ן', 'מהרש״א', 'מהר״ם', 'פני יהושע', 'שטמ״ק'];

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

    const main = plan.learn || plan.weekly[0];
    if (main) html += resourcesCard(main, plan.weekly);
    if (C.isBechinaDay(dn, state.settings.bechinaParity)) html += bechinaCard(dn, true);
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

  function resourcesCard(a, weekly) {
    const mefState = state.mef && state.mef.available && state.mef.available.length ? state.mef : null;
    const mefChips = mefState
      ? mefState.available.map((t) => `<button class="chip-btn${mefState.active.includes(t) ? ' on' : ''}" data-mef-toggle="${esc(t)}">${esc(t)}</button>`).join('')
      : state.settings.meforshim.map((m) => `<span class="chip">${esc(m)}</span>`).join(' ');
    const others = (weekly || []).filter((w) => w.idx !== a.idx);
    const siteBtn = (x) => `<button class="btn btn-outline" data-url="${esc(C.siteUrl(x))}">${C.hasSiteResources(x) ? '' : ''}${esc(C.shortLabel(x))}</button>`;
    return `<div class="card"><div class="card-title">מפרשים וחומרי עזר</div>
      <div class="res-row">
        <div class="res-head">מפרשים באוצריא</div>
        <div class="chips">${mefChips}</div>
        <div class="actions"><button class="btn btn-tonal" data-open="${a.idx}">${ICON_BOOK} פתח את ${esc(C.shortLabel(a))} עם המפרשים</button></div>
        <p class="muted">${mefState ? 'לחצו על מפרש כדי להוסיף או להסיר אותו מהטאב הפתוח.' : 'בחירת המפרשים — בהגדרות. אחרי הפתיחה יוצגו כאן כל המפרשים הזמינים.'}</p>
      </div>
      <div class="res-row">
        <div class="res-head">מאתר אורייתא</div>
        <p class="muted">מראי מקומות (פתגמי אורייתא), סיכומי אורייתא (שאלות ותשובות), צורת הדף עם פירוש, חידודי אורייתא (חידון יומי), זכרו, ושיעורי וידאו ואודיו.</p>
        <div class="actions wrap">
          <button class="btn btn-primary" data-url="${esc(C.siteUrl(a))}">חומרי העזר ל${esc(C.shortLabel(a))}</button>
          ${others.map(siteBtn).join('')}
        </div>
        ${C.hasSiteResources(a) ? '' : '<p class="muted">לעמוד זה אין עדיין קישור ישיר בתוסף — ייפתח דף הבית של אורייתא.</p>'}
      </div>
    </div>`;
  }

  function bechinaCard(dn, compact) {
    const b = C.bechinaFor(dn);
    if (!b) return '';
    const key = `B:${dn}`;
    const done = isDone(key);
    const m = b.to.masechet;
    const h = C.hebrewDate(dn);
    return `<div class="card${compact ? ' primary' : ''}"><div class="card-title">${compact ? 'היום: בחינה דו-שבועית' : esc(`${C.DAY_NAMES[0]}, ${h ? h.text : ''}`)}
        ${dn === state.today ? '<span class="chip">היום</span>' : dn < state.today ? '' : `<span class="chip">בעוד ${dn - state.today} ימים</span>`}</div>
      <div class="amud-label small">${esc(C.shortLabel(b.from))} – ${esc(C.shortLabel(b.to))}</div>
      <p class="muted">${b.amudim.length / 2} דפים · <span class="ltr">${C.gregText(dn)}</span> · יש להגיש עד 11 בלילה, בגמרא סגורה, תוך שעה וחצי.</p>
      <div class="actions wrap">
        <button class="btn btn-tonal" data-open="${b.from.idx}">${ICON_BOOK} חזרה מ${esc(C.dafMark(b.from))}</button>
        <button class="btn btn-primary" data-url="${esc(C.moodleUrl(m))}">בחינה מקוונת</button>
        <button class="btn btn-outline" data-url="${esc(C.SITE_BECHINOS)}">טופסי הבחינות (PDF)</button>
        <button class="btn check${done ? ' done' : ''}" data-toggle="${key}">${ICON_CHECK} ${done ? 'נבחנתי' : 'סמן שנבחנתי'}</button>
      </div>
    </div>`;
  }

  function renderBechinos() {
    const parity = state.settings.bechinaParity;
    const upcoming = C.nextBechinaDays(state.today, parity, 6);
    const past = [];
    for (let dn = state.today - 1; past.length < 4 && dn > state.today - 70; dn--) if (C.isBechinaDay(dn, parity)) past.push(dn);
    content.innerHTML = `<div class="view">
      <div class="card"><div class="card-title">מבחני אורייתא</div>
        <p class="muted">בכל יום ראשון שני נערכת בחינה על 5 הדפים שנלמדו בשבועיים שקדמו לה. אפשר להיבחן באתר הבחינות המקוון, או להדפיס את הטופס ולשלוח את דף התשובות. המשתתפים בתוכנית המלגות נדרשים לשתי הבחינות בחודש.</p>
        <div class="actions wrap">
          <button class="btn btn-primary" data-url="${esc(C.MOODLE)}/">אתר הבחינות</button>
          <button class="btn btn-outline" data-url="${esc(C.SITE_BECHINOS)}">טופסי הבחינות (PDF)</button>
          <button class="btn btn-outline" data-url="${esc(C.SITE)}/en/faqs">שאלות נפוצות</button>
        </div>
        <p class="muted">מועד הבחינות מחושב בתוסף; אם אינו תואם ללוח של אורייתא — החליפו בהגדרות.</p>
      </div>
      <h3 class="section-title">הבחינות הקרובות</h3>
      ${upcoming.map((dn) => bechinaCard(dn, false)).join('')}
      ${past.length ? `<h3 class="section-title">בחינות קודמות</h3>${past.map((dn) => bechinaCard(dn, false)).join('')}` : ''}
    </div>`;
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

  // ── חומרי אורייתא והורדה לא מקוונת ──
  function renderResources() {
    const today = C.todayDn();
    const startIdx = C.weekStartIndex(today);
    const assignments = [];
    for (let i = 0; i < 5; i++) {
      const a = C.amudAt(startIdx + i);
      if (a) assignments.push(a);
    }
    const last = resourceStatus.lastSync ? new Date(resourceStatus.lastSync).toLocaleString('he-IL') : 'עדיין לא סונכרן';
    const folder = resourceStatus.configured
      ? '<p class="muted">תיקייה: ' + esc(resourceStatus.folderName || 'נבחרה') + '</p>'
      : '<p class="muted">בחרו תיקייה פעם אחת. אוצריא תשמור בה את קובצי ה-PDF ותאפשר גישה קבועה גם בהפעלות הבאות.</p>';
    content.innerHTML = '<div class="view">' +
      '<div class="card"><div class="card-title">חומרי אורייתא — זמין גם בלי אינטרנט</div>' +
      '<p class="muted">התוסף בודק את חמשת עמודי הלימוד של השבוע ומוריד קובצי PDF רשמיים כשאורייתא מפרסמת אותם. עמודים שעדיין אין להם קובץ ייבדקו שוב בסנכרון הבא.</p>' +
      folder +
      '<div class="kv"><span>קבצים שנשמרו</span><b>' + resourceStatus.downloadedCount + '</b></div>' +
      '<div class="kv"><span>סנכרון אחרון</span><span>' + esc(last) + '</span></div>' +
      (resourceStatus.lastMessage ? '<p class="muted">' + esc(resourceStatus.lastMessage) + '</p>' : '') +
      '<div class="actions wrap">' +
      (resourceStatus.configured
        ? '<button class="btn btn-primary" data-resource-sync' + (resourceStatus.busy ? ' disabled' : '') + '>סנכרן את השבוע</button><button class="btn btn-outline" data-resource-setup>החלף תיקייה</button>'
        : '<button class="btn btn-primary" data-resource-setup>בחר תיקיית שמירה והפעל סנכרון</button>') +
      '</div></div>' +
      '<div class="card"><div class="card-title">הורדת חומר מיום קודם</div>' +
      '<p class="muted">הורידו בנפרד משאבים רשמיים של עמוד שכבר נלמד. אין הורדה אוטומטית של ארכיון ישן.</p>' +
      '<div class="actions wrap"><input id="resource-date" type="date" min="2020-01-05" max="' + C.isoOf(today - 1) + '" aria-label="תאריך לימוד קודם">' +
      '<button class="btn btn-outline" data-resource-date' + (resourceStatus.busy ? ' disabled' : '') + '>מצא והורד משאבים</button></div></div>' +
      '<div class="card"><div class="card-title">השבוע הנוכחי</div>' +
      assignments.map((a) => {
        const prior = (resourceStatus.lastResults || []).find((r) => r.amud === C.shortLabel(a));
        let status = 'ייבדק אוטומטית';
        if (prior && prior.error) status = 'שגיאה: ' + prior.error;
        else if (prior && prior.unavailable) status = 'הקישור למסכת עדיין לא הוגדר';
        else if (prior && !prior.resourceCount) status = 'טרם פורסם PDF';
        else if (prior && prior.downloaded) status = prior.downloaded + ' קבצים חדשים נשמרו';
        else if (prior && prior.resourceCount) status = prior.resourceCount + ' קבצים זמינים · ללא קובץ חדש';
        return '<div class="assignment"><div class="amud-label">' + esc(C.longLabel(a)) + '</div><span class="muted">' + esc(status) + '</span></div>';
      }).join('') +
      '</div></div>';
  }

  async function refreshResourceStatus() {
    resourceStatus = ResourceSync.snapshot();
    if (state.tab === 'resources') render();
  }
  async function setupResourceFolder() {
    const result = await ResourceSync.chooseFolder();
    if (!result.ok) {
      if (!result.cancelled) say(result.message || 'לא ניתן לבחור תיקייה.', 'error');
      return;
    }
    resourceStatus = ResourceSync.snapshot();
    say('תיקיית השמירה אושרה. מתחיל סנכרון של השבוע הנוכחי.');
    await syncCurrentResources();
  }
  async function syncCurrentResources() {
    resourceStatus.busy = true;
    if (state.tab === 'resources') render();
    const result = await ResourceSync.syncWeek();
    resourceStatus = ResourceSync.snapshot();
    if (result.ok) say(result.state.lastMessage || 'בדיקת המשאבים הסתיימה.');
    else say(result.message || 'הסנכרון לא הושלם.', 'error');
    render();
  }
  async function syncPreviousDate() {
    if (!resourceStatus.configured) { await setupResourceFolder(); return; }
    resourceStatus.busy = true;
    if (state.tab === 'resources') render();
    const input = $('#resource-date');
    if (!input || !input.value) { resourceStatus = ResourceSync.snapshot(); say('בחרו תאריך קודם.', 'error'); render(); return; }
    const result = await ResourceSync.syncDate(input.value);
    resourceStatus = ResourceSync.snapshot();
    if (result.ok) say(result.downloaded
      ? result.downloaded + ' קבצים חדשים נשמרו.'
      : (result.results && result.results.length && result.results.every((r) => !r.error && !r.resources.length)
        ? 'לא נמצאו כרגע קובצי PDF בעמודים שנבדקו.'
        : (result.results && result.results.some((r) => r.error)
          ? 'הבדיקה הסתיימה עם שגיאה בחלק מהעמודים.'
          : 'לא נמצאו קבצים חדשים; הקבצים הקיימים נשמרו.')));
    else say(result.message || 'לא ניתן להוריד את המשאבים.', 'error');
    render();
  }

  // ── ניתוב ──
  function render() {
    state.today = C.todayDn();
    document.querySelectorAll('.nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.tab === state.tab));
    const t = C.learningIndexOn(state.today);
    $('#topbar-sub').textContent = t != null ? `היום: ${C.shortLabel(C.amudAt(t))}` : 'היום: חזרה שבועית';
    ({ day: renderDay, month: renderMonth, lookup: renderLookup, bechinos: renderBechinos, progress: renderProgress, resources: renderResources })[state.tab]();
  }

  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toast.t);
    toast.t = setTimeout(() => { el.hidden = true; }, 3500);
  }

  async function say(msg, kind) {
    if (!(await Otz.notify(msg, kind))) toast(msg);
  }

  async function openIdx(idx) {
    const r = await Otz.openAmud(C.amudAt(idx));
    if (r.message) say(r.message, r.ok ? 'info' : 'error');
    if (!r.ok) return;
    const st = await Otz.applyCommentators(state.settings.meforshim);
    if (st) { state.mef = { idx, available: st.available || [], active: st.active || [] }; if (state.tab === 'day') render(); }
  }

  async function toggleMef(title) {
    if (!state.mef) return;
    const on = !state.mef.active.includes(title);
    const st = await Otz.toggleCommentator(title, on);
    if (st) { state.mef.available = st.available || state.mef.available; state.mef.active = st.active || []; }
    else say('אין טאב גמרא פתוח — לחצו "פתח" שוב', 'error');
    render();
  }

  function renderMefDefaults() {
    $('#mef-defaults').innerHTML = MEFORSHIM.map((m) => `<label class="switch-row"><input type="checkbox" data-mef-default="${esc(m)}"${state.settings.meforshim.includes(m) ? ' checked' : ''}> ${esc(m)}</label>`).join('');
  }

  document.addEventListener('click', (ev) => {
    const el = ev.target.closest('button, tr');
    if (!el) return;
    const d = el.dataset;
    if (d.tab) { state.tab = d.tab; render(); content.scrollTop = 0; }
    else if (d.resourceSetup) setupResourceFolder();
    else if (d.resourceSync) syncCurrentResources();
    else if (d.resourceDate) syncPreviousDate();
    else if (d.toggle) toggle(d.toggle);
    else if (d.open) openIdx(parseInt(d.open, 10));
    else if (d.url) Otz.openUrl(d.url);
    else if (d.mefToggle) toggleMef(d.mefToggle);
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
    else if (t.dataset.mefDefault) {
      const name = t.dataset.mefDefault;
      const set = state.settings.meforshim.filter((m) => m !== name);
      if (t.checked) set.push(name);
      state.settings.meforshim = MEFORSHIM.filter((m) => set.includes(m));
      Otz.save('settings', state.settings);
      render();
    } else if (t.dataset.settingSelect) {
      state.settings[t.dataset.settingSelect] = parseInt(t.value, 10);
      Otz.save('settings', state.settings);
      render();
    } else if (t.dataset.setting) {
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
    document.querySelectorAll('[data-setting-select]').forEach((i) => { i.value = String(state.settings[i.dataset.settingSelect] ?? 1); });
    renderMefDefaults();
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
    await ResourceSync.initialize();
    resourceStatus = ResourceSync.snapshot();
    render();
    if (resourceStatus.configured) {
      ResourceSync.autoSync().then(() => {
        resourceStatus = ResourceSync.snapshot();
        if (state.tab === 'resources') render();
      }).catch(() => {});
    }
  });

  // If the plugin stays open, re-check newly published PDFs every six hours.
  setInterval(() => {
    if (!resourceStatus.configured) return;
    ResourceSync.autoSync().then(() => {
      resourceStatus = ResourceSync.snapshot();
      if (state.tab === 'resources') render();
    }).catch(() => {});
  }, 6 * 60 * 60 * 1000);

  window.addEventListener('online', () => {
    if (!resourceStatus.configured) return;
    ResourceSync.autoSync().then(() => {
      resourceStatus = ResourceSync.snapshot();
      if (state.tab === 'resources') render();
    }).catch(() => {});
  });
})();
