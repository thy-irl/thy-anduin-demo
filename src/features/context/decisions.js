import { sourceState } from './intake.js';

// Browser-local declarations are never proof of the named person's identity.
export const decisionActorWarning =
  'Unverified actor attribution: names are entered by the user; recorded approval is not authenticated.';
const text = (value) =>
  typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim();
const list = (value) => [
  ...new Set(
    (Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [])
      .map(text)
      .filter(Boolean),
  ),
];
const object = (value) =>
  value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const versions = (value) =>
  Object.fromEntries(
    Object.entries(object(value))
      .filter(([, v]) => Number.isInteger(Number(v)) && Number(v) > 0)
      .map(([id, v]) => [id, Number(v)]),
  );
const choice = (value, allowed, fallback) => (allowed.includes(value) ? value : fallback);
const citation = (value) => ({
  documentId: text(value?.documentId),
  documentVersion: value?.documentVersion ?? '',
  page: value?.page ?? '',
  quote: typeof value?.quote === 'string' ? value.quote : '',
});
const applicability = (value) => ({
  ...object(value),
  vehicle: text(value?.vehicle),
  investorRoute: text(value?.investorRoute),
  documentIds: list(value?.documentIds),
  documentVersions: versions(value?.documentVersions),
  conditions: text(value?.conditions),
});
const approval = (value) =>
  value && typeof value === 'object'
    ? {
        ...value,
        recordedBy: text(value.recordedBy),
        approvedAt: text(value.approvedAt),
        rationale: text(value.rationale),
        applicability: applicability(value.applicability),
      }
    : null;
const clone = (value) => JSON.parse(JSON.stringify(value));

export function normalizeDecision(input = {}) {
  const row = object(input),
    response = object(row.response);
  return {
    ...row,
    id: text(row.id),
    title: text(row.title),
    answer: text(row.answer),
    owner: text(row.owner),
    status: choice(row.status, ['proposed', 'confirmed'], 'proposed'),
    findingIds: list(row.findingIds),
    source: citation(row.source),
    documentVersions: versions(row.documentVersions),
    issueType: choice(row.issueType, ['legal', 'client', 'internal'], 'legal'),
    routingStatus: choice(
      row.routingStatus,
      ['draft', 'awaiting-response', 'response-recorded', 'approved', 'rejected'],
      'draft',
    ),
    question: text(row.question),
    assignedTo: text(row.assignedTo),
    askedAt: text(row.askedAt),
    response: {
      ...response,
      text: text(response.text),
      author: text(response.author),
      channel: text(response.channel),
      receivedAt: text(response.receivedAt),
      reference: text(response.reference),
      recordedBy: text(response.recordedBy),
    },
    approval: approval(row.approval),
    approvalDraft: approval(row.approvalDraft),
    impactedTaskIds: list(row.impactedTaskIds),
    impactDisposition: choice(
      row.impactDisposition,
      ['unassessed', 'no-change', 'scope-change'],
      'unassessed',
    ),
    impactRationale: text(row.impactRationale),
    history: Array.isArray(row.history) ? clone(row.history) : [],
  };
}

const evidenceFor = (finding) =>
  finding.status === 'resolved' && finding.resolutionEvidence?.length
    ? finding.resolutionEvidence
    : finding.evidence || [];
const evidenceSource = (item) => ({
  documentId: item.documentId,
  documentVersion: item.documentVersion,
  page: item.page,
  quote: item.text ?? item.quote,
});
function linkedSources(row, context) {
  const findings = context.findings || [],
    linked = row.findingIds.map((id) => findings.find((f) => f.id === id)).filter(Boolean),
    evidence = linked.flatMap(evidenceFor),
    scope = row.approvalDraft?.applicability || row.approval?.applicability || applicability();
  return {
    linked,
    evidence,
    scope,
    ids: list([
      row.source.documentId,
      ...Object.keys(row.documentVersions),
      ...evidence.map((e) => e.documentId),
      ...scope.documentIds,
    ]),
  };
}

