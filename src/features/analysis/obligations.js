import { blocksOf, contextSpan, normalize } from './structure.js';
import { scopeOf, disjoint } from './facts.js';
import { linkedSubscriptions } from './context.js';
import { writtenAmount } from './mechanical.js';

const qualified = (text) =>
  /\b(?:notwithstanding|supersedes?|replaces?|except\s+(?:that|as|for)|(?:shall|will)\s+(?:control|prevail)|extension\s+(?:is|has\s+been)\s+(?:granted|approved))\b/i.test(
    text,
  );
const number = '(?:\\d+|[a-z]+(?:[ -]+[a-z]+){0,3})';
const measurable = (text) => {
  if (/\bby\s+(?:\d|noon\b|midnight\b)/i.test(text)) return true;
  const duration = new RegExp(
    `\\b(?:within|no\\s+later\\s+than)\\s+(${number})\\s+(?:business\\s+|calendar\\s+)?(?:days?|hours?)\\b`,
    'gi',
  );
  return [...text.matchAll(duration)].some((m) => {
    const amount = m[1].replace(/\s+(?:business|calendar)$/i, '');
    const value = /^\d+$/.test(amount) ? Number(amount) : writtenAmount(amount);
    return Number.isSafeInteger(value) && value >= 0;
  });
};

// Typed obligations: compare only the same action, actor, object, clock trigger,
// day type and applicable source scope. No rule chooses a controlling value.
export function obligationChecks(documents, context) {
  const funding = [],
    checks = [];
  const active = documents.filter(
    (d) => context.documents.find((c) => c.documentId === d.id)?.status !== 'superseded',
  );
  for (const doc of active) {
    const blocks = blocksOf(doc);
    for (const page of doc.pages) {
      const pattern = new RegExp(
        `\\b(?:The|Each|An?)\\s+(Investor|Subscriber|Applicant)\\s+(?:must|shall)\\s+(?:fund|pay|remit)\\s+([^.;]{1,150}?)\\s+within\\s+(${number})\\s+(business|calendar)\\s+days?\\s+after\\s+(?:(?:receiving\\s+(?:the\\s+)?|receipt\\s+of\\s+(?:the\\s+)?)(acceptance\\s+notice|capital\\s+call\\s+notice)|(acceptance|closing))\\b`,
        'gi',
      );
      for (const m of page.text.matchAll(pattern)) {
        const value = /^\d+$/.test(m[3]) ? Number(m[3]) : writtenAmount(m[3]);
        if (!Number.isSafeInteger(value) || value < 0) continue;
        const evidence = contextSpan(doc, page, m.index, m.index + m[0].length);
        const block = blocks.find(
          (b) => b.page === page.number && b.span.start <= m.index && b.span.end > m.index,
        );
        funding.push({
          value,
          actor: normalize(m[1]),
          object: normalize(m[2]),
          unit: normalize(m[4]),
          anchor: m[5] ? `receipt of ${normalize(m[5])}` : normalize(m[6]),
          evidence,
          scope: scopeOf(evidence.text),
          governing: block?.sectionScope || block?.governing,
          qualified: qualified(evidence.text),
        });
      }
      for (const [subtype, pattern] of [
        [
          'Receipt cutoff',
          /\bapplications?\s+(?:(?:must|shall|should)\s+be\s+)?received\s+(promptly|as\s+soon\s+as\s+practicable)\b/gi,
        ],
        [
          'Processing deadline',
          /\b(?:will|shall|must)\s+be\s+(?:processed|reviewed)\s+within\s+(?:a\s+)?(reasonable\s+(?:period|time))\b/gi,
        ],
      ]) {
        for (const m of page.text.matchAll(pattern)) {
          const evidence = contextSpan(doc, page, m.index, m.index + m[0].length);
          const block = blocks.find(
            (b) => b.page === page.number && b.span.start <= m.index && b.span.end > m.index,
          );
          const phrase = m[1].replace(/\s+/g, ' ');
          const definition = new RegExp(`\\b${phrase}\\s+means\\s+([^;\\n]{1,200})`, 'i');
          const defined = blocks.some((b) => {
            if ((b.sectionScope || b.governing) !== (block?.sectionScope || block?.governing))
              return false;
            const match = b.text.match(definition);
            return match && measurable(match[1]);
          });
          const receipt = subtype === 'Receipt cutoff';
          // A measured processing interval does not define the receipt cutoff,
          // and a receipt date does not define the processing interval.
          const tail = page.text.slice(m.index + m[0].length, m.index + m[0].length + 180);
          const ownBound = tail.split(
            receipt ? /\b(?:will|shall|must)\s+be\s+(?:processed|reviewed)\b/i : /[.;]/,
          )[0];
          if (defined || measurable(ownBound)) continue;
          checks.push({
            type: 'Ambiguity',
            subtype,
            title: receipt
              ? 'Application receipt cutoff is unspecified'
              : 'Application processing deadline is unspecified',
            severity: 'review',
            evidence: [evidence],
            description: `The operational rule uses “${phrase}” without an objective ${receipt ? 'receipt cutoff' : 'processing interval'} established in this supplied scope.`,
            question: receipt
              ? 'What objective application receipt cutoff should the form enforce? Confirm the date/time, time zone and triggering event.'
              : 'What measurable processing deadline should be used? Confirm the interval, business/calendar day type and event that starts the clock.',
            identity: `${doc.id}:${block?.sectionScope || ''}:${subtype}:${normalize(evidence.section)}`,
            impact: receipt
              ? 'The intake form cannot calculate when an application is timely.'
              : 'The workflow cannot calculate a processing due date.',
          });
        }
      }
    }
  }
  for (let i = 0; i < funding.length; i++)
    for (let j = i + 1; j < funding.length; j++) {
      const a = funding[i],
        b = funding[j];
      const sameDocument = a.evidence.documentId === b.evidence.documentId;
      const shared = sameDocument
        ? a.governing === b.governing
        : linkedSubscriptions(context, a.evidence.documentId, b.evidence.documentId);
      if (
        !shared ||
        a.value === b.value ||
        a.qualified ||
        b.qualified ||
        disjoint(a.scope, b.scope) ||
        ['actor', 'object', 'unit', 'anchor'].some((k) => a[k] !== b[k])
      )
        continue;
      const values = [a, b].map((f) => `${f.value} ${f.unit} days after ${f.anchor}`);
      checks.push({
        type: 'Contradiction',
        subtype: 'Funding deadline',
        title: 'Funding deadlines differ',
        severity: 'review',
        evidence: [a.evidence, b.evidence],
        description: `The same funding obligation states ${values[0]} and ${values[1]}. Confirm applicability and any explicit exception before configuring the deadline.`,
        question: `Which funding deadline applies: ${values.join(' or ')}? Confirm the applicable investor, clock trigger and any exception.`,
        identity: `${[a.evidence.documentId, b.evidence.documentId].sort().join(':')}:${a.governing}:${a.actor}:${a.object}:${a.unit}:${a.anchor}:${[a.value, b.value].sort((x, y) => x - y).join(':')}`,
        impact: 'Funding due-date calculation has competing source periods.',
        facts: [a, b],
      });
    }
  return checks;
}
