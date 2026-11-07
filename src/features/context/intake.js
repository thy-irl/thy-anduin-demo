import { normalizeDecision, decisionWorkflowState } from './decisions.js';
// Reviewer-entered intake context is source-bound working context, not legal authority.
const value = (input) =>
  typeof input === 'string' ? input.trim() : input == null ? '' : String(input).trim();
const list = (input) => [
  ...new Set(
    (Array.isArray(input) ? input : typeof input === 'string' ? input.split(',') : [])
      .map(value)
      .filter(Boolean),
  ),
];
const choice = (input, allowed, fallback) => (allowed.includes(input) ? input : fallback);
const source = (input) => ({
  documentId: value(input?.documentId),
  documentVersion: input?.documentVersion ?? '',
  page: input?.page ?? '',
  quote: typeof input?.quote === 'string' ? input.quote : '',
});
const versions = (input) =>
  Object.fromEntries(
    Object.entries(input && typeof input === 'object' && !Array.isArray(input) ? input : {})
      .filter(([, version]) => Number.isInteger(Number(version)) && Number(version) > 0)
      .map(([id, version]) => [id, Number(version)]),
  );
const linkProvenance = (row) =>
  row?.linkProvenance
    ? {
        actor: value(row.linkProvenance.actor),
        reason: value(row.linkProvenance.reason),
        recordedAt: value(row.linkProvenance.recordedAt),
      }
    : null;
const rows = (input, kind, convert) =>
  (Array.isArray(input) ? input : [])
    .filter((row) => row && typeof row === 'object')
    .map((row, index) => ({
      ...convert(row),
      id: value(row.id) || `${kind}-${index + 1}`,
      source: source(row.source),
      ...(linkProvenance(row) ? { linkProvenance: linkProvenance(row) } : {}),
    }));

const normalizedTasks = (input) =>
  rows(input, 'task', (row) => ({
    title: value(row.title),
    owner: value(row.owner),
    status: choice(row.status, ['not-started', 'in-progress', 'done'], 'not-started'),
    documentIds: list(row.documentIds),
    documentVersions: versions(row.documentVersions),
    findingIds: list(row.findingIds),
    fieldIds: list(row.fieldIds),
    rule: value(row.rule),
    testPlan: value(row.testPlan),
  }));

export function normalizeIntakeContext(input = {}) {
  const context = input && typeof input === 'object' ? input : {};
  return {
    schemaVersion: 1,
    documents: Object.fromEntries(
      Object.entries(
        context.documents &&
          typeof context.documents === 'object' &&
          !Array.isArray(context.documents)
          ? context.documents
          : {},
      )
        .filter(([, row]) => row && typeof row === 'object')
        .map(([id, row]) => [
          id,
          {
            fund: value(row.fund),
            role: value(row.role),
            declaredVersion: value(row.declaredVersion),
            closing: value(row.closing),
            parentDocumentId: value(row.parentDocumentId),
            status: choice(row.status, ['current', 'reference', 'superseded'], 'current'),
            source: source(row.source),
          },
        ]),
    ),
    applicability: rows(context.applicability, 'scope', (row) => ({
      label: value(row.label),
      documentIds: list(row.documentIds),
      documentVersions: versions(row.documentVersions),
      investorType: value(row.investorType),
      shareClass: value(row.shareClass),
      closing: value(row.closing),
      currency: value(row.currency),
      contribution: value(row.contribution),
      exception: value(row.exception),
    })),
    decisions: rows(context.decisions, 'decision', normalizeDecision),
    // Keep retired implementation plans unchanged as inactive browser history.
    tasks: Array.isArray(context.tasks) ? structuredClone(context.tasks) : [],
    requirements: rows(context.requirements, 'requirement', (row) => ({
      label: value(row.label),
      relationship: choice(row.relationship, ['attached', 'external', 'out-of-scope'], 'attached'),
      documentId: value(row.documentId),
      owner: value(row.owner),
      check: choice(row.check, ['document', 'field', 'version', 'alias', 'vocabulary'], 'document'),
      aliases: list(row.aliases),
      expectedVersion: value(row.expectedVersion),
      canonicalName: value(row.canonicalName),
      partyRole: value(row.partyRole),
      investorType: value(row.investorType),
      shareClass: value(row.shareClass),
    })),
  };
}

