import { normalize, sourceSpan, contextSpan, fundIdentity, scopeAt } from './structure.js';
import { documentContext } from './context.js';
export function scopeOf(text) {
  const classes = [
    ...new Set([...text.matchAll(/\bClass\s+([A-Z0-9]+)\b/gi)].map((m) => m[1].toUpperCase())),
  ];
  const dates = [
    ...new Set(
      [
        ...text.matchAll(
          /\b((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4})\s+closing\b/gi,
        ),
      ].map((m) => normalize(m[1]).replace(',', '')),
    ),
  ];
  const applicant = text.match(
    /\bFor\s+([^.;\n]{3,100}?(?:LLC|L\.?P\.?|Ltd\.?|Inc\.?|Trust))\s+only\b/i,
  )?.[1];
  const explicitException =
    /\b(?:has exercised|approved.*investor|waiver has been|waived for)\b/i.test(text) ||
    Boolean(
      applicant &&
      /\b(?:express exception|replaces? the standard|prevails?|supersedes?)\b/i.test(text),
    );
  const classApplies =
    classes.length === 1 &&
    new RegExp(
      `\\b(?:(?:for|to)\\s+(?:(?:every|all|the)\\s+)?Class\\s+${classes[0]}\\b|Class\\s+${classes[0]}\\s+(?:investors?\\s+only|minimum|funding|subscription\\s+(?:minimum|deadline))\\b)`,
      'i',
    ).test(text);
  return {
    investor:
      text
        .match(/\b(?:for\s+)?(individual|entity) (?:investors?|applicants?) only/i)?.[1]
        ?.toLowerCase() || null,
    class:
      classApplies && !/\bClass\s+\w+\s+(?:and|or|\/)\s+[A-Z0-9]+\b/i.test(text)
        ? classes[0]
        : null,
    closing:
      dates.length === 1
        ? dates[0]
        : text.match(/\b(Initial|Subsequent|Final) Closing only/i)?.[1]?.toLowerCase() || null,
    applicant: applicant ? normalize(applicant) : null,
    exception: explicitException,
  };
}
export const disjoint = (a, b) =>
  ['investor', 'class', 'closing', 'applicant'].some((k) => a[k] && b[k] && a[k] !== b[k]) ||
  (a.exception !== b.exception && (a.exception || b.exception));
