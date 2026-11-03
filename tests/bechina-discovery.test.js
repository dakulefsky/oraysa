const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../js/core.js');
const D = require('../js/bechina-discovery.js');

test('filename label heuristic matches known Oraysa sequences', () => {
  assert.equal(D.labelCandidates(35)[0], '4B');
  assert.equal(D.labelCandidates(100)[0], '11A');
  assert.equal(D.labelCandidates(105)[0], '11B');
  assert.ok(D.labelCandidates(21).includes('2B'));
});

test('builds the observed single-masechta hyphenated filename', () => {
  const bechina = {
    from: { masechet: 'יבמות', daf: 35, amud: 0 },
    to: { masechet: 'יבמות', daf: 39, amud: 1 }
  };
  const names = D.filenameCandidates(bechina, '4B', 'test');
  assert.ok(names.some((x) => x.path === 'Oraysa-bechina-Yevamos-4B-35-40.pdf'));
});

test('supports Oraysa underscore and English naming conventions', () => {
  const bechina = {
    from: { masechet: 'פסחים', daf: 42, amud: 0 },
    to: { masechet: 'פסחים', daf: 46, amud: 1 }
  };
  const names = D.filenameCandidates(bechina, '5A', 'test');
  assert.ok(names.some((x) => x.path === 'Oraysa_bechina_Pesachim_5A_42_47_English.pdf'));
});

test('supports a test spanning two masechtos', () => {
  const bechina = {
    from: { masechet: 'מגילה', daf: 28, amud: 0 },
    to: { masechet: 'תענית', daf: 1, amud: 1 }
  };
  const names = D.filenameCandidates(bechina, '3B', 'test');
  assert.ok(names.some((x) => x.path === 'Oraysa-bechina-Megilah-3B-28-Taanis-2.pdf'));
});

test('generates a separate official answer-sheet filename', () => {
  const bechina = {
    from: { masechet: 'מועד קטן', daf: 3, amud: 0 },
    to: { masechet: 'מועד קטן', daf: 7, amud: 1 }
  };
  const names = D.filenameCandidates(bechina, '1A', 'answers');
  assert.ok(names.some((x) => x.path === 'Oraysa-bechina-Moed-Katan-1A-3-8-Answers.pdf'));
});

test('every catalogued masechta has a filename slug', () => {
  for (const masechet of C.MASECHTOS) {
    assert.ok(D.SLUGS[masechet.name], `Missing slug for ${masechet.name}`);
  }
});