// Deduplicating a question must not orphan configuration work or counsel
// records. Approval snapshots remain untouched and must be checked again
// against the changed finding/evidence group by the normal approval gates.
export function reconcileFindingLinks(input, findings) {
  const context = normalizeIntakeContext(input);
  const aliases = new Map(
    findings.flatMap((f) => (f.legacyFindingIds || []).map((id) => [id, f.id])),
  );
  const relink = (row) => ({
    ...row,
    findingIds: [...new Set(row.findingIds.map((id) => aliases.get(id) || id))],
  });
  return { ...context, tasks: context.tasks, decisions: context.decisions.map(relink) };
}

function dependencyState(documentIds, snapshots, documents) {
  const ids = [...new Set(documentIds.filter(Boolean))],
    missingDocumentIds = ids.filter((id) => !documents.some((doc) => doc.id === id)),
    missingVersionIds = ids.filter((id) => !snapshots[id]),
    changedDocumentIds = ids.filter((id) => {
      const doc = documents.find((doc) => doc.id === id);
      return doc && snapshots[id] && snapshots[id] !== Number(doc.version || 1);
    });
  const status = missingDocumentIds.length
    ? 'missing'
    : changedDocumentIds.length
      ? 'stale'
      : missingVersionIds.length
        ? 'unverified'
        : 'current';
  const reason =
    status === 'missing'
      ? 'A linked source document is missing.'
      : status === 'stale'
        ? 'A linked document version changed. Recheck the complete dependency set and save the entry again.'
        : status === 'unverified'
          ? 'Check the linked source versions and save this entry to record its dependency snapshot.'
          : 'All linked document versions match the versions checked when this entry was saved.';
  return { status, reason, missingDocumentIds, missingVersionIds, changedDocumentIds };
}

export function sourceState(input, documents = []) {
  const citation = source(input);
  if (!citation.documentId)
    return {
      status: 'unverified',
      reason: 'Add a source document, version, page or paragraph, and literal quote.',
    };
  const doc = documents.find((doc) => doc.id === citation.documentId);
  if (!doc)
    return { status: 'missing', reason: 'The cited source document is not in this package.' };
  if (citation.documentVersion === '' || citation.page === '' || !citation.quote.trim())
    return {
      status: 'unverified',
      reason: 'Source version, page or paragraph, and literal quote are required.',
    };
  if (String(citation.documentVersion) !== String(doc.version || 1))
    return {
      status: 'stale',
      reason: `Cited version ${citation.documentVersion}; current source version is ${doc.version || 1}. Recheck the context.`,
    };
  const page = doc.pages?.find((page) => String(page.number) === String(citation.page));
  if (!page)
    return { status: 'stale', reason: 'The cited page or paragraph is no longer available.' };
  if (doc.rejected || /OCR required|extraction error|unreadable/i.test(page.status || ''))
    return {
      status: 'unverified',
      reason: 'The cited source cannot be verified from readable extracted text.',
    };
  if (!page.text?.includes(citation.quote))
    return {
      status: 'stale',
      reason: 'The literal quote no longer matches the cited page or paragraph.',
    };
  return {
    status: 'current',
    reason:
      'The literal quote matches the cited source version. Reviewer interpretation still requires verification.',
  };
}

