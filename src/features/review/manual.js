import { sourceSpan } from '../analysis/structure.js';

export function createManualIssue(documents, input) {
  const title = input.title?.trim(),
    question = input.question?.trim();
  if (!title || !question) throw new Error('Add an issue title and a clarification question.');
  if (!input.sources?.length) throw new Error('Attach at least one source quotation.');
  const evidence = input.sources.map((s) => {
    const d = documents.find((d) => d.id === s.documentId),
      p = d?.pages.find((p) => p.number === Number(s.page));
    if (!d || !p || (p.status && !['searchable text', 'likely blank'].includes(p.status)))
      throw new Error('Choose a readable source page.');
    const quote = s.quote?.trim(),
      start = quote ? p.text.indexOf(quote) : -1;
    if (start < 0) throw new Error('Each quotation must match the selected source text exactly.');
    return sourceSpan(d, p, start, start + quote.length, 'Analyst-cited requirement');
  });
  return {
    id: `manual-${crypto.randomUUID()}`,
    manual: true,
    type: 'Manual review',
    category: input.category || 'Configuration requirement',
    subtype: 'Analyst-raised issue',
    title,
    question,
    evidence,
    evidenceVersion: 2,
    severity: ['blocking', 'review', 'advisory'].includes(input.severity)
      ? input.severity
      : 'review',
    description:
      input.description?.trim() || 'An analyst identified a requirement that needs clarification.',
    impact:
      input.impact?.trim() ||
      'Confirm the requirement before configuring the affected form behavior.',
    certainty: 'Analyst-raised; requires independent review',
    rule: 'Added by analyst with literal source evidence',
    uncertainty: 'Applicability and legal effect require confirmation',
    status: 'open',
    note: '',
    includeInReport: false,
    history: [{ event: 'Analyst added source-cited issue', time: new Date().toISOString() }],
  };
}

export function reconcileManualIssue(finding, documents = []) {
  const stale = finding.evidence.some((e) => {
    const d = documents.find((d) => d.id === e.documentId),
      p = d?.pages.find((p) => p.number === e.page);
    return (
      !d ||
      !p ||
      (d.version || 1) !== e.documentVersion ||
      (p.status && !['searchable text', 'likely blank'].includes(p.status)) ||
      p.text.slice(e.span?.start, e.span?.end) !== e.text
    );
  });
  if (!stale || finding.status === 'needs-verification') return finding;
  return {
    ...finding,
    status: 'needs-verification',
    history: [
      ...(finding.history || []),
      {
        event: 'Manual issue source changed; verify against the new document',
        time: new Date().toISOString(),
        previousStatus: finding.status,
        evidence: finding.evidence,
      },
    ],
  };
}

export function refreshManualIssue(finding, documents, input) {
  const refreshed = createManualIssue(documents, input);
  return {
    ...finding,
    ...refreshed,
    id: finding.id,
    note: finding.note,
    includeInReport: finding.includeInReport,
    history: [
      ...(finding.history || []),
      {
        event: 'Analyst rechecked and updated issue sources; review reopened',
        time: new Date().toISOString(),
        previousStatus: finding.status,
        evidence: finding.evidence,
      },
    ],
  };
}
