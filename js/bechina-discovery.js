(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.OraysaBechinaDiscovery = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Slugs confirmed from public Oraysa S3 filenames where available; the
  // remaining spellings follow the same established transliteration style.
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

  // Observed Oraysa numbering: 3A starts around daf 20, 3B around daf 25,
  // 4A around daf 30, etc. On a cross-masechta test the sequence restarts
  // from the first daf of the new (final) masechta.
  function labelCandidates(startDaf) {
    const daf = Math.max(2, Math.floor(Number(startDaf) || 2));
    const number = Math.max(1, Math.floor(daf / 10) + 1);
    const side = daf % 10 >= 5 ? 'B' : 'A';
    return [number + side];
  }

  function filenameCandidates(bechina, label, kind) {
    if (!bechina || !/^\d+[AB]$/.test(String(label))) return [];
    const segments = Array.isArray(bechina.segments) && bechina.segments.length
      ? bechina.segments
      : (bechina.from && bechina.to && bechina.from.masechet === bechina.to.masechet
        ? [{ masechet: bechina.from.masechet, startDaf: bechina.from.daf, endDaf: bechina.to.daf }]
        : []);
    if (!segments.length) return [];

    const normalized = segments.map((segment) => {
      const slug = SLUGS[segment.masechet];
      const start = Math.floor(Number(segment.startDaf));
      const end = Math.floor(Number(segment.endDaf));
      if (!slug || !Number.isFinite(start) || !Number.isFinite(end) || start < 2 || end < start) return null;
      return { slug, start, end };
    });
    if (normalized.some((segment) => !segment)) return [];

    const finalSlug = normalized[normalized.length - 1].slug;
    const suffixes = kind === 'answers'
      ? [
          ['-Answers.pdf', false], ['-Answers-English.pdf', true],
          ['_Answers.pdf', false], ['_Answers_English.pdf', true]
        ]
      : [
          ['.pdf', false], ['-English.pdf', true],
          ['.pdf', false], ['_English.pdf', true]
        ];

    const modernHyphen = normalized.map((s) => s.slug + '-' + s.start + '-' + s.end).join('-');
    const modernUnderscore = normalized.map((s) => s.slug.replace(/-/g, '_') + '_' + s.start + '_' + s.end).join('_');
    const stems = normalized.length === 1
      ? [
          'Oraysa-bechina-' + finalSlug + '-' + label + '-' + normalized[0].start + '-' + normalized[0].end,
          'Oraysa-bechina-' + finalSlug + '-' + label + '-' + normalized[0].start + '-' + normalized[0].end,
          'Oraysa_bechina_' + finalSlug.replace(/-/g, '_') + '_' + label + '_' + normalized[0].start + '_' + normalized[0].end,
          'Oraysa_bechina_' + finalSlug.replace(/-/g, '_') + '_' + label + '_' + normalized[0].start + '_' + normalized[0].end
        ]
      : [
          'Oraysa-bechina-' + finalSlug + '-' + label + '-' + modernHyphen,
          'Oraysa-bechina-' + normalized[0].slug + '-' + label + '-' + normalized[0].start + '-' + finalSlug + '-' + normalized[normalized.length - 1].end,
          'Oraysa_bechina_' + finalSlug.replace(/-/g, '_') + '_' + label + '_' + modernUnderscore,
          'Oraysa_bechina_' + normalized[0].slug.replace(/-/g, '_') + '_' + label + '_' + normalized[0].start + '_' + finalSlug.replace(/-/g, '_') + '_' + normalized[normalized.length - 1].end
        ];

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
