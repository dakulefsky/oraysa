global.window = global;
require('../js/resources.js');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parsePdfLinks } = global.OraysaResources;

test('finds official S3 PDFs in page anchors', () => {
  const html = '<a href="https://oraysa-media.s3.amazonaws.com/oraysa/Yevamos-120b-122b-Pisgamei-Oraysa-Marei-Mekomos.pdf">PDF</a>';
  const found = parsePdfLinks(html, 'https://www.oraysa.org/en');
  assert.equal(found.length, 1);
  assert.equal(found[0].filename, 'Yevamos-120b-122b-Pisgamei-Oraysa-Marei-Mekomos.pdf');
});

test('ignores non-Oraysa hosts and non-PDF media', () => {
  const html = '<a href="https://evil.example/file.pdf">bad</a><a href="https://www.oraysa.org/watch/shiur.mp3">audio</a>';
  assert.deepEqual(parsePdfLinks(html, 'https://www.oraysa.org/en'), []);
});

test('deduplicates links and accepts escaped S3 URLs', () => {
  const url = 'https:\\/\\/oraysa-media.s3.amazonaws.com\\/oraysa\\/sheet.pdf';
  const html = '<a href="' + url + '">one</a><a href="' + url + '">two</a>';
  assert.equal(parsePdfLinks(html, 'https://www.oraysa.org/en').length, 1);
});

const core = require('../js/core.js');
const { weeklyAmudim: getWeeklyAmudim } = global.OraysaResources;

test('uses the verified Yevamos assignment for the week of 2026-10-25', () => {
  const start = core.parseIso('2026-10-25');
  const amudim = getWeeklyAmudim(core, start);
  assert.deepEqual(amudim.map((a) => [a.masechet, a.daf, a.amud]), [
    ['יבמות', 120, 1], ['יבמות', 121, 0], ['יבמות', 121, 1],
    ['יבמות', 122, 0], ['יבמות', 122, 1]
  ]);
});

test('uses the verified Kiddushin assignment for the week of 2026-11-01', () => {
  const start = core.parseIso('2026-11-01');
  const amudim = getWeeklyAmudim(core, start);
  assert.deepEqual(amudim.map((a) => [a.masechet, a.daf, a.amud]), [
    ['קידושין', 2, 0], ['קידושין', 2, 1], ['קידושין', 3, 0],
    ['קידושין', 3, 1], ['קידושין', 4, 0]
  ]);
});

test('fails closed when a weekly Oraysa assignment has not been verified', () => {
  assert.equal(getWeeklyAmudim(core, core.parseIso('2026-11-08')), null);
});

test('accepts the exact official Yevamos 122b Marei Mekomos PDF', () => {
  const url = 'https://oraysa-media.s3.amazonaws.com/oraysa/Yevamos-122b-Pisgamei-Oraysa-Marei-Mekomos.pdf';
  const found = parsePdfLinks('<a href="' + url + '">קובץ מראי מקומות</a>', 'https://www.oraysa.org/en?amud=%3A%D7%A7%D7%9B%D7%91&masechta=1462');
  assert.equal(found.length, 1);
  assert.equal(found[0].url, url);
  assert.equal(found[0].filename, 'Yevamos-122b-Pisgamei-Oraysa-Marei-Mekomos.pdf');
});

test('manifest declares the resource sync network and folder access', () => {
  const manifest = require('../manifest.json');
  assert.ok(manifest.permissions.includes('fs.user_files.read'));
  assert.ok(manifest.permissions.includes('network.access'));
  assert.equal(manifest.network.enabled, true);
  assert.ok(manifest.network.allowlist.includes('https://www.oraysa.org'));
  assert.ok(manifest.network.allowlist.includes('https://oraysa-media.s3.amazonaws.com'));
});
