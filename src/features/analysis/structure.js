export const normalize = (t) => t.toLowerCase().replace(/\s+/g, ' ').trim();
export const stableId = (t) => {
  let h = 0;
  for (const c of t) h = ((h << 5) - h + c.charCodeAt(0)) | 0;
  return `f-${(h >>> 0).toString(36)}`;
};
export const attachmentPattern = () =>
  /\b(Exhibit|Schedule|Appendix|Annexure|Annex)\s+\[?\s*(\d+(?:\.\d+)*[A-Za-z]?|[A-Za-z]|[IVXLCDM]+)\s*\]?(?![A-Za-z0-9])/gi;
export const attachmentName = (m) =>
  `${m[1][0].toUpperCase() + m[1].slice(1).toLowerCase()} ${m[2].toUpperCase()}`;
// SEC HTML exports identify the supplied filing itself as an exhibit. Only a
// standalone cover label (or the filing metadata line) has this meaning; later
// references to the same exhibit still require an actual attachment body.
export function filingLabelAt(doc, page, match) {
  if (doc.pages[0] !== page || match[1].toLowerCase() !== 'exhibit') return false;
  const lines = [...page.text.matchAll(/[^\n]+/g)].filter((m) => m[0].trim());
  const filing = lines[0];
  if (!filing || !/^EX[-A-Z0-9.]*\s+[^\n]{0,180}\b\S+\.html?\b/i.test(filing[0].trim()))
    return false;
  const line = lines.find(
    (m) =>
      m.index <= match.index && m.index + m[0].length >= match.index + match[0].trimEnd().length,
  );
  if (line === filing) return true;
  const title = lines.find((m) => documentTitle(m[0]));
  return Boolean(
    line &&
    title &&
    line.index < title.index &&
    lines.indexOf(line) < 8 &&
    /^\s*Exhibit\s+\[?\s*\d+(?:\.\d+)*[A-Za-z]?\s*\]?\s*$/i.test(line[0]),
  );
}
export function fundIdentity(text) {
  const lines = text
    .split('\n')
    // A legal title before a metadata separator is still an explicit cover title.
    .map((s) => s.split('|')[0].trim())
    .filter(Boolean);
  // A vehicle's legal title can identify a feeder or trust without the word
  // "Fund". Require a complete standalone title before the numbered body; a
  // master/affiliate mentioned in operative prose cannot establish this identity.
  const body = lines.findIndex((line) =>
    /^(?:section\s+)?\d+(?:\.\d+)*[.)]?\s+[A-Za-z]/i.test(line),
  );
  const title =
    /^[A-Z][A-Za-z0-9&'’., -]{1,140}\s+(?:L\.?P\.?|L\.?L\.?C\.?|Ltd\.?|Limited|Inc\.?|limited partnership|limited liability company|(?:statutory |investment )?Trust)\s*$/i;
  return normalize(
    lines
      .slice(0, body < 0 ? lines.length : body)
      .find(
        (line) =>
          line.length < 150 &&
          title.test(line) &&
          !/[;():]|\b(?:the|this|means|of the|subscriber|investor|issuer|please|complete|invests|holds|receives|subscribes|accepts|is|are|shall|will|may|into)\b|^(?:for|to|from|by|with|between|and|an?)\b/i.test(
            line,
          ),
      ) || '',
  );
}
const scopeCache = new WeakMap();
export function scopeAt(doc, pageNumber) {
  let map = scopeCache.get(doc);
  if (!map) {
    map = new Map();
    let scope = doc.governingScope || doc.id;
    const occurrences = new Map();
    for (const p of doc.pages) {
      const lines = p.text.split('\n').map((t) => t.trim());
      const title = lines.find((t) =>
        /^(?:CONFIDENTIAL )?PRIVATE PLACEMENT MEMORANDUM$|^LIMITED PARTNERSHIP AGREEMENT$|^SUBSCRIPTION BOOKLET$|^INVESTMENT MANAGEMENT AGREEMENT$/i.test(
          t,
        ),
      );
      if (
        title &&
        !/signature|IN WITNESS/i.test(p.text) &&
        !/contents/i.test(p.text.slice(0, 150))
      ) {
        const name = normalize(title),
          occurrence = (occurrences.get(name) || 0) + 1;
        occurrences.set(name, occurrence);
        scope = `${name}:${occurrence}`;
      }
      map.set(p.number, scope);
    }
    scopeCache.set(doc, map);
  }
  return map.get(pageNumber) || doc.id;
}
export function headingLine(text) {
  const m = text
    .trim()
    .match(
      /^(?:section\s+)?(\d+(?:\.\d+)*|[A-Z]\.?\d+(?:\.\d+)*)(?:[.)])?\s+(?:[☐☑☒□■✓✔]\s*)?([A-Za-z][^.\n]*)(?:\.|$)/i,
    );
  return Boolean(
    m &&
    /^[A-Z]/.test(m[2]) &&
    !/^(?:of|and|or|shall|hereof|above|below|is|applies|provides|requires|under)\b/i.test(m[2]) &&
    (m[1].includes('.') || !/^(?:the|a|an)\b/i.test(m[2])),
  );
}
export const sectionNumber = (text) =>
  text.trim().match(/^(?:section\s+)?(\d+(?:\.\d+)*|[A-Z]\.?\d+(?:\.\d+)*)(?:[.)])?\s+/i)?.[1];