export function factsOf(doc, identity = documentContext(doc)) {
  const definitions = [],
    minimums = [],
    incorporations = [];
  const full = doc.pages.map((p) => p.text).join('\n'),
    fund = identity.fund || doc.fundScope || fundIdentity(full);
  let agreement = doc.governingScope || null;
  for (const p of doc.pages) {
    agreement = scopeAt(doc, p.number).replace(/:\d+$/, '');
    const text = p.text,
      scope = scopeOf(text),
      title = text
        .split('\n')
        .map((t) => t.trim())
        .find(
          (t) =>
            t.length < 90 &&
            /^(?:LIMITED )?(?:PARTNERSHIP AGREEMENT|SUBSCRIPTION AGREEMENT|INVESTMENT MANAGEMENT AGREEMENT|PRIVATE PLACEMENT MEMORANDUM)$/i.test(
              t,
            ),
        );
    if (title && !/signature|IN WITNESS/i.test(text)) agreement = normalize(title);
    const evidence = (start, end) => sourceSpan(doc, p, start, end, title || 'Document text');
    // Unquoted Title Case terms followed by an explicit definitional verb. Do not
    // infer definitions from headings, ordinary capitalization, or cross-references.
    for (const m of text.matchAll(
      /(?<![\w“”"])([A-Z][a-z]+(?:[ \t]+[A-Z][a-z]+){0,4})\s+(means|shall\s+mean|is\s+defined\s+as)\s*:?\s*([^.!]+(?:[.!]|$))/g,
    )) {
      definitions.push({
        term: normalize(m[1]),
        display: m[1].replace(/\s+/g, ' ').trim(),
        meaning: m[3].replace(/\s+/g, ' ').trim(),
        kind: m[2],
        scope,
        fund,
        agreement: agreement === doc.id ? null : agreement,
        evidence: contextSpan(doc, p, m.index, m.index + m[0].length),
      });
    }
    for (const m of text.matchAll(
      /[“"]\s*([^”"\n]{2,65}?)\s*[”"]\s*(means|shall\s+mean|includes|is\s+defined\s+as)\s*:?\s*([\s\S]{1,1500}?)(?=(?:[.!]\s+(?=[A-Z“"\n]))|$)/gi,
    ))
      definitions.push({
        term: normalize(m[1]),
        display: m[1].trim(),
        meaning: m[3].replace(/\s+/g, ' ').trim(),
        kind: m[2],
        scope,
        fund,
        agreement: agreement === doc.id ? null : agreement,
        evidence: evidence(m.index, m.index + m[0].length),
      });
    for (const m of text.matchAll(
      /([^.!\n]{2,180})\(\s*(?:(?:the|a|an|each|collectively)\s+)?[“"]\s*([^”"\n]{2,65}?)\s*[”"][^)]*\)/gi,
    ))
      definitions.push({
        term: normalize(m[2]),
        display: m[2].trim(),
        meaning: m[1].trim(),
        kind: 'inline designation',
        scope,
        fund,
        agreement: agreement === doc.id ? null : agreement,
        evidence: evidence(m.index, m.index + m[0].length),
      });
    for (const m of text.matchAll(
      /(?:capitali[sz]ed terms|terms used)[\s\S]{0,180}?(?:meaning|defined)[\s\S]{0,180}?(?:Agreement|Memorandum)/gi,
    ))
      incorporations.push({ text: m[0], evidence: evidence(m.index, m.index + m[0].length) });
    for (const m of text.matchAll(
      /\bm\s*inimum\s+(?:(initial|additional|aggregate)\s+)?(capital\s+(?:contribution|commitment)|investment|subscription|commitment)(?:\s+(?:for\s+(?:(?:(?:every|each|all|the|any)\s+)?(?:subscribers?|investors?|applicants?)(?:\s+in\s+this\s+(?:offering|fund))?|this\s+(?:same\s+)?subscription)|in\s+this\s+(?:fund|offering)))?(?:\s+(?:amount|of|is|shall|be|requires|per\s+investor)){0,6}(?:\s+that\s+will\s+typically\s+be\s+accepted\s+by\s+the\s+Partnership\s+is)?\s*:?\s*(USD\s*\$?\s*|US\s*\$\s*|\$\s*|EUR\s*€?\s*|€\s*|GBP\s*£?\s*|£\s*)([\d,]+(?:\.\d+)?)/gi,
    )) {
      const start = Math.max(0, m.index - 150),
        end = Math.min(text.length, m.index + m[0].length + 450),
        context = text.slice(start, end);
      const neighboring =
        doc.pages.find((x) => x.number === p.number + 1)?.text.slice(0, 800) || '';
      const span = contextSpan(doc, p, m.index, m.index + m[0].length),
        localScope = scopeOf(span.text);
      // Explicit cover/preamble restrictions can govern a later amount. Ordinary mentions
      // elsewhere on the page never supply an implicit class or investor population.
      const prefix = text.slice(0, m.index),
        firstMinimum =
          !/\bminimum\s+(?:(?:initial|additional|aggregate)\s+)?(?:capital\s+(?:contribution|commitment)|investment|subscription|commitment)\b/i.test(
            prefix,
          );
      const scopedPreamble =
        firstMinimum &&
        prefix
          .split('\n')
          .some((line) =>
            /^\s*(?:Class\s+\w+\s+investors?\s+only\b|(?:Initial|Subsequent|Final)\s+Closing\s+only\b|For\s+(?:approved\s+)?(?:entity\s+)?Investor\s+[^.]{1,80}\s+only\b)/i.test(
              line,
            ),
          );
      let scopeEvidence = null;
      if (scopedPreamble) {
        const inherited = scopeOf(prefix);
        for (const k of ['class', 'investor', 'closing', 'applicant', 'exception'])
          if (!localScope[k] && inherited[k]) {
            localScope[k] = inherited[k];
            scopeEvidence = sourceSpan(doc, p, 0, m.index, 'Explicit preamble applicability');
          }
      }
      if (!localScope.closing) localScope.closing = identity.closing;
      minimums.push({
        amount: Number(m[4].replaceAll(',', '')),
        currency: /EUR|€/.test(m[3]) ? 'EUR' : /GBP|£/.test(m[3]) ? 'GBP' : 'USD',
        contribution:
          m[1]?.toLowerCase() === 'additional'
            ? 'additional'
            : m[1]?.toLowerCase() === 'initial'
              ? 'initial'
              : 'unspecified',
        aggregate: m[1]?.toLowerCase() === 'aggregate',
        scope: localScope,
        fund,
        agreement,
        documentRole: identity.role,
        declaredVersion: identity.declaredVersion,
        provision: m[0],
        exceptionContext:
          /waiv|lesser|discretion|unless otherwise|express exception|replaces the standard|prevail/i.test(
            context + neighboring,
          )
            ? context + neighboring
            : null,
        exercised: localScope.exception,
        evidence: span,
        scopeEvidence,
        qualificationEvidence:
          neighboring && /waiv|lesser|discretion/i.test(neighboring)
            ? contextSpan(
                doc,
                doc.pages.find((x) => x.number === p.number + 1),
                0,
                Math.min(800, neighboring.length),
                'Continuation / exception context',
              )
            : null,
      });
    }
  }
  return { definitions, minimums, incorporations };
}
export function compatible(a, b) {
  return !disjoint(a.scope, b.scope) && !(a.fund && b.fund && a.fund !== b.fund);
}
