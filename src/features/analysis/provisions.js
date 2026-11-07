import { contextSpan, normalize, scopeAt } from './structure.js';
import { scopeOf, disjoint } from './facts.js';
import { linkedSubscriptions, packageContext } from './context.js';

// Narrow comparisons of explicit provisions. These do not infer precedence or legal effect.
const qualifies = (text) =>
  /\b(?:notwithstanding|supersedes?|replaces?|except\s+(?:that|as|for)|(?:shall|will)\s+(?:control|prevail)|waived\s+for|extension\s+(?:is|has\s+been)\s+(?:granted|approved))\b/i.test(
    text,
  );
export function provisionChecks(input, context) {
  const documents = Array.isArray(input) ? input : [input];
  context ||= packageContext(documents);
  const laws = [],
    withdrawals = [],
    checks = [];
  for (const doc of documents.filter(
    (doc) => context.documents.find((item) => item.documentId === doc.id)?.status !== 'superseded',
  ))
    for (const page of doc.pages) {
      const make = (m, value) => {
        const evidence = contextSpan(doc, page, m.index, m.index + m[0].length);
        return {
          value,
          evidence,
          governing: scopeAt(doc, page.number),
          scope: scopeOf(evidence.text),
          qualified: qualifies(evidence.text),
        };
      };
      for (const m of page.text.matchAll(
        /\bthis\s+(?:entire\s+)?agreement\s+(?:is|shall\s+be)\s+governed\s+(?:exclusively\s+)?by\s+(?:the\s+)?laws?\s+of\s+([^.;]{2,100})/gi,
      )) {
        const value = m[1]
          .split(/\b(?:without|excluding|except|and|as|which|that|notwithstanding)\b/i)[0]
          .trim()
          .replace(/\s+/g, ' ')
          .replace(/^(?:the\s+)?(?:state|commonwealth)\s+of\s+/i, '');
        // Abstain on unconstrained prose rather than treating an arbitrary sentence tail as a jurisdiction.
        if (!/^[A-Za-z][A-Za-z ]{1,45}$/.test(value) || value.split(/\s+/).length > 4) continue;
        laws.push(make(m, value));
      }
      for (const m of page.text.matchAll(
        /\b(?:An?|Each|The)\s+Investor\s+may\s+withdraw\s+(?:its|their|the)\s+subscription\s+(?:by\s+written\s+notice\s+received\s+)?within\s+(\d+)\s+(business|calendar)\s+days?\s+after\s+(acceptance|admission|closing)\b/gi,
      )) {
        withdrawals.push({
          ...make(m, Number(m[1])),
          unit: m[2].toLowerCase(),
          anchor: m[3].toLowerCase(),
        });
      }
    }
  for (const [subtype, items] of [
    ['Governing law', laws],
    ['Withdrawal period', withdrawals],
  ]) {
    for (let i = 0; i < items.length; i++)
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i],
          b = items[j];
        const sameDocument = a.evidence.documentId === b.evidence.documentId;
        const sharedScope = sameDocument
          ? a.governing === b.governing
          : linkedSubscriptions(context, a.evidence.documentId, b.evidence.documentId);
        if (
          !sharedScope ||
          a.qualified ||
          b.qualified ||
          disjoint(a.scope, b.scope) ||
          normalize(String(a.value)) === normalize(String(b.value))
        )
          continue;
        if (subtype === 'Withdrawal period' && (a.unit !== b.unit || a.anchor !== b.anchor))
          continue;
        const law = subtype === 'Governing law',
          values = law
            ? [a.value, b.value]
            : [
                `${a.value} ${a.unit} days after ${a.anchor}`,
                `${b.value} ${b.unit} days after ${b.anchor}`,
              ];
        checks.push({
          type: 'Contradiction',
          subtype,
          title: law ? 'Governing-law statements differ' : 'Withdrawal periods differ',
          severity: 'review',
          evidence: [a.evidence, b.evidence],
          description: `The cited provisions state ${values[0]} and ${values[1]} within the same supplied agreement scope. Applicability, exceptions and precedence require confirmation.`,
          question: law
            ? 'Which governing-law statement should be used in this digital agreement? Confirm the scope and any precedence provision.'
            : `Which withdrawal period should the form display: ${values.join(' or ')}? Confirm applicability and any extension.`,
          identity: `${sameDocument ? a.evidence.documentId : [a.evidence.documentId, b.evidence.documentId].sort().join(':')}:${sameDocument ? a.governing : 'incorporated subscription'}:${subtype}:${values.map(normalize).sort().join(':')}`,
          impact: law
            ? 'The governing-law wording displayed in the digital agreement has competing source values.'
            : `Withdrawal deadline calculation has competing periods: ${values.join(' versus ')}.`,
          certainty: 'Explicit provision difference; applicability requires reviewer confirmation',
        });
      }
  }
  return checks;
}
