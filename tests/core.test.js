const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../js/core.js');

const plan = (y, m, d, o) => C.dayPlan(C.dayNum(y, m, d), o);
const learnOn = (y, m, d) => C.shortLabel(plan(y, m, d).learn);

test('epoch is Sunday, Berachos 2a', () => {
  assert.equal(C.dowOf(C.EPOCH), 0);
  assert.equal(learnOn(2020, 1, 5), 'ברכות ב.');
});

test('matches the official Rosh Hashana calendar (Sivan–Elul 5783)', () => {
  assert.equal(learnOn(2023, 5, 21), 'פסחים קכ.');
  assert.equal(learnOn(2023, 5, 24), 'פסחים קכא:');
  assert.equal(learnOn(2023, 5, 25), 'ראש השנה ב.');
  assert.equal(C.shortLabel(plan(2023, 5, 25).review), 'פסחים קכא:');
  assert.deepEqual(plan(2023, 5, 26).weekly.map(C.shortLabel), ['פסחים קכ.', 'פסחים קכ:']);
  assert.deepEqual(plan(2023, 5, 27).weekly.map(C.shortLabel), ['פסחים קכא.', 'פסחים קכא:', 'ראש השנה ב.']);
  assert.equal(learnOn(2023, 8, 13), 'ראש השנה ל.');
  assert.deepEqual(plan(2023, 8, 18).weekly.map(C.dafMark), ['ל.', 'ל:']);
  assert.deepEqual(plan(2023, 8, 19).weekly.map(C.dafMark), ['לא.', 'לא:', 'לב.']);
  assert.equal(learnOn(2023, 8, 28), 'יומא ב.');
  assert.equal(C.shortLabel(plan(2023, 8, 28).review), 'ראש השנה לה.');
});

test('no skipping for Tisha B\'Av or Yom Tov', () => {
  assert.equal(learnOn(2023, 7, 27), 'ראש השנה כד:');
});

test('Sukkah starts on Chol Hamoed Pesach 5784', () => {
  assert.equal(learnOn(2024, 4, 25), 'סוכה ב.');
});

test('matches the official Kiddushin calendar (Cheshvan–Sivan 5787)', () => {
  assert.equal(learnOn(2026, 10, 29), 'יבמות קכב:');
  assert.equal(learnOn(2026, 11, 1), 'קידושין ב.');
  assert.equal(C.shortLabel(plan(2026, 11, 1).review), 'יבמות קכב:');
  assert.equal(learnOn(2026, 11, 15), 'קידושין ז.');
  assert.deepEqual(plan(2026, 11, 20).weekly.map(C.dafMark), ['ז.', 'ז:']);
  assert.deepEqual(plan(2026, 11, 21).weekly.map(C.dafMark), ['ח.', 'ח:', 'ט.']);
  assert.equal(learnOn(2027, 6, 14), 'קידושין פב:');
  assert.equal(learnOn(2027, 6, 15), 'כתובות ב.');
});

test('round trip index <-> date', () => {
  for (let i = 0; i < C.TOTAL; i += 37) {
    const a = C.amudAt(i);
    assert.equal(C.indexOf(a.masechet, a.daf, a.amud), i);
    assert.equal(C.learningIndexOn(C.dayOfIndex(i)), i);
  }
  assert.equal(C.amudAt(C.TOTAL), null);
  assert.equal(C.indexOf('קינים', 22, 0), -1);
  assert.equal(C.indexOf('מידות', 34, 0), C.findMasechet('מדות').startIdx);
});

test('masechta lengths', () => {
  const len = (n) => C.findMasechet(n).length;
  assert.equal(len('ברכות'), 125);
  assert.equal(len('ביצה'), 78);
  assert.equal(len('קידושין'), 162);
  assert.equal(len('בבא מציעא'), 235);
});

test('optional reviews', () => {
  const p = plan(2026, 12, 1, { review30: true, review90: true });
  assert.deepEqual(p.extras.map((e) => [e.type, C.shortLabel(e.amud)]), [
    ['r30', 'קידושין ב.'],
    ['r90', C.shortLabel(C.amudAt(C.learningIndexOn(C.dayNum(2026, 9, 2))))],
  ]);
  const s = plan(2026, 11, 21, { shabbos2w: true });
  assert.deepEqual(s.extras.map((e) => C.dafMark(e.amud)), ['ד:', 'ה.', 'ה:', 'ו.', 'ו:', 'ז.', 'ז:', 'ח.', 'ח:', 'ט.']);
  assert.equal(plan(2026, 11, 20, { shabbos2w: true }).extras.length, 0);
});

test('hebrew numerals and refs', () => {
  assert.equal(C.hebNum(15), 'טו');
  assert.equal(C.hebNum(16, true), 'ט״ז');
  assert.equal(C.hebNum(2, true), 'ב׳');
  assert.equal(C.hebNum(121, true), 'קכ״א');
  assert.equal(C.hebNum(787, true), 'תשפ״ז');
  assert.equal(C.tocRef(C.amudAt(C.indexOf('ברכות', 64, 0))), 'דף סד.');
  assert.equal(C.longLabel(C.amudAt(C.indexOf('שבת', 15, 1))), 'שבת דף ט״ו ע״ב');
});

test('hebrew date via Intl', () => {
  const h = C.hebrewDate(C.dayNum(2026, 11, 1));
  assert.equal(h.day, 21);
  assert.equal(h.year, 5787);
  assert.match(h.text, /^כ״א .*חשוון תשפ״ז$/);
});

test('projection flag', () => {
  assert.equal(C.amudAt(C.findMasechet('כתובות').endIdx).projected, false);
  assert.equal(C.amudAt(C.findMasechet('נדרים').startIdx).projected, true);
});

test('oraysa.org resource links', () => {
  const a = C.amudAt(C.indexOf(C.findMasechet('יבמות'), 122, 1));
  assert.equal(C.siteUrl(a), `https://www.oraysa.org/en?masechta=1462&amud=${encodeURIComponent(':קכב')}`);
  const b = C.amudAt(C.indexOf(C.findMasechet('יבמות'), 10, 0));
  assert.equal(decodeURIComponent(C.siteUrl(b).split('amud=')[1]), '.י');
  assert.equal(C.hasSiteResources(C.amudAt(C.findMasechet('נדרים').startIdx)), false);
  assert.equal(C.siteUrl(C.amudAt(C.findMasechet('נדרים').startIdx)), 'https://www.oraysa.org/en');
  assert.equal(C.moodleUrl('יבמות'), 'https://moodle.oraysa.org/course/view.php?id=27');
});

test('bi-weekly bechina covers the previous two weeks (official Pesachim #4A, 2.10.2022)', () => {
  const dn = C.dayNum(2022, 10, 2);
  assert.equal(C.isBechinaDay(dn, 1), true);
  assert.equal(C.isBechinaDay(dn + 7, 1), false);
  assert.equal(C.isBechinaDay(dn, 0), false);
  const b = C.bechinaFor(dn);
  assert.equal(C.shortLabel(b.from), 'פסחים לב:');
  assert.equal(C.shortLabel(b.to), 'פסחים לז.');
  assert.equal(b.amudim.length, 10);
  assert.deepEqual(C.nextBechinaDays(dn - 3, 1, 2), [dn, dn + 14]);
});
