import { blocksOf, contextSpan, normalize } from './structure.js';

const small = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
];
const tens = ['twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const scales = { thousand: 1000, million: 1000000, billion: 1000000000 };
const numericWords = [...small, ...tens, 'hundred', ...Object.keys(scales), 'and'].join('|');

function underThousand(words) {
  if (!words.length) return null;
  let value = 0;
  if (words[1] === 'hundred') {
    const unit = small.indexOf(words[0]);
    if (unit < 1 || unit > 9) return null;
    value = unit * 100;
    words = words.slice(2);
    if (words[0] === 'and') words = words.slice(1);
    if (!words.length) return value;
  }
  if (words.length === 1 && small.includes(words[0])) return value + small.indexOf(words[0]);
  if (
    tens.includes(words[0]) &&
    (words.length === 1 ||
      (words.length === 2 && small.indexOf(words[1]) > 0 && small.indexOf(words[1]) < 10))
  )
    return (
      value + (tens.indexOf(words[0]) + 2) * 10 + (words.length === 2 ? small.indexOf(words[1]) : 0)
    );
  return null;
}
// Deliberately supports integer English amounts only, and abstains on unfamiliar syntax.
export function writtenAmount(text) {
  let words = text
      .toLowerCase()
      .trim()
      .split(/[\s-]+/),
    group = [],
    total = 0,
    lastScale = Infinity;
  for (const word of words) {
    if (word in scales) {
      const n = underThousand(group),
        scale = scales[word];
      if (!n || scale >= lastScale) return null;
      total += n * scale;
      lastScale = scale;
      group = [];
    } else group.push(word);
  }
  if (group[0] === 'and' && total) group = group.slice(1);
  const tail = group.length ? underThousand(group) : total ? 0 : null;
  return tail === null ? null : total + tail;
}

const months = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const datePattern = () =>
  new RegExp(
    `\\b(?:(${months.join('|')})\\s+(\\d{1,2})(?:st|nd|rd|th)?[,]?\\s+(\\d{4})|(\\d{4})-(\\d{2})-(\\d{2}))\\b`,
    'gi',
  );
const entityPattern = () =>
  /\b[A-Z][A-Za-z'’-]*(?:[ \n]+(?:[A-Z][A-Za-z'’-]*|[IVX]+|&|and|of|the)){1,9},?[ \n]+(?:L\.?P\.?|LLC|L\.L\.C\.|Inc\.?|Ltd\.?)(?![A-Za-z])/g;
const entityKey = (t) => normalize(t).replace(/[.,]/g, '').replace(/\s+/g, ' ');
function oneEdit(a, b) {
  if (a === b || Math.abs(a.length - b.length) > 1) return false;
  if (a.length === b.length) {
    const diffs = [...a].flatMap((c, i) => (c === b[i] ? [] : [i]));
    return (
      diffs.length === 1 ||
      (diffs.length === 2 &&
        diffs[1] === diffs[0] + 1 &&
        a[diffs[0]] === b[diffs[1]] &&
        a[diffs[1]] === b[diffs[0]])
    );
  }
  const [short, long] = a.length < b.length ? [a, b] : [b, a];
  let i = 0;
  while (i < short.length && short[i] === long[i]) i++;
  return short.slice(i) === long.slice(i + 1);
}
function similarParty(a, b) {
  const aa = entityKey(a).split(' '),
    bb = entityKey(b).split(' ');
  if (aa.length !== bb.length || aa.at(-1) !== bb.at(-1)) return false;
  const diffs = aa.flatMap((t, i) => (t === bb[i] ? [] : [i]));
  return (
    diffs.length === 1 &&
    Math.min(aa[diffs[0]].length, bb[diffs[0]].length) >= 4 &&
    oneEdit(aa[diffs[0]], bb[diffs[0]])
  );
}

