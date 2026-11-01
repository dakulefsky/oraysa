/* Official Oraysa PDF synchronization for Otzaria.
 * Only PDFs linked from Oraysa daf pages and the known Oraysa S3 media host
 * are accepted. No generated learning content and no audio/video downloads.
 */
(function (root) {
  'use strict';
  const ALLOWED_HOSTS = new Set(['www.oraysa.org', 'oraysa-media.s3.amazonaws.com']);
  const STORAGE_KEY = 'resourceSync.v1';

  function safeName(value) {
    return String(value || 'Oraysa-resource.pdf')
      .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-').replace(/\s+/g, ' ')
      .replace(/[. ]+$/g, '').slice(0, 150) || 'Oraysa-resource.pdf';
  }
  function safeDecode(value) {
    try { return decodeURIComponent(value); } catch (_) { return value; }
  }
  function htmlDecode(value) {
    return String(value || '').replace(/&amp;/gi, '&').replace(/&#x2f;/gi, '/')
      .replace(/&#47;/g, '/').replace(/&quot;/gi, '"').replace(/&#39;/gi, "'")
      .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>');
  }
  function parsePdfLinks(html, pageUrl) {
    const source = String(html || '').replace(/\\u0026/g, '&').replace(/\\\//g, '/')
      .replace(/\\u003a/gi, ':').replace(/\\u002f/gi, '/');
    const candidates = new Set();
    const patterns = [
      /(?:href|src|fileUrl|downloadUrl|url)\s*[:=]\s*["']([^"'<>]+\.pdf(?:\?[^"'<>]*)?)["']/gi,
      /https?:\/\/[^"'<>\s]+?\.pdf(?:\?[^"'<>\s]*)?/gi,
      /["'](\/[^"'<>\s]+?\.pdf(?:\?[^"'<>\s]*)?)["']/gi
    ];
    for (const re of patterns) {
      let match;
      while ((match = re.exec(source))) candidates.add(htmlDecode(match[1] || match[0]));
    }
    const found = new Map();
    for (const raw of candidates) {
      try {
        const url = new URL(raw, pageUrl);
        if (url.protocol !== 'https:' || !ALLOWED_HOSTS.has(url.hostname.toLowerCase())) continue;
        if (!/\.pdf$/i.test(url.pathname)) continue;
        url.hash = '';
        const href = url.toString();
        if (!found.has(href)) found.set(href, { url: href, filename: safeName(safeDecode(url.pathname.split('/').pop() || 'Oraysa-resource.pdf')) });
      } catch (_) { /* ignore malformed or non-URL candidates */ }
    }
    return Array.from(found.values());
  }
  function weekStart(core, dn) { return dn - core.dowOf(dn); }

  // Verified Oraysa assignments. The first week is the final Yevamos week
  // (120b-122b); the next week begins Kiddushin 2a on 2026-11-01, as recorded
  // in the checked Oraysa calendar anchors in core.js. Fail closed otherwise.
  const VERIFIED_WEEKLY_ASSIGNMENTS = {
    '2026-10-25': { masechet: 'יבמות', firstDaf: 120, firstAmud: 1, count: 5 },
    '2026-11-01': { masechet: 'קידושין', firstDaf: 2, firstAmud: 0, count: 5 }
  };
  function weeklyAmudim(core, weekStartDn) {
    const key = core.isoOf(weekStartDn);
    const assignment = VERIFIED_WEEKLY_ASSIGNMENTS[key];
    if (!assignment) return null;
    const first = core.indexOf(assignment.masechet, assignment.firstDaf, assignment.firstAmud);
    if (first < 0) return null;
    const amudim = [];
    for (let i = 0; i < assignment.count; i++) {
      const amud = core.amudAt(first + i);
      if (!amud || amud.masechet !== assignment.masechet) return null;
      amudim.push(amud);
    }
    return amudim;
  }
  function weekLabel(core, dn) {
    const d = core.fromDayNum(dn), week = Math.floor((dn - core.EPOCH) / 7) + 1;
    return String(d.y) + '-week-' + String(week).padStart(3, '0');
  }
  function amudSlug(core, amud) {
    return (amud.masechet + '-' + amud.daf + (amud.amud ? 'b' : 'a')).replace(/[^a-z0-9א-ת-]/gi, '-');
  }
  function create(api) {
    const core = api.core, call = api.call, load = api.load, save = api.save;
    let state = { folder: null, downloaded: {}, lastSync: null, lastMessage: '' };
    let busy = false;
    async function persist() { await save(STORAGE_KEY, state); }
    async function initialize() {
      const saved = await load(STORAGE_KEY);
      if (saved && typeof saved === 'object') {
        state = Object.assign(state, saved);
        if (!state.downloaded || typeof state.downloaded !== 'object') state.downloaded = {};
      }
      return snapshot();
    }
    function snapshot() {
      return { folderName: state.folder && state.folder.name || '',
        configured: !!(state.folder && state.folder.folderToken && state.folder.path),
        lastSync: state.lastSync, lastMessage: state.lastMessage,
        downloadedCount: Object.keys(state.downloaded).length, busy: busy };
    }
    async function chooseFolder() {
      const r = await call('fs.pickUserFolder', { title: 'תיקיית חומרי אורייתא' });
      if (!r || !r.success || !r.data || r.data.cancelled) return { ok: false, cancelled: true };
      const d = r.data;
      if (!d.folderToken || !d.path) return { ok: false, message: 'אוצריא לא החזירה תיקייה מאושרת.' };
      state.folder = { folderToken: d.folderToken, path: d.path, name: d.name || 'Oraysa' };
      await persist();
      return { ok: true, state: snapshot() };
    }
    async function online() {
      const r = await call('app.getConnectivity', { forceRefresh: true });
      return !!(r && r.success && r.data && r.data.isOnline);
    }
    async function fetchPage(url) {
      const stream = await call('network.fetchStream', { url: url, method: 'GET', timeoutMs: 60000 });
      if (!stream || typeof stream[Symbol.asyncIterator] !== 'function') throw new Error('לא ניתן לקרוא את דף המשאבים מאתר אורייתא.');
      let status = 0, body = '';
      for await (const part of stream) {
        if (part.type === 'response') {
          status = part.status;
          if (!part.ok) throw new Error('Oraysa returned HTTP ' + status);
        } else if (part.type === 'data') {
          body += part.body || '';
          if (body.length > 12 * 1024 * 1024) throw new Error('דף המשאבים גדול מהצפוי.');
        }
      }
      if (status && (status < 200 || status >= 300)) throw new Error('Oraysa returned HTTP ' + status);
      return body;
    }
    async function discover(amud) {
      if (!core.hasSiteResources(amud)) return { amud: amud, resources: [], unavailable: true, message: 'מזהה המסכת באתר אורייתא עדיין לא מוגדר בתוסף.' };
      const pageUrl = core.siteUrl(amud);
      const html = await fetchPage(pageUrl);
      return { amud: amud, resources: parsePdfLinks(html, pageUrl), unavailable: false };
    }
    function destination(amud, resource, archiveDate) {
      const rootPath = state.folder.path.replace(/[\\/]+$/g, '');
      const section = archiveDate ? 'Archive/' + archiveDate : 'Current/' + weekLabel(core, weekStart(core, core.todayDn()));
      return rootPath + '/Oraysa/' + section + '/' + safeName(amudSlug(core, amud) + '__' + resource.filename);
    }
    async function remoteMetadata(url) {
      try {
        const stream = await call('network.fetchStream', { url: url, method: 'HEAD', timeoutMs: 20000 });
        if (!stream || typeof stream[Symbol.asyncIterator] !== 'function') return null;
        for await (const part of stream) {
          if (part.type === 'response') {
            if (!part.ok) return null;
            const h = part.headers || {};
            return {
              etag: h.etag || h.ETag || '',
              modified: h['last-modified'] || h['Last-Modified'] || '',
              size: h['content-length'] || h['Content-Length'] || ''
            };
          }
        }
      } catch (_) { /* HEAD is an optimization; never delete a saved file on failure. */ }
      return null;
    }
    async function download(amud, resource, archiveDate) {
      const previous = state.downloaded[resource.url];
      let metadata = null;
      if (previous) {
        metadata = await remoteMetadata(resource.url);
        if (!metadata || (!metadata.etag && !metadata.modified && !metadata.size)) return { skipped: true };
        if (metadata.etag === (previous.etag || '') &&
            metadata.modified === (previous.modified || '') &&
            metadata.size === (previous.size || '')) return { skipped: true };
      } else {
        metadata = await remoteMetadata(resource.url);
      }
      const destPath = previous && previous.path || destination(amud, resource, archiveDate);
      const r = await call('network.download', {
        url: resource.url, filename: safeName(resource.filename), destPath: destPath,
        resume: !previous
      });
      if (!r || !r.success) throw new Error(r && r.error && (r.error.message || r.error.code) || 'ההורדה נכשלה.');
      state.downloaded[resource.url] = {
        filename: resource.filename, path: destPath, downloadedAt: new Date().toISOString(),
        amud: core.shortLabel(amud), etag: metadata && metadata.etag || '',
        modified: metadata && metadata.modified || '', size: metadata && metadata.size || ''
      };
      await persist();
      return { downloaded: true, updated: !!previous };
    }
    async function syncAmud(amud, archiveDate) {
      const result = await discover(amud);
      if (result.unavailable) return Object.assign(result, { downloaded: 0, skipped: 0 });
      let downloaded = 0, skipped = 0;
      for (const resource of result.resources) {
        const outcome = await download(amud, resource, archiveDate);
        if (outcome.downloaded) downloaded++; else skipped++;
      }
      return Object.assign(result, { downloaded: downloaded, skipped: skipped });
    }
    async function syncWeek() {
      if (busy) return { ok: false, message: 'הסנכרון כבר פועל.' };
      if (!state.folder) return { ok: false, needsFolder: true, message: 'בחרו תיקייה לשמירת חומרי אורייתא.' };
      busy = true;
      try {
        if (!(await online())) throw new Error('אין כרגע חיבור לאינטרנט.');
        const today = core.todayDn(), start = weekStart(core, today);
        const scheduledAmudim = weeklyAmudim(core, start);
        if (!scheduledAmudim) {
          return { ok: false, scheduleUnverified: true,
            message: 'לוח אורייתא לשבוע זה עדיין לא אומת. לא הורדו קבצים כדי למנוע הורדת חומר למסכת או לעמודים שגויים.' };
        }
        const results = [];
        for (const amud of scheduledAmudim) {
          try { results.push(await syncAmud(amud, null)); }
          catch (e) { results.push({ amud: amud, error: e.message, resources: [], downloaded: 0, skipped: 0 }); }
        }
        const total = results.reduce((n, r) => n + (r.downloaded || 0), 0);
        const errors = results.filter((r) => r.error).length;
        const empty = results.filter((r) => !r.error && !r.unavailable && !r.resources.length).length;
        state.lastSync = new Date().toISOString();
        state.lastMessage = total + ' קבצים חדשים · ' + errors + ' שגיאות · ' + empty + ' עמודים שטרם פורסמו בהם קבצים';
        await persist();
        return { ok: true, results: results, state: snapshot(), weekStart: core.isoOf(start) };
      } finally { busy = false; }
    }
    async function syncDate(isoDate) {
      if (busy) return { ok: false, message: 'הסנכרון כבר פועל.' };
      if (!state.folder) return { ok: false, needsFolder: true, message: 'בחרו תיקייה לשמירת חומרי אורייתא.' };
      const dn = core.parseIso(isoDate);
      if (dn == null || dn >= core.todayDn()) return { ok: false, message: 'בחרו יום לימוד קודם.' };
      const plan = core.dayPlan(dn);
      let amudim = [];
      if (plan.kind === 'learn') amudim = [plan.review, plan.learn].filter(Boolean);
      else if (plan.kind === 'friday' || plan.kind === 'shabbos') amudim = plan.weekly || [];
      if (!amudim.length) return { ok: false, message: 'לא נמצאו עמודי לימוד לתאריך הזה.' };
      busy = true;
      try {
        if (!(await online())) throw new Error('אין כרגע חיבור לאינטרנט.');
        const results = [];
        for (const amud of amudim) {
          try { results.push(await syncAmud(amud, isoDate)); }
          catch (e) { results.push({ amud: amud, error: e.message, resources: [], downloaded: 0, skipped: 0 }); }
        }
        const total = results.reduce((n, r) => n + (r.downloaded || 0), 0);
        state.lastMessage = total + ' קבצים חדשים נשמרו עבור ' + core.DAY_NAMES[plan.dow] + '.';
        await persist();
        return { ok: true, results: results, downloaded: total, state: snapshot() };
      } finally { busy = false; }
    }
    async function autoSync() {
      if (!state.folder || busy) return { skipped: true };
      return syncWeek();
    }
    return { initialize: initialize, snapshot: snapshot, chooseFolder: chooseFolder,
      syncWeek: syncWeek, syncDate: syncDate, autoSync: autoSync };
  }
  root.OraysaResources = { create: create, parsePdfLinks: parsePdfLinks, weeklyAmudim: weeklyAmudim };
})(window);