// Freeze the decision's meaning and every linked citation, independently of the
// editor's refreshable dependency versions. A normal save cannot refresh this.
function snapshot(row, context) {
  const { linked } = linkedSources(row, context);
  return {
    title: row.title,
    answer: row.answer,
    owner: row.owner,
    issueType: row.issueType,
    question: row.question,
    assignedTo: row.assignedTo,
    askedAt: row.askedAt,
    response: row.response,
    source: row.source,
    documentVersions: row.documentVersions,
    findingIds: row.findingIds,
    findings: linked.map((f) => ({ id: f.id, evidence: evidenceFor(f).map(evidenceSource) })),
    applicability:
      row.approvalDraft?.applicability || row.approval?.applicability || applicability(),
    impactedTaskIds: row.impactedTaskIds,
    impactDisposition: row.impactDisposition,
    impactRationale: row.impactRationale,
  };
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function decisionApprovalErrors(input, context = {}) {
  const row = normalizeDecision(input),
    documents = context.documents || [],
    { linked, evidence, scope, ids } = linkedSources(row, context),
    errors = [];
  if (!row.question) errors.push('Record the neutral question being answered.');
  for (const [key, label] of [
    ['text', 'response text'],
    ['author', 'response author'],
    ['channel', 'response channel'],
    ['receivedAt', 'response received date'],
    ['reference', 'response reference'],
    ['recordedBy', 'staff recorder'],
  ])
    if (!row.response[key]) errors.push(`Record ${label}.`);
  if (row.response.receivedAt && !Number.isFinite(Date.parse(row.response.receivedAt)))
    errors.push('Use a valid response received date.');
  for (const [key, label] of [
    ['recordedBy', 'internal approval recorder'],
    ['approvedAt', 'internal approval date'],
    ['rationale', 'internal approval rationale'],
  ])
    if (!row.approval?.[key]) errors.push(`Record ${label}.`);
  if (row.approval?.approvedAt && !Number.isFinite(Date.parse(row.approval.approvedAt)))
    errors.push('Use a valid internal approval date.');
  if (!scope.vehicle || !scope.investorRoute)
    errors.push('Record the applicable vehicle and investor route.');
  if (!scope.documentIds.length)
    errors.push('Select the source documents applicable to this approval.');
  if (sourceState(row.source, documents).status !== 'current')
    errors.push('Verify an exact supporting quote against a readable current source.');
  if (linked.length !== row.findingIds.length)
    errors.push('Restore or remove unavailable linked findings.');
  if (
    linked.some((f) => !evidenceFor(f).length) ||
    evidence.some((e) => sourceState(evidenceSource(e), documents).status !== 'current')
  )
    errors.push('Recheck all linked finding evidence against readable current sources.');
  for (const id of ids) {
    const doc = documents.find((d) => d.id === id),
      version = Number(doc?.version || 1);
    if (!doc || row.documentVersions[id] !== version)
      errors.push(`Recheck the saved dependency version for ${id}.`);
    if (!scope.documentIds.includes(id) || scope.documentVersions[id] !== version)
      errors.push(`Record applicability and current source version for ${id}.`);
    if ((context.metadataIssues || []).some((issue) => issue.documentId === id))
      errors.push(`Resolve the disputed source identity for ${id}.`);
    if (
      (context.sourceDocuments || []).some(
        (source) => source.documentId === id && source.status === 'superseded',
      )
    )
      errors.push(`Recheck the superseded source ${id}.`);
    if (
      doc?.rejected ||
      doc?.pages?.some((page) =>
        /OCR required|extraction error|unreadable/i.test(page.status || ''),
      )
    )
      errors.push(`Review unreadable source coverage for ${id}.`);
  }
  return [...new Set(errors)];
}

export function decisionWorkflowState(input, context = {}) {
  const row = normalizeDecision(input),
    errors = decisionApprovalErrors(row, context),
    hasApproval = !!row.approval?.snapshot;
  const matches = hasApproval && same(row.approval.snapshot, snapshot(row, context));
  const effectiveRoutingStatus =
    row.routingStatus === 'approved'
      ? hasApproval && matches && !errors.length && !row.approvalReconfirmationRequired
        ? 'approved'
        : 'needs-reconfirmation'
      : row.routingStatus;
  return {
    effectiveRoutingStatus,
    approvalErrors: errors,
    actorAttribution: 'unverified',
    actorWarning: decisionActorWarning,
    approvalCurrent: effectiveRoutingStatus === 'approved',
  };
}

export function saveDecisionResolution(previous, input, context = {}, options = {}) {
  const prior = previous ? normalizeDecision(previous) : null,
    row = normalizeDecision(input),
    candidate = clone(
      row.approvalDraft && prior && same(row.approval, prior.approval)
        ? row.approvalDraft
        : row.approval || row.approvalDraft,
    ),
    recordedAt = options.recordedAt || new Date().toISOString();
  if (options.recordResponse) {
    if (!row.response.text) throw new Error('Enter the response text before saving a response.');
    if (row.routingStatus !== 'approved') row.routingStatus = 'response-recorded';
  }
  row.approval = candidate;
  row.approvalDraft = null;
  row.history = prior ? clone(prior.history) : [];
  const changed = prior && !same(snapshot(prior, context), snapshot(row, context));
  const priorStale =
    prior?.approval && decisionWorkflowState(prior, context).effectiveRoutingStatus !== 'approved';
  if (
    prior &&
    (changed || options.recordApproval || (priorStale && !prior.approvalReconfirmationRequired)) &&
    prior.approval
  )
    row.history.push({
      recordedAt,
      reason: options.recordApproval
        ? 'Explicit internal approval recorded again'
        : 'Decision or evidence changed; prior response and approval retained',
      response: clone(prior.response),
      source: clone(prior.source),
      documentVersions: clone(prior.documentVersions),
      approval: clone(prior.approval),
    });
  if (options.recordApproval) {
    row.approval = candidate;
    row.approvalDraft = null;
    const errors = decisionApprovalErrors(row, context);
    if (errors.length) throw new Error(errors.join(' '));
    row.approval = { ...row.approval, snapshot: clone(snapshot(row, context)) };
    row.approvalReconfirmationRequired = false;
    row.routingStatus = 'approved';
  } else {
    row.approval = prior?.approval ? clone(prior.approval) : null;
    row.approvalDraft = candidate;
    row.approvalReconfirmationRequired = !!(
      prior?.approvalReconfirmationRequired ||
      (prior?.approval && (changed || priorStale))
    );
    if (row.routingStatus === 'approved' && !prior?.approval)
      row.routingStatus = row.response.text ? 'response-recorded' : 'draft';
  }
  return row;
}

export function exportDecisionQuestion(input, documents = []) {
  const row = normalizeDecision(input),
    doc = documents.find((d) => d.id === row.source.documentId),
    state = sourceState(row.source, documents);
  return `# Clarification question — ${row.title || 'Untitled issue'}\n\nManual export only; not sent. No controlling term or legal approval is selected.\n${decisionActorWarning}\n\nQuestion: ${row.question || 'Question not recorded'}\nAssigned to: ${row.assignedTo || 'Unassigned'}\nIssue type: ${row.issueType}\nAsked date: ${row.askedAt || 'Not recorded'}\nRelated finding IDs: ${row.findingIds.join(', ') || 'None'}\n\nSupporting source: ${doc?.name || row.source.documentId || 'Not supplied'}, version ${row.source.documentVersion || 'unknown'}, page/paragraph ${row.source.page || 'unknown'} (${state.status})\n> ${row.source.quote.replace(/\n/g, '\n> ')}\n\nSource dependency versions: ${
    Object.entries(row.documentVersions)
      .map(([id, v]) => `${documents.find((d) => d.id === id)?.name || id}: version ${v}`)
      .join('; ') || 'Not recorded'
  }\n\nPlease identify the applicable vehicle, investor route, source versions and any conditions in your response.\n`;
}