export function mechanicalChecks(doc) {
  const checks = [],
    blocks = blocksOf(doc),
    headings = new Map(),
    entities = [];
  const add = (subtype, title, evidence, description, question, identity, impact, extra = {}) =>
    checks.push({
      type: subtype === 'Drafting placeholder' ? 'Missing reference' : 'Typo',
      subtype,
      title,
      severity: 'review',
      evidence,
      description,
      question,
      identity: `${doc.id}:${subtype}:${identity}`,
      impact,
      certainty: 'Mechanical discrepancy; confirm intended source',
      ...extra,
    });
  for (const page of doc.pages) {
    const text = page.text;
    // A small administrative-verb vocabulary avoids treating proper names or
    // every unfamiliar word as misspelled. This is not a general spellchecker.
    const verbs = [
      'acknowledge',
      'acknowledges',
      'certify',
      'certifies',
      'confirm',
      'confirms',
      'represent',
      'represents',
      'warrant',
      'warrants',
    ];
    for (const m of text.matchAll(
      /\b(?:Investor|Subscriber|Applicant|Customer|Supplier|Client|Provider)\s+([a-z]{7,})\b/g,
    )) {
      const word = m[1];
      if (verbs.includes(word)) continue;
      // The matched subject is singular; suggest its third-person verb form.
      const candidates = verbs.filter((v) => v.endsWith('s') && oneEdit(word, v));
      if (candidates.length !== 1) continue;
      add(
        'Spelling',
        `Possible spelling error: “${word}”`,
        [contextSpan(doc, page, m.index, m.index + m[0].length)],
        `The administrative verb “${word}” appears to be a misspelling of “${candidates[0]}”.`,
        `Should “${word}” be corrected to “${candidates[0]}”?`,
        word,
        'Minor editorial correction; verify the source wording.',
        { severity: 'advisory', suggestion: candidates[0] },
      );
    }
    for (const m of text.matchAll(
      /\[(?:INSERT\b[^\]\n]{0,100}|TBD|TO BE (?:COMPLETED|CONFIRMED|INSERTED)|[●•])\]/gi,
    )) {
      const before = text.slice(Math.max(0, m.index - 100), m.index);
      // A bracketed instruction beside a fill-in line is an answer prompt, not unfinished fund drafting.
      if (
        /_{3,}[.\d\s$€£]*$/.test(before) ||
        /\b(?:name\s+of\s+(?:the\s+)?(?:investor|subscriber|applicant)|(?:investor|subscriber|applicant)\s+name)\b/i.test(
          m[0],
        )
      )
        continue;
      add(
        'Drafting placeholder',
        `Unfilled placeholder: ${m[0]}`,
        [contextSpan(doc, page, m.index, m.index + m[0].length)],
        'An explicit drafting placeholder remains in the supplied source. Confirm whether a final value or an investor input is intended.',
        `What should replace ${m[0]}, or should the form collect this value from the investor?`,
        normalize(m[0]),
        'Source value or field instructions are unfinished; confirm the intended value before configuring the field.',
      );
    }
    for (const m of text.matchAll(datePattern())) {
      const year = Number(m[3] || m[4]),
        month = m[1]
          ? months.findIndex((s) => s.toLowerCase() === m[1].toLowerCase()) + 1
          : Number(m[5]),
        day = Number(m[2] || m[6]);
      const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0),
        days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
      if (month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1]) continue;
      add(
        'Invalid date',
        `Verify date: ${m[0]}`,
        [contextSpan(doc, page, m.index, m.index + m[0].length)],
        'The written date is not a valid calendar date.',
        `What valid date should replace ${m[0]}?`,
        normalize(m[0]),
        'A date field cannot use this calendar value.',
      );
    }
    const money = new RegExp(
      `\\b((?:(?:${numericWords})[\\s-]+){0,20}(?:${numericWords}))\\s+(dollars?|euros?|pounds?)\\s*\\(\\s*(USD|US\\s*\\$|\\$|EUR|€|GBP|£)\\s*((?:\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d{1,2})?)\\s*\\)`,
      'gi',
    );
    for (const m of text.matchAll(money)) {
      const written = writtenAmount(m[1]),
        numeric = Number(m[4].replaceAll(',', '')),
        currency = /euros?/i.test(m[2]) ? 'EUR' : /pounds?/i.test(m[2]) ? 'GBP' : 'USD';
      if (
        written === null ||
        !Number.isSafeInteger(written) ||
        written === numeric ||
        (currency === 'EUR' && !/EUR|€/i.test(m[3])) ||
        (currency === 'GBP' && !/GBP|£/i.test(m[3])) ||
        (currency === 'USD' && !/USD|\$/i.test(m[3]))
      )
        continue;
      add(
        'Amount words mismatch',
        'Written and numeric amounts differ',
        [contextSpan(doc, page, m.index, m.index + m[0].length)],
        `The written amount represents ${currency} ${written.toLocaleString('en-US')}; the numeral represents ${currency} ${numeric.toLocaleString('en-US')}.`,
        `Should this amount be ${currency} ${written.toLocaleString('en-US')} or ${currency} ${numeric.toLocaleString('en-US')}?`,
        normalize(m[0]),
        'The amount field has two conflicting source values.',
        { values: { written, numeric, currency } },
      );
    }
    for (const m of text.matchAll(entityPattern())) {
      const tail = text.slice(m.index + m[0].length, m.index + m[0].length + 160);
      const alias =
        /(?:also known as|formerly known as|a\/k\/a|d\/b\/a|doing business as)\s*["“]?\s*$/i.test(
          text.slice(Math.max(0, m.index - 70), m.index),
        );
      const declared =
        alias ||
        /^\s*(?:(?:acts|serves)\s+as[^()]{0,90})?\(\s*(?:(?:the|a|an)\s+)?["“][^"”]{2,50}["”]\s*\)/i.test(
          tail,
        );
      const block = blocks.find(
        (b) => b.page === page.number && b.span.start <= m.index && b.span.end > m.index,
      );
      entities.push({
        name: m[0],
        declared,
        scope: block?.governing,
        evidence: contextSpan(doc, page, m.index, m.index + m[0].length),
      });
    }
  }
  for (const block of blocks.filter((b) => b.kind === 'heading')) {
    const heading = block.text.trim(),
      id = heading.match(/^(?:section\s+)?(\d+(?:\.\d+)*)[.)]?\s+/i)?.[1];
    if (!id) continue;
    // Plain numbered lists, footnotes and address lines are not established section IDs.
    if (!id.includes('.') && !/^section\s+/i.test(heading)) continue;
    const title = heading.replace(/^(?:section\s+)?\d+(?:\.\d+)*[.)]?\s+/i, '');
    if (
      /^(?:the|this|such|a|an|if|any|each|these|those|above|below|shall|must|will|may)\b/i.test(
        title,
      )
    )
      continue;
    const key = `${block.sectionScope || block.governing}:${id}`,
      prior = headings.get(key);
    if (prior && normalize(prior.text) !== normalize(block.text))
      add(
        'Duplicate section',
        `Duplicate Section ${id}`,
        [prior, block],
        `Two different body headings use Section ${id} in the same supplied agreement scope.`,
        `How should these Section ${id} headings be numbered?`,
        key,
        'Section-based question mapping and references cannot uniquely identify the intended provision.',
      );
    else if (!prior) headings.set(key, block);
  }
  const declarations = entities.filter((e) => e.declared);
  for (const entity of entities) {
    const local = declarations.filter((d) => d.scope === entity.scope);
    if (local.some((d) => entityKey(d.name) === entityKey(entity.name))) continue;
    const matches = local.filter((d) => similarParty(entity.name, d.name));
    const unique = [...new Map(matches.map((d) => [entityKey(d.name), d])).values()];
    if (unique.length !== 1) continue;
    const declared = unique[0];
    add(
      'Party name variation',
      `Verify party name: ${entity.name}`,
      [declared.evidence, entity.evidence],
      `This name differs by one letter or transposition from the explicitly declared ${declared.name}. A separate party remains possible.`,
      `Should ${entity.name} match the declared ${declared.name}, or does it identify a separate party?`,
      `${entity.scope}:${entityKey(entity.name)}`,
      'The recipient or prefilled legal-entity name may identify the wrong party.',
    );
  }
  return checks;
}
