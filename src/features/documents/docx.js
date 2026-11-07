import JSZip from 'jszip';
const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const nodes = (e, n) => [...e.getElementsByTagNameNS(W, n)];
const attr = (e, n) => e?.getAttributeNS(W, n);
const value = (e, n) => attr(nodes(e, n)[0], 'val');
function xml(text) {
  const d = new DOMParser().parseFromString(text, 'application/xml');
  if (d.querySelector('parsererror')) throw new Error('Invalid Word XML');
  return d;
}
function numeral(n, format) {
  if (format === 'upperLetter' || format === 'lowerLetter') {
    let s = '';
    while (n > 0) {
      n--;
      s = String.fromCharCode(65 + (n % 26)) + s;
      n = Math.floor(n / 26);
    }
    return format === 'lowerLetter' ? s.toLowerCase() : s;
  }
  if (format === 'upperRoman' || format === 'lowerRoman') {
    let s = '';
    for (const [v, t] of [
      [1000, 'M'],
      [900, 'CM'],
      [500, 'D'],
      [400, 'CD'],
      [100, 'C'],
      [90, 'XC'],
      [50, 'L'],
      [40, 'XL'],
      [10, 'X'],
      [9, 'IX'],
      [5, 'V'],
      [4, 'IV'],
      [1, 'I'],
    ])
      while (n >= v) {
        s += t;
        n -= v;
      }
    return format === 'lowerRoman' ? s.toLowerCase() : s;
  }
  return String(n);
}
export async function parseDocx(arrayBuffer) {
  const zip = await JSZip.loadAsync(arrayBuffer),
    limitations = [
      'DOCX citations are XML paragraphs/segments, not original pages; page layout is not reconstructed.',
    ];
  async function read(name) {
    const f = zip.file(name);
    if (!f) return null;
    const t = await f.async('string');
    if (t.length > 15000000) throw new Error('Word XML exceeds the local extraction limit');
    return xml(t);
  }
  const main = await read('word/document.xml');
  if (!main) throw new Error('Word main document part is missing');
  const numbering = await read('word/numbering.xml'),
    styles = await read('word/styles.xml');
  const nums = new Map(),
    abstracts = new Map(),
    styleMap = new Map(),
    counters = new Map();
  if (styles) for (const s of nodes(styles, 'style')) styleMap.set(attr(s, 'styleId'), s);
  if (numbering) {
    for (const a of nodes(numbering, 'abstractNum')) abstracts.set(attr(a, 'abstractNumId'), a);
    for (const n of nodes(numbering, 'num')) nums.set(attr(n, 'numId'), n);
  }
  function props(p) {
    let style = value(p, 'pStyle'),
      s = styleMap.get(style);
    const num = nodes(p, 'numPr')[0] || (s && nodes(s, 'numPr')[0]);
    return {
      style,
      numId: num && value(num, 'numId'),
      level: Number((num && value(num, 'ilvl')) || 0),
      headingLevel: Number(value(p, 'outlineLvl') ?? (s && value(s, 'outlineLvl')) ?? -1) + 1,
    };
  }
  function number(p) {
    const { numId, level } = props(p);
    if (!numId || numId === '0') return null;
    const num = nums.get(numId),
      abstract = num && abstracts.get(value(num, 'abstractNumId'));
    if (!abstract) {
      limitations.push(`Unresolved Word numbering ${numId}; labels were not invented.`);
      return null;
    }
    const levels = new Map(nodes(abstract, 'lvl').map((l) => [Number(attr(l, 'ilvl')), l]));
    const override = nodes(num, 'lvlOverride').find((l) => Number(attr(l, 'ilvl')) === level);
    const lvl = (override && nodes(override, 'lvl')[0]) || levels.get(level);
    if (!lvl) return null;
    const format = value(lvl, 'numFmt');
    if (format === 'bullet') return null;
    if (!['decimal', 'upperLetter', 'lowerLetter', 'upperRoman', 'lowerRoman'].includes(format)) {
      limitations.push(`Unsupported numbering format ${format}; labels were not invented.`);
      return null;
    }
    const start = Number(
      (override && value(override, 'startOverride')) || value(lvl, 'start') || 1,
    );
    const state = counters.get(numId) || [];
    state[level] = state[level] === undefined ? start : state[level] + 1;
    state.splice(level + 1);
    counters.set(numId, state);
    const template = value(lvl, 'lvlText');
    if (!template) return null;
    const label = template.replace(/%([1-9])/g, (_, i) => {
      const l = Number(i) - 1,
        definition = levels.get(l);
      return numeral(
        state[l] ?? Number((definition && value(definition, 'start')) || 1),
        (definition && value(definition, 'numFmt')) || 'decimal',
      );
    });
    return {
      label,
      numId,
      level,
      template,
      format,
      source: 'word/numbering.xml; exact numbering template and counters',
    };
  }
  const pages = [];
  let xmlParagraph = 0;
  function extract(part, kind = 'paragraph') {
    for (const p of nodes(part, 'p')) {
      xmlParagraph++;
      let text = '';
      const walk = (n) => {
        if (n.nodeType !== 1) return;
        const tag = n.localName;
        if (tag === 't') {
          text += n.textContent;
          return;
        }
        if (tag === 'tab') {
          text += '\t';
          return;
        }
        if (tag === 'br' || tag === 'cr') {
          text += '\n';
          return;
        }
        if (tag === 'del' || tag === 'instrText') return;
        for (const c of n.children) walk(c);
      };
      walk(p);
      if (
        !text.trim() &&
        nodes(p, 'sectPr').length &&
        !nodes(p, 'drawing').length &&
        !nodes(p, 'pict').length
      )
        continue;
      const numbering = number(p),
        pr = props(p),
        hasImage = nodes(p, 'drawing').length + nodes(p, 'pict').length > 0;
      let parent = p.parentElement,
        table = false;
      while (parent) {
        if (parent.localName === 'tc') table = true;
        parent = parent.parentElement;
      }
      if (numbering) text = `${numbering.label} ${text}`;
      text = text.trim();
      if (!text && !hasImage) continue;
      pages.push({
        number: pages.length + 1,
        text,
        xmlParagraph,
        part:
          kind === 'footnote'
            ? 'word/footnotes.xml'
            : kind === 'endnote'
              ? 'word/endnotes.xml'
              : 'word/document.xml',
        status: hasImage ? 'OCR required' : 'searchable text',
        reason: hasImage
          ? 'Embedded image may contain text or a heading; OCR not performed'
          : undefined,
        kind: table
          ? 'table'
          : /^TOC/i.test(pr.style || '') || /\t\d+$/.test(text)
            ? 'table of contents'
            : pr.headingLevel
              ? 'heading'
              : kind,
        headingLevel: pr.headingLevel || null,
        numbering,
      });
    }
  }
  extract(main);
  for (const [part, kind] of [
    ['word/footnotes.xml', 'footnote'],
    ['word/endnotes.xml', 'endnote'],
  ]) {
    const x = await read(part);
    if (x) extract(x, kind);
  }
  if (nodes(main, 'altChunk').length)
    limitations.push('Embedded alternate-format content is unsupported.');
  return { pages, limitations: [...new Set(limitations)] };
}
