// Presentation only: retain the original analysis, findings and readiness gates.
const sameLocation = (a, b) => a?.documentId === b?.documentId && a?.page === b?.page;
const copy = {
  'internal target missing': [
    'Referenced content not found',
    'Check the original or supply the referenced content.',
  ],
  'ambiguous target': [
    'Confirm the correct document',
    'Compare the possible matches with the cited passage.',
  ],
  'insufficient extraction coverage': [
    'Check the original document',
    'Some source text could not be read. Inspect the original before deciding whether content is missing.',
  ],
  'external document not supplied': [
    'Confirm whether this document is needed',
    'The document is mentioned but not supplied. Check whether it belongs in this package.',
  ],
};
export function documentReferences(analysis, documents, readiness) {
  const result = { attention: [], notes: [], matched: [] };
  for (const reference of analysis.references || []) {
    const evidence = reference.evidence;
    const linked = (analysis.findings || []).filter(
      (f) =>
        (reference.id && f.id === reference.id) ||
        (f.target === reference.target && f.evidence?.some((e) => sameLocation(e, evidence))),
    );
    const active = readiness
      ? linked.filter((f) =>
          readiness.blockers.some((b) => b.findingId === f.id || b.detectedFindingId === f.id),
        )
      : linked;
    const doc = documents.find(
      (d) => d.id === evidence?.documentId && d.version === evidence.documentVersion,
    );
    const page = doc?.pages.find((p) => p.number === evidence.page);
    const current =
      evidence?.text?.trim() &&
      page?.text.includes(evidence.text) &&
      !doc.rejected &&
      !doc.error &&
      !page.visualGap &&
      (!page.status || ['searchable text', 'likely blank'].includes(page.status));
    const taxLabel =
      reference.kind === 'legislative/tax form'
        ? evidence?.text.match(/^\s*(Schedule\s+[A-Za-z]-\d+)\b/i)?.[1]
        : null;
    const excluded =
      current &&
      taxLabel &&
      /\b(?:this|that)\s+(?:future\s+)?tax\s+form\s+is\s+not\s+a\s+required\s+subscription\s+attachment\b/i.test(
        evidence.text,
      );
    const item = {
      reference,
      label: taxLabel || reference.target,
      findingId: active[0]?.id || linked[0]?.id,
    };
    if (reference.classification === 'resolved') {
      result.matched.push({ ...item, status: 'Found in supplied documents' });
    } else if (active.length) {
      const [status, next] = copy[reference.classification] || [
        'Check this reference',
        'Inspect the cited source.',
      ];
      result.attention.push({ ...item, status, next });
    } else if (excluded) {
      result.notes.push({
        ...item,
        status: 'Not required for this package',
        next: 'The cited passage says this future tax form is not a required subscription attachment.',
      });
    } else if (readiness && linked.length) {
      result.notes.push({
        ...item,
        status: 'Review recorded',
        next: 'A review outcome is recorded for this reference. Open the finding to see the decision and its supporting evidence.',
      });
    } else {
      const [status, next] = copy[reference.classification] || [
        'Check this reference',
        'Inspect the cited source.',
      ];
      result.attention.push({ ...item, status, next });
    }
  }
  const grouped = new Map();
  for (const item of result.attention) {
    const key =
      item.findingId || `${item.label}:${item.reference.evidence.documentId}:${item.status}`;
    const prior = grouped.get(key);
    if (!prior) grouped.set(key, { ...item, mentions: [item.reference] });
    else if (
      !prior.mentions.some(
        (r) =>
          sameLocation(r.evidence, item.reference.evidence) &&
          r.evidence.text === item.reference.evidence.text,
      )
    ) {
      prior.mentions.push(item.reference);
    }
  }
  result.attention = [...grouped.values()];
  return result;
}

export function documentSections(inventory, references) {
  const groups = new Map();
  for (const item of inventory || []) {
    // A line-wrapped tax-form mention is not an attachment heading.
    const taxMention = references.some(
      (r) =>
        r.kind === 'legislative/tax form' &&
        r.target === item.title &&
        sameLocation(r.evidence, item.evidence) &&
        r.evidence.span?.start >= item.evidence.span?.start &&
        r.evidence.span?.start < item.evidence.span?.end,
    );
    if (taxMention) continue;
    const key = `${item.evidence.documentId}:${item.scope}:${item.kind}:${item.title}`;
    const prior = groups.get(key);
    if (prior) prior.occurrences.push(item);
    else groups.set(key, { ...item, occurrences: [item] });
  }
  return [...groups.values()];
}