export function documentTitle(line) {
  const title = line.trim().replace(/^SECTION\s+(?:\d+|[IVXLCDM]+)\s*[–—:-]\s*/i, '');
  return /^(?:(?:CONFIDENTIAL|AMENDED AND RESTATED|LIMITED|ENTITY|INDIVIDUAL|INVESTOR|FORM OF)\s+)*(?:PARTNERSHIP AGREEMENT|SUBSCRIPTION AGREEMENT|INVESTMENT MANAGEMENT AGREEMENT|PRIVATE PLACEMENT MEMORANDUM|QUESTIONNAIRE|SUBSCRIPTION BOOKLET|MASTER SERVICES AGREEMENT|STATEMENT OF WORK(?:\s+\d+)?|SERVICE LEVEL SCHEDULE)$/i.test(
    title,
  )
    ? title
    : null;
}
export function blocksOf(doc) {
  let hierarchy = [],
    section = 'Document text',
    lastGoverning = null,
    sectionScope = null,
    attachment = null,
    logicalTitle = null;
  const occurrences = new Map(),
    attachments = inventoryOf(doc).filter(
      (item) => item.kind === 'attachment body' || item.kind === 'title-only attachment',
    );
  return (doc.pages || []).flatMap((page, i) => {
    const text = page.text || '',
      lines = [...text.matchAll(/[^\n]+/g)];
    const governing = scopeAt(doc, page.number),
      toc =
        page.kind === 'table of contents' ||
        /^(?:TABLE OF |PACKAGE )?CONTENTS\s*$/im.test(text) ||
        text.split('\n').filter((line) => /\.{3,}\s*\d+\s*$/.test(line)).length >= 2;
    if (governing !== lastGoverning) {
      sectionScope = governing;
      attachment = null;
      logicalTitle = null;
      lastGoverning = governing;
    }
    const result = [];
    let start = null,
      end = 0;
    const emit = () => {
      if (start === null) return;
      const raw = text.slice(start, end);
      result.push({
        documentId: doc.id,
        document: doc.name,
        documentVersion: doc.version || 1,
        originalKey: doc.originalKey || null,
        page: page.number ?? i + 1,
        originalPage: page.originalPage ?? null,
        section,
        headingPath: [...hierarchy],
        headingLevel:
          page.headingLevel ||
          (headingLine(raw.split('\n')[0]) ? sectionNumber(raw)?.split('.').length || 1 : null),
        governing,
        sectionScope,
        kind:
          toc || /\.{4}/.test(raw.split('\n')[0])
            ? 'table of contents'
            : headingLine(raw.split('\n')[0])
              ? 'heading'
              : page.kind || 'paragraph',
        text: raw,
        span: { start, end },
        locator: doc.type === 'DOCX' ? 'Paragraph' : 'Page',
      });
      start = null;
    };
    for (const line of lines) {
      const t = line[0].trim();
      if (!t) continue;
      const boundary =
        !toc &&
        attachments.find(
          (item) => item.evidence.page === page.number && item.evidence.span.start === line.index,
        );
      const heading =
        headingLine(t) ||
        Boolean(boundary) ||
        /^(?:EXHIBIT|SCHEDULE|APPENDIX|ANNEXURE|ANNEX)\s*\[?[A-Z0-9]+\]?\s*[–—:-]/i.test(t);
      const title = documentTitle(t);
      if (heading || title) {
        emit();
        section = t;
        if (boundary && attachment !== boundary.title) {
          attachment = boundary.title;
          const key = `${governing}:attachment:${normalize(attachment)}`,
            count = (occurrences.get(key) || 0) + 1;
          occurrences.set(key, count);
          sectionScope = `${key}:${count}`;
          hierarchy = [t];
        }
        if (title) {
          const name = normalize(title);
          if (!toc && !attachment && logicalTitle !== name) {
            logicalTitle = name;
            sectionScope = `${governing}:document:${name}`;
          }
          hierarchy = [t];
        } else {
          const level = sectionNumber(t)?.split('.').length || 1;
          hierarchy = hierarchy.slice(0, level - 1);
          hierarchy[level - 1] = t;
        }
      }
      if (start === null) start = line.index;
      end = line.index + line[0].length;
      const next = text.slice(end).match(/^\n(.*)/)?.[1] || '';
      if (
        (/[.!?;:]\s*$/.test(t) && !/(?:means|shall mean|includes)\s*:?\s*$/i.test(t)) ||
        heading ||
        title ||
        !next.trim()
      )
        emit();
    }
    emit();
    return result;
  });
}
export function sourceSpan(doc, page, start, end, section = 'Document text') {
  return {
    documentId: doc.id,
    document: doc.name,
    documentVersion: doc.version || 1,
    originalKey: doc.originalKey || null,
    sourcePart: page.part || null,
    xmlParagraph: page.xmlParagraph || null,
    kind: page.kind || null,
    page: page.number,
    originalPage: page.originalPage ?? null,
    section,
    text: page.text.slice(start, end),
    span: { start, end },
    locator: doc.type === 'DOCX' ? 'Paragraph' : 'Page',
  };
}
// Keep quotations on source-block boundaries instead of cutting a character window midword.
// Offsets always address the stored page text, including PDF line breaks.
export function contextSpan(doc, page, start, end, section = 'Document text') {
  const blocks = blocksOf(doc).filter(
    (b) => b.page === page.number && b.span.end > start && b.span.start < end,
  );
  if (!blocks.length) return sourceSpan(doc, page, start, end, section);
  return sourceSpan(
    doc,
    page,
    Math.min(start, blocks[0].span.start),
    Math.max(end, blocks.at(-1).span.end),
    blocks[0].section || section,
  );
}
export function inventoryOf(doc) {
  const items = [],
    fund = doc.fundScope || fundIdentity(doc.pages.map((p) => p.text).join('\n'));
  let scope = doc.governingScope || doc.id;
  for (const p of doc.pages) {
    scope = scopeAt(doc, p.number);
    const lines = [...p.text.matchAll(/[^\n]+/g)].filter((m) => m[0].trim());
    // Repeated labels in a running header and certification are not a contents list.
    const toc =
      p.kind === 'table of contents' ||
      lines.some((m) => /^(?:table of |package )?contents\s*$/i.test(m[0].trim())) ||
      lines.filter((m) => /\.{3,}\s*\d+\s*$/.test(m[0])).length >= 2;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i][0].trim();
      const title = documentTitle(line);
      if (title && !toc) {
        items.push({
          id: stableId(`${doc.id}:${p.number}:${line}`),
          kind: /questionnaire/i.test(line) ? 'questionnaire' : 'agreement',
          title: line,
          scope,
          fund,
          evidence: sourceSpan(doc, p, lines[i].index, lines[i].index + lines[i][0].length, line),
        });
      }
      const joined = lines
          .slice(i, i + 2)
          .map((m) => m[0].trim())
          .join('\n'),
        m = [...joined.matchAll(attachmentPattern())][0];
      if (!m || m.index !== 0) continue;
      if (filingLabelAt(doc, p, { ...m, index: lines[i].index + lines[i][0].indexOf(line) }))
        continue;
      const label = attachmentName(m),
        tail = joined.slice(m[0].length),
        atTop = i < 5;
      const tocEntry = /\.{2,}|\s{3,}\d+\s*$/.test(line) || toc;
      const standalone = /^\s*$/.test(line.slice(m[0].length));
      const consumed = (m[0].trimEnd().match(/\n/g) || []).length;
      const next = lines[i + 1 + consumed]?.[0].trim() || '';
      const heading =
        !tocEntry &&
        ((/^[\s–—:-]/.test(tail) && !standalone && (atTop || /^\s*[–—:-]/.test(tail))) ||
          (standalone && (/^[A-Z][A-Za-z "“”'-]{3,120}$/.test(next) || headingLine(next))));
      if (!heading && !tocEntry) continue;
      const body = p.text.slice(lines[i].index + m[0].length);
      let substantive =
        heading &&
        body.length > 35 &&
        (body.length > 250 ||
          /(?:\b(?:must|shall|means|please|name|address|investor|recipient|information|representations|definition|insert|complete|risk|acknowledge)\b|_{3})/i.test(
            body,
          )) &&
        !/^\s*(?:FORM OF )?(?:LIMITED LIABILITY COMPANY|LLC|PARTNERSHIP) AGREEMENT\s*(?:\d+)?\s*$/i.test(
          body,
        );
      let contentEvidence = [];
      if (heading && !substantive) {
        const index = doc.pages.indexOf(p);
        let accumulated = '';
        const spans = [];
        for (const next of doc.pages.slice(index + 1, index + (doc.type === 'DOCX' ? 40 : 6))) {
          const first = next.text.trim(),
            a = [...first.matchAll(attachmentPattern())][0];
          const newAttachment =
            a?.index === 0 &&
            attachmentName(a) !== label &&
            /^(?:\s*[-–—:]|\s*$)/.test(first.slice(a[0].length));
          if (
            newAttachment ||
            next.status === 'OCR required' ||
            next.status === 'extraction error' ||
            /^(?:SUBSCRIPTION BOOKLET|LIMITED PARTNERSHIP AGREEMENT|PRIVATE PLACEMENT MEMORANDUM)\s*$/im.test(
              first,
            )
          )
            break;
          if (/^(?:TABLE OF |PACKAGE )?CONTENTS\s*$/im.test(first) || /\.{4}/.test(first)) continue;
          accumulated += next.text + ' ';
          spans.push(sourceSpan(doc, next, 0, next.text.length, 'Attachment continuation'));
          if (
            next.text.length > 250 ||
            (doc.type === 'DOCX' &&
              accumulated.length > 35 &&
              /_{3}|\b(?:name|address|identifier)\s*:|\b(?:means|must|shall|please)\b/i.test(
                accumulated,
              ))
          ) {
            substantive = true;
            contentEvidence = spans;
            break;
          }
        }
      }
      const parentScope = scopeAt(doc, doc.pages[Math.max(0, doc.pages.indexOf(p) - 1)]?.number);
      items.push({
        id: stableId(`${doc.id}:${p.number}:${label}`),
        kind: tocEntry
          ? 'table of contents'
          : substantive
            ? 'attachment body'
            : 'title-only attachment',
        title: label,
        scope: heading && parentScope !== scope ? parentScope : scope,
        fund,
        substantive,
        evidence: sourceSpan(doc, p, lines[i].index, p.text.length, line),
        contentEvidence,
        page: p.number,
      });
    }
  }
  // A page's running label and repeated body heading identify the same attachment.
  const unique = new Map();
  for (const item of items) {
    const key = `${item.kind === 'agreement' ? 'agreement' : 'attachment'}:${item.title}:${item.scope}:${item.evidence.page}`;
    const prior = unique.get(key);
    if (!prior || (!prior.substantive && item.substantive)) unique.set(key, item);
  }
  return [...unique.values()];
}