export function operationalContext(pkg, analysis = {}) {
  const documents = pkg.documents || [],
    intakeContext = normalizeIntakeContext(pkg.intakeContext),
    findings = pkg.findings || analysis.findings || [],
    lookup = new Map(findings.map((f) => [f.id, f]));
  const withSource = (row) => ({
    ...row,
    sourceState: sourceState(row.source, documents),
    contextType: 'Human-entered context; does not establish legal precedence',
  });
  const evidenceFor = (finding) =>
    finding.status === 'resolved' && finding.resolutionEvidence?.length
      ? finding.resolutionEvidence
      : finding.evidence || [];
  const staleEvidence = (evidence) =>
    evidence.some(
      (item) =>
        sourceState(
          {
            documentId: item.documentId,
            documentVersion: item.documentVersion,
            page: item.page,
            quote: item.text,
          },
          documents,
        ).status !== 'current',
    );
  const documentRows = Object.entries(intakeContext.documents).map(([documentId, row]) => ({
    ...withSource(row),
    documentId,
    name: documents.find((doc) => doc.id === documentId)?.name || 'Source not supplied',
    effectiveContext:
      analysis.context?.documents?.find((doc) => doc.documentId === documentId) || null,
  }));
  const issuesFor = (ids) => [
    ...new Set(
      (analysis.context?.metadataIssues || [])
        .filter((issue) => ids.includes(issue.documentId))
        .map((issue) => issue.documentId),
    ),
  ];
  const applicability = intakeContext.applicability.map((row) => {
    const result = withSource(row),
      dependencies = dependencyState(
        [...row.documentIds, row.source.documentId],
        row.documentVersions,
        documents,
      ),
      identityIssueDocumentIds = issuesFor(row.documentIds);
    return {
      ...result,
      dependencyState: dependencies,
      missingDocumentIds: dependencies.missingDocumentIds,
      identityIssueDocumentIds,
      effectiveStatus:
        result.sourceState.status === 'current' &&
        dependencies.status === 'current' &&
        !identityIssueDocumentIds.length
          ? 'current'
          : 'needs-review',
      use: 'Reviewer applicability context; does not suppress detected differences',
    };
  });
  const decisions = intakeContext.decisions.map((row) => {
    const result = withSource(row),
      missingFindingIds = row.findingIds.filter((id) => !lookup.has(id)),
      linkedFindings = row.findingIds.map((id) => lookup.get(id)).filter(Boolean),
      evidence = linkedFindings.flatMap(evidenceFor),
      dependencies = dependencyState(
        [...evidence.map((item) => item.documentId), row.source.documentId],
        row.documentVersions,
        documents,
      ),
      staleFindingIds = linkedFindings
        .filter((finding) => !evidenceFor(finding).length || staleEvidence(evidenceFor(finding)))
        .map((finding) => finding.id),
      identityIssueDocumentIds = issuesFor([
        ...evidence.map((item) => item.documentId),
        row.source.documentId,
      ]);
    return {
      ...result,
      ...decisionWorkflowState(row, {
        documents,
        findings,
        tasks: intakeContext.tasks,
        metadataIssues: analysis.context?.metadataIssues || [],
        sourceDocuments: analysis.context?.documents || [],
      }),
      effectiveStatus:
        row.status === 'confirmed' &&
        result.sourceState.status === 'current' &&
        dependencies.status === 'current' &&
        row.answer &&
        row.owner &&
        !missingFindingIds.length &&
        !staleFindingIds.length &&
        !identityIssueDocumentIds.length
          ? 'confirmed'
          : row.status === 'confirmed'
            ? 'needs-reconfirmation'
            : 'proposed',
      missingFindingIds,
      staleFindingIds,
      identityIssueDocumentIds,
      dependencyState: dependencies,
      use: 'Recorded answer and internal approval are separate; linked findings retain their review disposition',
    };
  });
  const tasks = normalizedTasks(intakeContext.tasks).map((row) => {
    const result = withSource(row),
      linkedFindings = row.findingIds.map((id) => lookup.get(id)).filter(Boolean),
      openFindingIds = linkedFindings
        .filter((f) => !['resolved', 'dismissed'].includes(f.status))
        .map((f) => f.id),
      missingFindingIds = row.findingIds.filter((id) => !lookup.has(id)),
      staleFindingIds = linkedFindings
        .filter((finding) => staleEvidence(evidenceFor(finding)))
        .map((finding) => finding.id),
      taskDocumentIds = [
        ...new Set(
          [
            ...row.documentIds,
            ...linkedFindings.flatMap((finding) =>
              evidenceFor(finding).map((item) => item.documentId),
            ),
            row.source.documentId,
          ].filter(Boolean),
        ),
      ],
      dependencies = dependencyState(taskDocumentIds, row.documentVersions, documents),
      missingDocumentIds = dependencies.missingDocumentIds,
      supersededDocumentIds = taskDocumentIds.filter((id) =>
        analysis.context?.documents?.some(
          (doc) => doc.documentId === id && doc.status === 'superseded',
        ),
      ),
      identityIssueDocumentIds = issuesFor(taskDocumentIds);
    const readiness = openFindingIds.length
      ? 'blocked'
      : missingFindingIds.length ||
          staleFindingIds.length ||
          missingDocumentIds.length ||
          supersededDocumentIds.length ||
          identityIssueDocumentIds.length ||
          dependencies.status !== 'current' ||
          result.sourceState.status !== 'current' ||
          !row.title ||
          !row.owner ||
          !row.documentIds.length ||
          !row.documentIds.includes(row.source.documentId) ||
          !row.fieldIds.length ||
          !row.rule ||
          !row.testPlan
        ? 'needs-review'
        : row.status === 'done'
          ? 'done'
          : 'ready';
    return {
      ...result,
      linkedFindings: linkedFindings.map(({ id, title, status, severity }) => ({
        id,
        title,
        status,
        severity,
      })),
      openFindingIds,
      missingFindingIds,
      staleFindingIds,
      missingDocumentIds,
      supersededDocumentIds,
      identityIssueDocumentIds,
      dependencyState: dependencies,
      readiness,
      reason: openFindingIds.length
        ? 'Hold this explicitly linked task until its open findings are reviewed.'
        : identityIssueDocumentIds.length
          ? 'Verify disputed document identity or parent links before using this task.'
          : staleFindingIds.length
            ? 'Recheck linked issue evidence against the current source before using this task.'
            : dependencies.status !== 'current'
              ? dependencies.reason
              : readiness === 'needs-review'
                ? 'Verify the source, dependencies, field mapping, rule and test plan before starting.'
                : readiness === 'done'
                  ? 'Marked done by the reviewer; recorded dependencies are clear.'
                  : 'No unresolved linked finding; source, field mapping, rule and test plan are recorded. This is a reviewer work queue, not launch approval.',
    };
  });
  const requirements = intakeContext.requirements.map((row) => {
    const result = withSource(row),
      doc = documents.find((doc) => doc.id === row.documentId),
      superseded = analysis.context?.documents?.some(
        (item) => item.documentId === row.documentId && item.status === 'superseded',
      );
    return {
      ...result,
      availability:
        row.relationship === 'attached'
          ? ['alias', 'vocabulary'].includes(row.check)
            ? 'configured'
            : doc && !superseded
              ? 'supplied'
              : row.check === 'document' &&
                  result.sourceState.status === 'current' &&
                  analysis.checkResults &&
                  !analysis.checkResults.some((r) => r.requirementId === row.id) &&
                  !analysis.findings?.some(
                    (f) =>
                      f.requirementIds?.includes(row.id) ||
                      f.identity === `missing_document:requirement:${row.id}`,
                  )
                ? 'matched in package'
                : 'missing'
          : 'declared ' + row.relationship,
      use: 'Reviewer package inventory; does not resolve detected source references automatically',
    };
  });
  const blockers = tasks.filter((row) => row.readiness === 'blocked'),
    readyWork = tasks.filter((row) => row.readiness === 'ready'),
    unverified = [
      ...documentRows,
      ...applicability,
      ...decisions,
      ...tasks,
      ...requirements,
    ].filter(
      (row) =>
        row.sourceState.status !== 'current' ||
        (row.dependencyState && row.dependencyState.status !== 'current') ||
        row.identityIssueDocumentIds?.length ||
        row.staleFindingIds?.length,
    );
  return {
    intakeContext,
    documents: documentRows,
    applicability,
    decisions,
    tasks,
    requirements,
    blockers,
    readyWork,
    unverified,
    summary: {
      blockers: blockers.length,
      readyWork: readyWork.length,
      needsReview: tasks.filter((row) => row.readiness === 'needs-review').length,
      unverified: unverified.length,
      stale: unverified.filter(
        (row) =>
          row.sourceState.status === 'stale' ||
          row.dependencyState?.status === 'stale' ||
          row.staleFindingIds?.length,
      ).length,
      missingRequirements: requirements.filter((row) => row.availability === 'missing').length,
      scope: 'Only explicitly mapped tasks are assessed. Other work is unassessed.',
    },
  };
}

// Review projections deliberately exclude inactive implementation history.
// Keep stored records and approval snapshots intact; project only for exports/fingerprints.
export function withoutPlanning(value) {
  const inactive = new Set([
    'tasks',
    'applicability',
    'impactedTaskIds',
    'impactDisposition',
    'impactRationale',
    'scoping',
  ]);
  if (Array.isArray(value)) return value.map(withoutPlanning);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(
        ([key]) => !inactive.has(key) || (key === 'applicability' && !Array.isArray(value[key])),
      )
      .map(([key, item]) => [key, withoutPlanning(item)]),
  );
}

export function reviewIntakeContext(input) {
  const { schemaVersion, documents, requirements, decisions } = normalizeIntakeContext(input);
  return withoutPlanning({ schemaVersion, documents, requirements, decisions });
}
