// לוח תוכנית "אורייתא — עמוד וחזרה": חישוב טהור, ללא תלות באוצריא או ב-DOM.
//
// כללי התוכנית (oraysa.org):
//   • ימים א׳–ה׳: עמוד חדש בכל יום + חזרה על עמוד אתמול.
//   • שישי: חזרה על שני העמודים הראשונים של השבוע (של א׳–ב׳).
//   • שבת: חזרה על שלושת העמודים האחרונים (של ג׳–ה׳).
//   • אין דילוג על חגים — הלוח רציף.
// עוגן: ברכות ב. ביום א׳ 5.1.2020. נבדק מול הלוחות הרשמיים (ר״ה ב. — 25.5.2023,
// יומא ב. — 28.8.2023, קידושין ב. — 1.11.2026, סיום קידושין — 14.6.2027).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.OraysaCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const DAY_MS = 86400000;

  // [שם, דף ראשון, עמוד ראשון (0=א,1=ב), דף אחרון, עמוד אחרון, שמות חלופיים]
  // הסדר הוא סדר הלימוד בתוכנית: אחרי יבמות — קידושין, ואז כתובות, ומשם ממשיכים
  // לפי סדר הש״ס (בלי קידושין שכבר נלמדה).
  const MASECHTOS = [
    ['ברכות', 2, 0, 64, 0],
    ['שבת', 2, 0, 157, 1],
    ['עירובין', 2, 0, 105, 0],
    ['פסחים', 2, 0, 121, 1],
    ['ראש השנה', 2, 0, 35, 0],
    ['יומא', 2, 0, 88, 0],
    ['סוכה', 2, 0, 56, 1],
    ['ביצה', 2, 0, 40, 1],
    ['תענית', 2, 0, 31, 0],
    ['מגילה', 2, 0, 32, 0],
    ['מועד קטן', 2, 0, 29, 0],
    ['חגיגה', 2, 0, 27, 0],
    ['יבמות', 2, 0, 122, 1],
    ['קידושין', 2, 0, 82, 1],
    ['כתובות', 2, 0, 112, 1],
    ['נדרים', 2, 0, 91, 1],
    ['נזיר', 2, 0, 66, 1],
    ['סוטה', 2, 0, 49, 1],
    ['גיטין', 2, 0, 90, 1],
    ['בבא קמא', 2, 0, 119, 1],
    ['בבא מציעא', 2, 0, 119, 0],
    ['בבא בתרא', 2, 0, 176, 1],
    ['סנהדרין', 2, 0, 113, 1],
    ['מכות', 2, 0, 24, 1],
    ['שבועות', 2, 0, 49, 1],
    ['עבודה זרה', 2, 0, 76, 1],
    ['הוריות', 2, 0, 14, 0],
    ['זבחים', 2, 0, 120, 1],
    ['מנחות', 2, 0, 110, 0],
    ['חולין', 2, 0, 142, 0],
    ['בכורות', 2, 0, 61, 0],
    ['ערכין', 2, 0, 34, 0],
    ['תמורה', 2, 0, 34, 0],
    ['כריתות', 2, 0, 28, 1],
    ['מעילה', 2, 0, 22, 0],
    ['קינים', 22, 1, 25, 0],
    ['תמיד', 25, 1, 33, 1],
    ['מדות', 34, 0, 37, 1, ['מידות']],
    ['נדה', 2, 0, 73, 0, ['נידה']],
  ].map(([name, fd, fa, ld, la, aliases], i) => ({
    index: i, name, firstDaf: fd, firstAmud: fa, lastDaf: ld, lastAmud: la,
    aliases: aliases || [],
    length: (ld * 2 + la) - (fd * 2 + fa) + 1,
  }));

  let acc = 0;
  for (const m of MASECHTOS) { m.startIdx = acc; acc += m.length; m.endIdx = acc - 1; }
  const TOTAL = acc;

  // עד סוף כתובות — לפי הלוחות וההודעות הרשמיות; אחריה — הערכה לפי סדר הש״ס.
  const CONFIRMED_THROUGH = MASECHTOS.find((m) => m.name === 'כתובות').endIdx;

  // ── ימים ────────────────────────────────────────────────
  // dn = מספר יום שלם מאז 1.1.1970 (ללא שעון/אזור זמן).
  const dayNum = (y, m, d) => Math.floor(Date.UTC(y, m - 1, d) / DAY_MS);
  const EPOCH = dayNum(2020, 1, 5); // יום א׳, ברכות ב.

  function fromDayNum(dn) {
    const dt = new Date(dn * DAY_MS);
    return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
  }
  const pad = (n) => String(n).padStart(2, '0');
  function isoOf(dn) { const { y, m, d } = fromDayNum(dn); return `${y}-${pad(m)}-${pad(d)}`; }
  function parseIso(s) {
    const mt = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || ''));
    return mt ? dayNum(+mt[1], +mt[2], +mt[3]) : null;
  }
  function todayDn(now) {
    const t = now || new Date();
    return dayNum(t.getFullYear(), t.getMonth() + 1, t.getDate());
  }
  /** 0 = יום א׳ ... 6 = שבת */
  const dowOf = (dn) => (((dn + 4) % 7) + 7) % 7;

  // ── עמודים ──────────────────────────────────────────────
  function amudAt(idx) {
    if (!Number.isInteger(idx) || idx < 0 || idx >= TOTAL) return null;
    let lo = 0, hi = MASECHTOS.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (MASECHTOS[mid].startIdx <= idx) lo = mid; else hi = mid - 1;
    }
    const m = MASECHTOS[lo];
    const abs = m.firstDaf * 2 + m.firstAmud + (idx - m.startIdx);
    return {
      idx, masechet: m.name, masechetIndex: m.index,
      daf: Math.floor(abs / 2), amud: abs % 2,
      pos: idx - m.startIdx + 1, of: m.length,
      projected: idx > CONFIRMED_THROUGH,
    };
  }

  function findMasechet(name) {
    const n = normalize(name);
    return MASECHTOS.find((m) => normalize(m.name) === n || m.aliases.some((a) => normalize(a) === n)) || null;
  }

  /** אינדקס העמוד בתוכנית, או -1 אם אינו קיים. */
  function indexOf(masechet, daf, amud) {
    const m = typeof masechet === 'object' ? masechet : findMasechet(masechet);
    if (!m) return -1;
    const abs = daf * 2 + amud;
    const first = m.firstDaf * 2 + m.firstAmud;
    if (abs < first || abs > m.lastDaf * 2 + m.lastAmud) return -1;
    return m.startIdx + (abs - first);
  }

  /** היום שבו לומדים את העמוד ה-idx (כעמוד חדש). */
  function dayOfIndex(idx) {
    return EPOCH + Math.floor(idx / 5) * 7 + (idx % 5);
  }

  /** אינדקס העמוד החדש של היום, או null (שישי/שבת/לפני התחלה/אחרי סיום). */
  function learningIndexOn(dn) {
    if (dn < EPOCH) return null;
    const days = dn - EPOCH;
    const r = days % 7;
    if (r > 4) return null;
    const idx = Math.floor(days / 7) * 5 + r;
    return idx < TOTAL ? idx : null;
  }

  /** אינדקס העמוד של יום א׳ בשבוע של dn (גם כשהיום שישי/שבת). */
  function weekStartIndex(dn) {
    return Math.floor((dn - EPOCH) / 7) * 5;
  }

  const range = (a, b) => { const out = []; for (let i = a; i <= b; i++) { const x = amudAt(i); if (x) out.push(x); } return out; };

  /**
   * תכנית הלימוד ליום.
   * opts: { review30, review90, shabbos2w } — חזרות רשות כמו ב"לוח האישי" של אורייתא.
   */
  function dayPlan(dn, opts) {
    const o = opts || {};
    const dow = dowOf(dn);
    const plan = { dn, dow, kind: null, learn: null, review: null, weekly: [], extras: [] };
    if (dn < EPOCH) { plan.kind = 'before'; return plan; }
    const w0 = weekStartIndex(dn);
    if (w0 >= TOTAL) { plan.kind = 'after'; return plan; }

    if (dow <= 4) {
      plan.kind = 'learn';
      plan.learn = amudAt(w0 + dow);
      plan.review = amudAt(w0 + dow - 1);
      if (!plan.learn) plan.kind = 'after';
    } else if (dow === 5) {
      plan.kind = 'friday';
      plan.weekly = range(w0, w0 + 1);
    } else {
      plan.kind = 'shabbos';
      plan.weekly = range(w0 + 2, w0 + 4);
    }

    const back = (days, type) => {
      const i = learningIndexOn(dn - days);
      const a = i == null ? null : amudAt(i);
      if (a) plan.extras.push({ type, amud: a });
    };
    if (o.review30) back(30, 'r30');
    if (o.review90) back(90, 'r90');
    if (o.shabbos2w && dow === 6) {
      for (const a of range(Math.max(0, w0 - 5), w0 + 4)) plan.extras.push({ type: 's2w', amud: a });
    }
    return plan;
  }

  function masechetSpan(m) {
    return { startDn: dayOfIndex(m.startIdx), endDn: dayOfIndex(m.endIdx), projected: m.endIdx > CONFIRMED_THROUGH };
  }

  // ── עברית ───────────────────────────────────────────────
  const ONES = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];
  const TENS = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ'];
  const HUNDREDS = ['', 'ק', 'ר', 'ש', 'ת', 'תק', 'תר', 'תש', 'תת', 'תתק'];

  /** מספר בגימטריה (1–999). gershayim=true מוסיף ״ / ׳. */
  function hebNum(n, gershayim) {
    n = Math.floor(n) % 1000;
    if (n <= 0) return '';
    let s = HUNDREDS[Math.floor(n / 100)];
    const rest = n % 100;
    if (rest === 15) s += 'טו';
    else if (rest === 16) s += 'טז';
    else s += TENS[Math.floor(rest / 10)] + ONES[rest % 10];
    if (!gershayim) return s;
    return s.length === 1 ? s + '׳' : s.slice(0, -1) + '״' + s.slice(-1);
  }

  const amudMark = (amud) => (amud ? ':' : '.');
  /** "קידושין ב." */
  const shortLabel = (a) => `${a.masechet} ${hebNum(a.daf)}${amudMark(a.amud)}`;
  /** "קידושין דף ב׳ ע״א" */
  const longLabel = (a) => `${a.masechet} דף ${hebNum(a.daf, true)} ${a.amud ? 'ע״ב' : 'ע״א'}`;
  /** "ב." — לתא בלוח */
  const dafMark = (a) => `${hebNum(a.daf)}${amudMark(a.amud)}`;
  /** ההפניה שהקורא של אוצריא מזהה בתוכן העניינים של הבבלי ("דף ב." / "דף סד:"). */
  const tocRef = (a) => `דף ${hebNum(a.daf)}${amudMark(a.amud)}`;


  // ── משאבי אתר אורייתא ──
  // מזהי המסכתות באתר oraysa.org (פרמטר masechta) ובאתר הבחינות moodle.oraysa.org.
  const SITE_BOOK_IDS = {
    'ברכות': 2, 'שבת': 127, 'עירובין': 439, 'פסחים': 646, 'ראש השנה': 809, 'יומא': 876,
    'סוכה': 1049, 'ביצה': 1159, 'תענית': 1236, 'מגילה': 1295, 'מועד קטן': 1356, 'חגיגה': 1411,
    'יבמות': 1462, 'קידושין': 2510,
  };
  const MOODLE_COURSE_IDS = {
    'ברכות': 2, 'שבת': 3, 'עירובין': 4, 'פסחים': 5, 'ראש השנה': 8, 'יומא': 16, 'סוכה': 17,
    'ביצה': 19, 'תענית': 22, 'מגילה': 20, 'מועד קטן': 24, 'חגיגה': 26, 'יבמות': 27,
  };
  const SITE = 'https://www.oraysa.org';
  const SITE_BECHINOS = `${SITE}/en/lecturers/${encodeURIComponent('מבחני-אורייתא')}`;
  const MOODLE = 'https://moodle.oraysa.org';

  /** דף העמוד באתר אורייתא: מראי מקומות, סיכומים, צורת הדף, חידודים ושיעורים. */
  function siteUrl(a) {
    const id = a && SITE_BOOK_IDS[a.masechet];
    if (!id) return `${SITE}/en`;
    return `${SITE}/en?masechta=${id}&amud=${encodeURIComponent(amudMark(a.amud) + hebNum(a.daf))}`;
  }
  /** קורס הבחינות המקוונות של המסכת (או דף הבית של אתר הבחינות). */
  function moodleUrl(name) {
    const id = MOODLE_COURSE_IDS[name];
    return id ? `${MOODLE}/course/view.php?id=${id}` : `${MOODLE}/`;
  }
  const hasSiteResources = (a) => !!(a && SITE_BOOK_IDS[a.masechet]);

  /**
   * הבחינה הדו-שבועית: ביום ראשון, על 5 הדפים (10 עמודים) של השבועיים שקדמו לו.
   * parity (0/1) קובע באילו ימי ראשון חלה הבחינה (לפי מספר השבוע מתחילת התוכנית).
   */
  function isBechinaDay(dn, parity) {
    if (dn < EPOCH || dowOf(dn) !== 0) return false;
    const week = Math.floor((dn - EPOCH) / 7);
    return week >= 2 && week % 2 === (parity ? 1 : 0);
  }
  function bechinaFor(dn) {
    const end = weekStartIndex(dn) - 1;
    const start = Math.max(0, end - 9);
    if (end < 0) return null;
    return { dn, from: amudAt(start), to: amudAt(Math.min(end, TOTAL - 1)), amudim: range(start, Math.min(end, TOTAL - 1)) };
  }
  function nextBechinaDays(fromDn, parity, count) {
    const out = [];
    let dn = fromDn + ((7 - dowOf(fromDn)) % 7);
    for (let guard = 0; out.length < count && guard < 60; guard++, dn += 7) {
      if (isBechinaDay(dn, parity)) out.push(dn);
    }
    return out;
  }

  const DAY_NAMES = ['יום ראשון', 'יום שני', 'יום שלישי', 'יום רביעי', 'יום חמישי', 'יום שישי', 'שבת קודש'];
  const DAY_LETTERS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
  const GREG_MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];

  let hebFmt = null;
  /** תאריך עברי מקומי (Intl), בלי תלות באוצריא. */
  function hebrewDate(dn) {
    try {
      hebFmt = hebFmt || new Intl.DateTimeFormat('he-u-ca-hebrew', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' });
      const parts = {};
      for (const p of hebFmt.formatToParts(new Date(dn * DAY_MS))) parts[p.type] = p.value;
      const day = parseInt(parts.day, 10);
      const year = parseInt(parts.year, 10);
      const month = parts.month || '';
      return {
        day, month, year,
        dayText: hebNum(day, true),
        text: `${hebNum(day, true)} ${month} ${hebNum(year % 1000, true)}`,
      };
    } catch (e) {
      return null;
    }
  }

  function gregText(dn) { const { y, m, d } = fromDayNum(dn); return `${d}.${m}.${y}`; }

  function normalize(s) {
    return String(s || '').replace(/["״'׳]/g, '').replace(/\s+/g, ' ').trim();
  }

  return {
    MASECHTOS, TOTAL, CONFIRMED_THROUGH, EPOCH,
    dayNum, fromDayNum, isoOf, parseIso, todayDn, dowOf,
    amudAt, findMasechet, indexOf, dayOfIndex, learningIndexOn, weekStartIndex, dayPlan, masechetSpan,
    hebNum, shortLabel, longLabel, dafMark, tocRef, hebrewDate, gregText, normalize,
    DAY_NAMES, DAY_LETTERS, GREG_MONTHS,
    siteUrl, moodleUrl, hasSiteResources, isBechinaDay, bechinaFor, nextBechinaDays, SITE, SITE_BECHINOS, MOODLE,
  };
});
