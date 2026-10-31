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
