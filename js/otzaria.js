// גשר לאוצריא: קריאות, ערכת נושא, אחסון ופתיחת עמוד גמרא בקורא.
// מחוץ לאוצריא (דפדפן רגיל) — אחסון ב-localStorage ופתיחת ספרים מושבתת.
(function () {
  'use strict';

  const HAS_OTZ = typeof window.Otzaria !== 'undefined';
  const PREFIX = 'oraysa-daily';

  async function call(method, params) {
    if (!HAS_OTZ) return { success: false, error: { code: 'dev', message: 'זמין רק בתוך אוצריא' } };
    try {
      return await window.Otzaria.call(method, params || {});
    } catch (e) {
      return { success: false, error: { code: 'exception', message: e.message } };
    }
  }
  const ok = (r) => !!(r && r.success && r.data !== false && r.data != null);

  async function load(key) {
    if (!HAS_OTZ) {
      try { const v = localStorage.getItem(`${PREFIX}:${key}`); return v ? JSON.parse(v) : null; } catch (e) { return null; }
    }
    const r = await call('storage.get', { key });
    return r && r.success ? r.data : null;
  }
  async function save(key, value) {
    if (!HAS_OTZ) {
      try { localStorage.setItem(`${PREFIX}:${key}`, JSON.stringify(value)); } catch (e) { /* אחסון חסום */ }
      return;
    }
    await call('storage.set', { key, value });
  }

  function applyTheme(theme) {
    if (!theme || !theme.colorScheme) return;
    const cs = theme.colorScheme;
    const root = document.documentElement;
    const map = {
      '--color-primary': cs.primary, '--color-on-primary': cs.onPrimary,
      '--color-secondary': cs.secondary, '--color-on-secondary': cs.onSecondary,
      '--color-secondary-container': cs.secondaryContainer, '--color-on-secondary-container': cs.onSecondaryContainer,
      '--color-tertiary': cs.tertiary,
      '--color-surface': cs.surface, '--color-on-surface': cs.onSurface, '--color-on-surface-variant': cs.onSurfaceVariant,
      '--color-surface-container': cs.surfaceContainer, '--color-surface-container-high': cs.surfaceContainerHigh,
      '--color-surface-container-highest': cs.surfaceContainerHighest,
      '--color-error': cs.error, '--color-on-error': cs.onError,
      '--color-outline': cs.outline, '--color-outline-variant': cs.outlineVariant,
      '--color-scrim': cs.scrim,
    };
    for (const [k, v] of Object.entries(map)) if (v) root.style.setProperty(k, v);
    document.body.classList.toggle('dark-mode', theme.mode === 'dark');
    const t = theme.typography;
    if (t) {
      if (t.uiFontFamily) root.style.setProperty('--font-ui', `'${t.uiFontFamily}', system-ui, sans-serif`);
      if (t.fontFamily) root.style.setProperty('--font-main', `'${t.fontFamily}', 'David', serif`);
    }
  }

  /** start(payload) נקרא פעם אחת: באוצריא ב-plugin.boot, ובדפדפן מיד. */
  function boot(start) {
    if (HAS_OTZ) {
      window.Otzaria.on('plugin.boot', (payload) => { applyTheme(payload && payload.theme); start(payload || {}); });
      window.Otzaria.on('theme.changed', applyTheme);
    } else {
      start({});
    }
  }

  // ── איתור מסכת בבבלי ──
  const C = window.OraysaCore;
  const bookCache = new Map();
  const tocCache = new Map();

  async function categoryOf(b) {
    if (b.categoryPath) return b.categoryPath;
    if (b.bookPath) return b.bookPath;
    const r = await call('library.getBookMetadata', b.bookUid ? { bookUid: b.bookUid } : { bookId: b.bookId });
    return (r && r.success && r.data && r.data.categoryPath) || '';
  }

  const isBavliPath = (p) => p.includes('בבלי') && !p.includes('ירושלמי') && !p.includes('מפרשים') && !p.includes('ראשונים') && !p.includes('אחרונים');

  /** ספר הטקסט של המסכת בתלמוד הבבלי (לא משנה/ירושלמי/מפרש). */
  async function resolveMasechet(name) {
    if (bookCache.has(name)) return bookCache.get(name);
    const m = C.findMasechet(name);
    const names = new Set([name, ...(m ? m.aliases : [])].map(C.normalize));
    const candidates = [];
    for (const q of names) {
      const r = await call('library.findBooks', { query: q, limit: 50 });
      for (const b of (r && r.success && r.data) || []) {
        if (names.has(C.normalize(b.title || b.bookId))) candidates.push(b);
      }
    }
    let found = null;
    const scored = [];
    for (const b of candidates) {
      const path = C.normalize(await categoryOf(b));
      const isText = !b.type || b.type === 'text';
      scored.push({ b, score: (isBavliPath(path) ? 2 : 0) + (isText ? 1 : 0) });
    }
    scored.sort((x, y) => y.score - x.score);
    if (scored.length && scored[0].score >= 2) found = scored[0].b;
    const ident = found ? (found.bookUid ? { bookUid: found.bookUid } : { bookId: found.bookId, type: found.type }) : null;
    if (ident) bookCache.set(name, ident);
    return ident;
  }

  function flattenToc(list, out) {
    out = out || [];
    for (const e of list || []) {
      out.push(e);
      if (e.children && e.children.length) flattenToc(e.children, out);
    }
    return out;
  }

  /** פותח את העמוד בקורא של אוצריא. */
  async function openAmud(a) {
    if (!HAS_OTZ) return { ok: false, message: 'פתיחת הגמרא זמינה רק בתוך אוצריא' };
    const ident = await resolveMasechet(a.masechet);
    if (!ident) return { ok: false, message: `מסכת ${a.masechet} (בבלי) לא נמצאה בספרייה` };
    const ref = C.tocRef(a);
    if (ok(await call('reader.openBookAtRef', Object.assign({}, ident, { ref, highlight: true })))) return { ok: true };
    const key = ident.bookUid || ident.bookId;
    if (!tocCache.has(key)) {
      const r = await call('library.getBookToc', ident);
      tocCache.set(key, r && r.success ? flattenToc(r.data) : []);
    }
    const target = C.normalize(ref);
    const entry = tocCache.get(key).find((e) => C.normalize(e.text) === target);
    if (entry && ok(await call('reader.openBook', Object.assign({}, ident, { index: entry.index })))) return { ok: true };
    if (ok(await call('reader.openBook', Object.assign({}, ident, { index: 0 })))) {
      return { ok: true, message: `לא נמצא ${ref} בתוכן העניינים — המסכת נפתחה בתחילתה` };
    }
    return { ok: false, message: `לא ניתן לפתוח את ${C.shortLabel(a)}` };
  }

  /** חגים ופרשה מאוצריא (null מחוץ לאוצריא או בכשל). */
  async function jewishDateInfo(iso) {
    const r = await call('calendar.getJewishDate', { date: iso });
    return r && r.success ? r.data : null;
  }

  async function notify(message, kind) {
    if (!HAS_OTZ) return false;
    const r = await call(kind === 'error' ? 'ui.showError' : 'ui.showSuccess', { message });
    return !!(r && r.success);
  }

  window.Otz = { HAS_OTZ, call, load, save, boot, openAmud, jewishDateInfo, notify };
})();
