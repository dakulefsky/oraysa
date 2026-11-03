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

  // The number/side usually tracks the approximate daf interval, but
  // Oraysa's published examples show exceptions (e.g. Chagiga 21-25 is #2B).
  // Probe a small neighborhood in a deterministic order instead of assuming
  // a single exact label.
  function labelCandidates(startDaf) {
    const daf = Math.max(2, Math.floor(Number(startDaf) || 2));
    const number = Math.max(1, Math.floor(daf / 10) + 1);
    const side = daf % 10 >= 5 ? 'B' : 'A';
    const other = side === 'A' ? 'B' : 'A';
    const raw = [
      number + side,
      (number - 1) + other,
      number + other,
      (number - 1) + side,
      (number + 1) + side,
      (number + 1) + other
    ];
    return [...new Set(raw.filter((value) => /^[0-9]+[AB]$/.test(value)))];
  }

  function sequenceDaf(bechina, segments) {
    const list = Array.isArray(segments) && segments.length
      ? segments
      : Array.isArray(bechina && bechina.segments) ? bechina.segments : [];
    if (list.length) return list.length > 1 ? list[list.length - 1].startDaf : list[0].startDaf;
    if (bechina && bechina.from && bechina.to) {
      return bechina.from.masechet === bechina.to.masechet ? bechina.from.daf : bechina.to.daf;
    }
    return null;
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
      ? {
          hyphen: ['-Answers.pdf', '-Answers-English.pdf'],
          underscore: ['_Answers.pdf', '_Answers_English.pdf']
        }
      : {
          hyphen: ['.pdf', '-English.pdf'],
          underscore: ['.pdf', '_English.pdf']
        };

    const addPair = (stem, separator) => {
      const pair = suffixes[separator];
      candidates.push({ path: stem + pair[0], kind: kind || 'test', language: 'Hebrew' });
      candidates.push({ path: stem + pair[1], kind: kind || 'test', language: 'English' });
    };

    const candidates = [];
    const modernHyphen = normalized.map((s) => s.slug + '-' + s.start + '-' + s.end).join('-');
    const modernUnderscore = normalized.map((s) => s.slug.replace(/-/g, '_') + '_' + s.start + '_' + s.end).join('_');
    if (normalized.length === 1) {
      const stem = 'Oraysa-bechina-' + finalSlug + '-' + label + '-' + normalized[0].start + '-' + normalized[0].end;
      const underscoreStem = 'Oraysa_bechina_' + finalSlug.replace(/-/g, '_') + '_' + label + '_' + normalized[0].start + '_' + normalized[0].end;
      addPair(stem, 'hyphen');
      addPair(underscoreStem, 'underscore');
    } else {
      // Current cross-masechta pattern prefixes the final masechta and then
      // lists every masechta segment. Keep the older compact form as fallback.
      addPair('Oraysa-bechina-' + finalSlug + '-' + label + '-' + modernHyphen, 'hyphen');
      addPair('Oraysa_bechina_' + finalSlug.replace(/-/g, '_') + '_' + label + '_' + modernUnderscore, 'underscore');
      const legacyHyphen = 'Oraysa-bechina-' + normalized[0].slug + '-' + label + '-' +
        normalized[0].start + '-' + finalSlug + '-' + normalized[normalized.length - 1].end;
      const legacyUnderscore = 'Oraysa_bechina_' + normalized[0].slug.replace(/-/g, '_') + '_' + label + '_' +
        normalized[0].start + '_' + finalSlug.replace(/-/g, '_') + '_' + normalized[normalized.length - 1].end;
      addPair(legacyHyphen, 'hyphen');
      addPair(legacyUnderscore, 'underscore');
    }

    const seen = new Set();
    return candidates.filter((item) => {
      if (seen.has(item.path)) return false;
      seen.add(item.path);
      return true;
    });
  }

  return { labelCandidates, sequenceDaf, filenameCandidates, SLUGS };
});
