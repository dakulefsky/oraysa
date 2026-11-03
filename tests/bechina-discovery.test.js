const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../js/core.js');
const D = require('../js/bechina-discovery.js');

test('predicts observed Oraysa sequence labels', () => {
  assert.deepEqual(D.labelCandidates(3), ['1A']);
  assert.deepEqual(D.labelCandidates(28), ['3B']);
  assert.deepEqual(D.labelCandidates(35), ['4B']);
  assert.deepEqual(D.labelCandidates(42), ['5A']);
});

test('builds the observed single-masechta Yevamos filename', () => {
  const bechina = {
    segments: [{ masechet: 'יבמות', startDaf: 35, endDaf: 40 }]
  };
  const names = D.filenameCandidates(bechina, '4B', 'test');
  assert.ok(names.some((x) => x.path === 'Oraysa-bechina-Yevamos-4B-35-40.pdf'));
});

test('supports the observed underscore and English naming convention', () => {
  const bechina = {
    segments: [{ masechet: 'פסחים', startDaf: 42, endDaf: 47 }]
  };
  const names = D.filenameCandidates(bechina, '5A', 'test');
  assert.ok(names.some((x) => x.path === 'Oraysa_bechina_Pesachim_5A_42_47_English.pdf'));
});

test('builds the observed cross-masechta naming convention', () => {
  const bechina = {
    segments: [
      { masechet: 'חגיגה', startDaf: 26, endDaf: 27 },
      { masechet: 'יבמות', startDaf: 2, endDaf: 5 }
    ]
  };
  const names = D.filenameCandidates(bechina, '1A', 'test');
  assert.ok(names.some((x) =>
    x.path === 'Oraysa-bechina-Yevamos-1A-Chagiga-26-27-Yevamos-2-5.pdf'
  ));
  assert.ok(names.some((x) =>
    x.path === 'Oraysa-bechina-Yevamos-1A-Chagiga-26-27-Yevamos-2-5-English.pdf'
  ));
  assert.ok(names.some((x) =>
    x.path === 'Oraysa_bechina_Yevamos_1A_Chagiga_26_27_Yevamos_2_5_English.pdf'
  ));
});

test('retains the earlier compact cross-masechta filename variant', () => {
  const bechina = {
    segments: [
      { masechet: 'מגילה', startDaf: 28, endDaf: 28 },
      { masechet: 'תענית', startDaf: 2, endDaf: 2 }
    ]
  };
  const names = D.filenameCandidates(bechina, '3B', 'test');
  assert.ok(names.some((x) =>
    x.path === 'Oraysa-bechina-Megilah-3B-28-Taanis-2.pdf'
  ));
});

test('generates a separate official answer-sheet filename', () => {
  const bechina = {
    segments: [{ masechet: 'מועד קטן', startDaf: 3, endDaf: 8 }]
  };
  const names = D.filenameCandidates(bechina, '1A', 'answers');
  assert.ok(names.some((x) => x.path === 'Oraysa-bechina-Moed-Katan-1A-3-8-Answers.pdf'));
});

test('rejects invalid or unknown segments instead of guessing a URL', () => {
  assert.deepEqual(D.filenameCandidates({ segments: [{ masechet: 'מסכת לא ידועה', startDaf: 2, endDaf: 6 }] }, '1A'), []);
  assert.deepEqual(D.filenameCandidates({ segments: [{ masechet: 'יבמות', startDaf: 6, endDaf: 2 }] }, '1A'), []);
});
