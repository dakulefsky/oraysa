(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.OraysaBechinaDiscovery = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Official filename spellings observed in Oraysa's public S3 documents.
  const SLUGS = {
    'ברכות': 'Berachos', 'שבת': 'Shabbos', 'עירובין': 'Eruvin',
    'פסחים': 'Pesachim', 'ראש השנה': 'Rosh-Hashanah', 'יומא': 'Yoma',
    'סוכה': 'Sukkah', 'ביצה': 'Beitzah', 'תענית': 'Taanis',
    'מגילה': 'Megilah', 'מועד קטן': 'Moed-Katan', 'חגיגה': 'Chagiga',
    'יבמות': 'Yevamos', 'קידושין': 'Kiddushin', 'כתובות': 'Kesubos',
    'נדרים': 'Nedarim', 'נזיר': 'Nazir', 'סוטה': 'Sotah',
    'גיטין': 'Gittin', 'בבא קמא': 'Bava-Kamma', 'בבא מציעא': 'Bava-Metzia',
    'בבא בתרא': 'Bava-Basra', 'סנהדרין': 'Sanhedrin', 'מכות': 'Makkos',
    'שבועות': 'Shevuos', 'עבודה זרה': 'Avodah-Zarah', 'הוריות': 'Horayos',
    'זבחים': 'Zevachim', 'מנחות': 'Menachos', 'חולין': 'Chullin',
    'בכורות': 'Bechoros', 'ערכין': 'Arachin', 'תמורה': 'Temurah',
    'כריתות': 'Kerisos', 'מעילה': 'Meilah', 'קינים': 'Kinnim',
    'תמיד': 'Tamid', 'מדות': 'Middos', 'נדה': 'Niddah'
  };

  function labelCandidates(startDaf) {
    const daf = Math.max(2, Number(startDaf) || 2);
    const number = Math.max(1, Math.floor(daf / 10) + 1);
    const letter = daf % 10 >= 5 ? 'B' : 'A';
    const other = letter === 'A' ? 'B' : 'A';
    const raw = [
      number + letter,
      number + other,
      (number - 1) + 'A',
      (number - 1) + 'B',
      (number + 1) + 'A',
      (number + 1) + 'B'
    ];
    return [...new Set(raw.filter((value) => /^\d+[AB]$/.test(value)))];
  }

  function filenameCandidates(bechina, label, kind) {
    if (!bechina || !bechina.from || !bechina.to || !/^\d+[AB]$/.test(String(label))) return [];
    const fromSlug = SLUGS[bechina.from.masechet];
    const toSlug = SLUGS[bechina.to.masechet];
    if (!fromSlug || !toSlug) return [];

    const endDaf = Number(bechina.to.daf) + (bechina.to.amud ? 1 : 0);
    const sameMasechet = fromSlug === toSlug;
    const hyphenRange = sameMasechet
      ? bechina.from.daf + '-' + endDaf
      : bechina.from.daf + '-' + toSlug + '-' + endDaf;
    const underscoreRange = sameMasechet
      ? bechina.from.daf + '_' + endDaf
      : bechina.from.daf + '_' + toSlug.replace(/-/g, '_') + '_' + endDaf;
    const hyphenStem = 'Oraysa-bechina-' + fromSlug + '-' + label + '-' + hyphenRange;
    const underscoreStem = 'Oraysa_bechina_' + fromSlug.replace(/-/g, '_') + '_' + label + '_' + underscoreRange;

    const suffixes = kind === 'answers'
      ? [
          ['-Answers.pdf', false], ['-Answers-English.pdf', true],
          ['_Answers.pdf', false], ['_Answers_English.pdf', true]
        ]
      : [
          ['.pdf', false], ['-English.pdf', true],
          ['.pdf', false], ['_English.pdf', true]
        ];

    const stems = [hyphenStem, hyphenStem, underscoreStem, underscoreStem];
    const seen = new Set();
    return stems.map((stem, index) => {
      const path = stem + suffixes[index][0];
      return { path, kind: kind || 'test', language: suffixes[index][1] ? 'English' : 'Hebrew' };
    }).filter((item) => {
      if (seen.has(item.path)) return false;
      seen.add(item.path);
      return true;
    });
  }

  return { labelCandidates, filenameCandidates, SLUGS };
});
