import {
  operationalContext,
  sourceState,
  reviewIntakeContext,
  withoutPlanning,
} from '../context/intake.js';
import { coverageOf } from '../analysis/coverage.js';

const text = (v) => (typeof v === 'string' ? v.trim() : '');
const array = (v) => (Array.isArray(v) ? v : []);
const copy = (v) => JSON.parse(JSON.stringify(v));
const evidenceFor = (f) =>
  f.status === 'resolved' && array(f.resolutionEvidence).length
    ? f.resolutionEvidence
    : array(f.evidence);
const citation = (e) => ({
  documentId: e.documentId,
  documentVersion: e.documentVersion,
  page: e.page,
  quote: e.text ?? e.quote ?? '',
});
// The parser's paragraph locator caveat does not indicate lost text. Every
// other extraction limitation remains a source gap that cannot be waived.
const locatorOnly = (v) =>
  v ===
  'DOCX citations are XML paragraphs/segments, not original pages; page layout is not reconstructed.';
const canonical = (v) =>
  Array.isArray(v)
    ? v.map(canonical)
    : v && typeof v === 'object'
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, canonical(v[k])]),
        )
      : v;
function digest(input) {
  const value = JSON.stringify(canonical(input));
  let a = 2166136261,
    b = 5381;
  for (let i = 0; i < value.length; i++) {
    a = Math.imul(a ^ value.charCodeAt(i), 16777619);
    b = Math.imul(b, 33) ^ value.charCodeAt(i);
  }
  return `${value.length}:${a >>> 0}:${b >>> 0}`;
}

// Store only human declarations. Calculated status is deliberately never trusted.
export function normalizeReadinessReview(input = {}) {
  const a = input?.acknowledgement;
  return {
    schemaVersion: 2,
    acknowledgement:
      a && typeof a === 'object'
        ? {
            ...copy(a),
            recordedBy: text(a.recordedBy),
            recordedAt: text(a.recordedAt),
            rationale: text(a.rationale),
            coverageReview: text(a.coverageReview),
            fingerprint: text(a.fingerprint),
          }
        : null,
    history: copy(array(input?.history)),
  };
}

function inputFingerprint(pkg, analysis, operations) {
  return digest({
    policy: 'document-review-v3',
    documents: array(pkg.documents).map((d) => ({
      id: d.id,
      name: d.name,
      type: d.type,
      version: d.version,
      rejected: d.rejected,
      error: d.error,
      originalPageCount: d.originalPageCount,
      limitations: d.limitations,
      pages: array(d.pages).map((p) => ({
        number: p.number,
        status: p.status,
        text: p.text,
        visualGap: p.visualGap,
        reason: p.reason,
      })),
    })),
    findings: array(pkg.findings).map((f) => ({
      id: f.id,
      status: f.status,
      severity: f.severity,
      title: f.title,
      question: f.question,
      note: f.note,
      evidence: f.evidence,
      resolutionEvidence: f.resolutionEvidence,
      history: f.history,
    })),
    intake: reviewIntakeContext(operations.intakeContext),
    coverage: analysis.coverage || null,
    identity: withoutPlanning(analysis.context || null),
    checkResults: analysis.checkResults || [],
  });
}

export function evaluateReadiness(pkg = {}, analysis) {
  const documents = array(pkg.documents),
    findings = array(pkg.findings),
    operations = operationalContext(pkg, analysis || {}),
    blockers = [],
    warnings = [];
  const add = (
    code,
    subjectId,
    reason,
    nextAction,
    {
      severity = 'blocking',
      actionTab = 'documents',
      responsibleRole = 'Digitization analyst',
      findingId = null,
      sourceId = null,
      decisionId = null,
      taskId = null,
      evidence = [],
      ...extra
    } = {},
  ) => {
    const sourceVersions = Object.fromEntries(
      evidence.filter((e) => e.documentId).map((e) => [e.documentId, e.documentVersion ?? null]),
    );
    if (sourceId && !Object.hasOwn(sourceVersions, sourceId))
      sourceVersions[sourceId] = documents.find((d) => d.id === sourceId)?.version ?? null;
    const id = `${code}:${encodeURIComponent(subjectId || 'package')}`;
    if (!blockers.some((b) => b.id === id))
      blockers.push({
        id,
        code,
        subjectId,
        findingId,
        sourceId,
        decisionId,
        taskId,
        label: reason,
        reason,
        explanation: reason,
        severity,
        nextAction,
        actionTab,
        responsibleRole,
        evidence: copy(evidence),
        sourceVersions,
        ...extra,
      });
  };
  const warn = (code, reason, extra = {}) =>
    warnings.push({
      id: `${code}:${extra.subjectId || 'package'}`,
      code,
      reason,
      explanation: reason,
      ...extra,
    });
  const suppliedAnalysis =
    !!analysis?.coverage &&
    Array.isArray(analysis.coverage.files) &&
    Array.isArray(analysis.findings);
  const evaluated = documents.length > 0 && suppliedAnalysis;
  if (!documents.length)
    add(
      'no-sources',
      'package',
      'No source documents have been supplied.',
      'Upload the required source package.',
      { severity: 'review', actionTab: 'documents' },
    );
  if (!suppliedAnalysis)
    add(
      'analysis-not-evaluated',
      'package',
      'Current analysis coverage is not available.',
      'Run the existing package analysis and inspect Documents.',
      { severity: 'review', actionTab: 'documents' },
    );
  const requiredIds = new Set(
    operations.requirements.filter((r) => r.relationship === 'attached').map((r) => r.documentId),
  );
  const statusOf = (id) =>
    analysis?.context?.documents?.find((d) => d.documentId === id)?.status ||
    operations.intakeContext.documents[id]?.status ||
    'current';
  const linkedIds = new Set([
    ...operations.decisions.flatMap((d) => [
      ...Object.keys(d.documentVersions),
      d.source.documentId,
    ]),
    ...findings
      .filter((f) => f.status !== 'dismissed')
      .flatMap((f) => evidenceFor(f).map((e) => e.documentId)),
  ]);
  for (const doc of documents) {
    const historical =
      statusOf(doc.id) === 'superseded' && !requiredIds.has(doc.id) && !linkedIds.has(doc.id);
    if (historical) {
      warn(
        'historical-source',
        `${doc.name} is retained as a superseded historical source and is excluded from the active source gate.`,
        { subjectId: doc.id, sourceId: doc.id, sourceVersion: doc.version },
      );
      continue;
    }
    const affectedPages = array(doc.pages).filter(
      (p) => p.visualGap || (p.status && !['searchable text', 'likely blank'].includes(p.status)),
    );
    const e = (affectedPages.length ? affectedPages : array(doc.pages).slice(0, 1)).map((p) => ({
        documentId: doc.id,
        documentVersion: doc.version,
        page: p.number,
        text: p.text || '',
        status: p.status,
        reason: p.reason,
      })),
      opts = { sourceId: doc.id, actionTab: 'documents', evidence: e };
    if (!Number.isInteger(doc.version) || doc.version < 1)
      add(
        'source-version',
        doc.id,
        `${doc.name}: the active source version is unverified.`,
        'Restore a verified positive source version by reattaching the current original.',
        opts,
      );
    if (statusOf(doc.id) === 'superseded')
      add(
        'source-superseded',
        doc.id,
        `${doc.name}: a required or actively linked source is superseded.`,
        'Supply the current original and recheck its requirements and dependencies.',
        opts,
      );
    const c = coverageOf(doc),
      missingPages = Number(doc.originalPageCount) > array(doc.pages).length;
    if (
      doc.rejected ||
      doc.error ||
      !array(doc.pages).length ||
      missingPages ||
      c.gaps.length ||
      !array(doc.pages).some((p) => text(p.text))
    )
      add(
        'source-extraction',
        doc.id,
        `${doc.name}: extraction is missing, unreadable, incomplete or includes unchecked image content.`,
        'Inspect the original and supply a complete readable source; acknowledgement cannot waive extraction gaps.',
        {
          ...opts,
          gaps: c.gaps,
          originalPages: c.originalPages,
          pagesAvailable: array(doc.pages).length,
        },
      );
    const contentLimitations = c.limitations.filter((v) => !locatorOnly(v));
    if (contentLimitations.length)
      add(
        'source-content-limitations',
        doc.id,
        `${doc.name}: extraction limitations leave source content unverified: ${contentLimitations.join('; ')}`,
        'Supply a completely extracted readable source and rerun analysis; manual acknowledgement cannot waive lost content.',
        opts,
      );
    if (c.limitations.length)
      warn('source-limitations', `${doc.name}: ${c.limitations.join('; ')}`, {
        subjectId: doc.id,
        sourceId: doc.id,
        sourceVersion: doc.version,
      });
    const reported = analysis?.coverage?.files?.find((f) => f.id === doc.id);
    if (
      suppliedAnalysis &&
      (!reported ||
        array(reported.gaps).length ||
        reported.status === 'rejected' ||
        Number(reported.pagesChecked) < Number(reported.originalPages) ||
        array(reported.limitations).some((v) => !locatorOnly(v)) ||
        (reported.status !== 'fully analyzed' && !array(reported.limitations).length))
    )
      add(
        'source-analysis-coverage',
        doc.id,
        `${doc.name}: current analysis does not establish complete readable-source coverage.`,
        'Rerun analysis with complete readable input and verify every affected source page.',
        opts,
      );
  }
  if (
    suppliedAnalysis &&
    analysis.coverage.status === 'incomplete' &&
    !analysis.coverage.files.some((f) => f.status !== 'fully analyzed')
  )
    add(
      'analysis-coverage',
      'package',
      'The analysis declares incomplete coverage without an explained file-level assessment.',
      'Rerun analysis and verify the affected source coverage before internal handoff.',
      { actionTab: 'documents', sourceId: documents[0]?.id || null },
    );
  for (const issue of array(analysis?.context?.metadataIssues))
    add(
      'source-identity',
      `${issue.documentId}:${issue.field || issue.code || issue.type || 'identity'}:${digest(issue.reason || issue.message || 'identity')}`,
      issue.reason || issue.message || 'Source identity or parent linkage is disputed.',
      'Verify the document identity and parent agreement in Documents.',
      {
        sourceId: issue.documentId,
        evidence: operations.intakeContext.documents[issue.documentId]?.source
          ? [operations.intakeContext.documents[issue.documentId].source]
          : [],
      },
    );
  for (const requirement of operations.requirements) {
    if (requirement.relationship !== 'attached') {
      warn(
        'inventory-boundary',
        `${requirement.label}: explicitly declared ${requirement.relationship}; this declaration does not verify external content.`,
        {
          subjectId: requirement.id,
          sourceId: requirement.documentId || requirement.source.documentId,
        },
      );
    } else if (requirement.availability === 'missing')
      add(
        'required-source-missing',
        requirement.id,
        `${requirement.label}: the required source is missing.`,
        'Attach the required current document and verify the inventory entry.',
        {
          sourceId: requirement.documentId || requirement.source.documentId,
          responsibleRole: requirement.owner || 'Document owner',
          evidence: [requirement.source],
        },
      );
    if (requirement.sourceState.status !== 'current')
      add(
        'requirement-unverified',
        requirement.id,
        `${requirement.label}: the required-document declaration lacks current verified source evidence.`,
        'Verify the requirement or explicit boundary against a literal current source citation.',
        {
          sourceId: requirement.source.documentId || requirement.documentId,
          evidence: [requirement.source],
          responsibleRole: requirement.owner || 'Digitization analyst',
        },
      );
  }
  for (const result of array(analysis?.checkResults))
    add(
      'preflight-not-verified',
      result.requirementId || result.checkId,
      `${result.target}: ${result.reason}`,
      'Verify the configured requirement and inspect the original form.',
      { evidence: result.evidence || [], sourceId: result.evidence?.[0]?.documentId },
    );
  const approvedFor = (id) =>
    operations.decisions.filter((d) => d.findingIds.includes(id) && d.approvalCurrent);
  const cleared = new Set();
  const analysisDrift = new Set();
  for (const detected of array(analysis?.findings).filter((f) => f.severity !== 'advisory')) {
    const saved = findings.find((f) => f.id === detected.id),
      evidence = evidenceFor(detected),
      changed =
        saved && digest(array(saved.evidence).map(citation)) !== digest(evidence.map(citation));
    if (!saved || changed) {
      analysisDrift.add(detected.id);
      add(
        'finding-analysis-drift',
        detected.id,
        `${detected.title}: current detected evidence ${saved ? 'differs from the saved review record' : 'has not been added to the saved review queue'}.`,
        'Choose Run preflight again, then review the current evidence and reconfirm any affected decision.',
        {
          sourceId: evidence[0]?.documentId || null,
          evidence,
          actionTab: 'review',
          detectedFindingId: detected.id,
          responsibleRole: 'Digitization analyst',
        },
      );
    }
  }
  for (const f of findings) {
    // Queue priority does not waive the unresolved requirement gate. Preserve
    // the original priority separately; every actionable issue needs triage.
    const evidence = evidenceFor(f),
      opts = {
        findingId: f.id,
        sourceId: evidence[0]?.documentId || null,
        evidence,
        actionTab: 'review',
        severity: 'blocking',
        findingSeverity: f.severity || 'unassigned',
      };
    const current =
      evidence.length > 0 &&
      evidence.every(
        (e) =>
          sourceState(citation(e), documents).status === 'current' &&
          statusOf(e.documentId) !== 'superseded',
      );
    if (f.status === 'dismissed') {
      const rationale =
        text(f.note) ||
        array(f.history)
          .map((h) => text(h.rationale))
          .find(Boolean);
      const dismissalRecorded = array(f.history).some(
        (h) =>
          /dismiss|reject/i.test(h.event || '') ||
          h.status === 'dismissed' ||
          h.newStatus === 'dismissed',
      );
      if (!rationale || !dismissalRecorded)
        add(
          'dismissal-review',
          f.id,
          `${f.title}: dismissal needs retained review history and a rationale.`,
          'Record why this is a harmless finding in Reviewer note, then retain the dismissal event.',
          { ...opts, severity: 'review' },
        );
      else if (!current)
        add(
          'dismissal-evidence',
          f.id,
          `${f.title}: dismissed evidence is no longer current.`,
          'Recheck the harmless finding against the current source and record the rationale.',
          { ...opts, severity: 'review' },
        );
      else cleared.add(f.id);
      continue;
    }
    if (f.severity === 'advisory') {
      warn('advisory-finding', `${f.title}: note remains visible for manual review.`, {
        subjectId: f.id,
        findingId: f.id,
      });
      cleared.add(f.id);
      continue;
    }
    if (
      f.status === 'resolved' &&
      array(f.resolutionEvidence).length &&
      current &&
      !analysisDrift.has(f.id)
    ) {
      cleared.add(f.id);
      continue;
    }
    if (approvedFor(f.id).length && !analysisDrift.has(f.id)) {
      cleared.add(f.id);
      continue;
    }
    const linked = operations.decisions.filter((d) => d.findingIds.includes(f.id)),
      stale = linked.some((d) => d.effectiveRoutingStatus === 'needs-reconfirmation'),
      response = linked.some((d) => d.response.text);
    add(
      stale ? 'finding-approval-stale' : 'finding-unresolved',
      f.id,
      `${f.title}: ${stale ? 'recorded approval requires reconfirmation against current evidence and applicability' : response ? 'a response is recorded, but no current scoped internal approval exists' : f.status === 'resolved' ? 'resolved status has no verified positive correction evidence or current scoped approval' : 'the finding requires explicit review and a current scoped internal decision'}.`,
      stale
        ? 'Recheck all sources and applicability, then explicitly record internal approval again.'
        : 'Review the evidence, record the response and explicit scoped internal approval, or document a harmless dismissal/corrected source.',
      {
        ...opts,
        decisionId: linked[0]?.id || null,
        responsibleRole:
          linked[0]?.assignedTo || linked[0]?.owner || 'Digitization lead / counsel liaison',
        decisionStatuses: linked.map((d) => ({ id: d.id, status: d.effectiveRoutingStatus })),
      },
    );
  }
  const fingerprint = inputFingerprint(pkg, analysis || {}, operations),
    review = normalizeReadinessReview(pkg.readinessReview),
    ack = review.acknowledgement;
  const acknowledgementCurrent =
    !!ack &&
    ack.fingerprint === fingerprint &&
    !!ack.recordedBy &&
    !!ack.rationale &&
    !!ack.coverageReview &&
    Number.isFinite(Date.parse(ack.recordedAt));
  const canAcknowledge = evaluated && !blockers.length;
  warn(
    'detection-limited',
    'No detected findings does not prove a document is defect-free. Deterministic detection is incomplete; legal interpretation, authenticity and unsupported requirements need human review.',
  );
  if (!acknowledgementCurrent) {
    add(
      'manual-coverage-review',
      'coverage',
      'Unsupported detection coverage needs an explicit human review record.',
      'Review original sources and unsupported checks; describe the review in the acknowledgement below.',
      {
        severity: 'review',
        actionTab: 'documents',
        responsibleRole: 'Digitization lead',
        acknowledgementGate: true,
      },
    );
    add(
      'internal-acknowledgement',
      'package',
      ack
        ? 'The prior internal readiness acknowledgement does not match this current package.'
        : 'No internal readiness acknowledgement has been recorded for this package.',
      'After mandatory checks pass, explicitly acknowledge the current package for internal digitization handoff.',
      {
        severity: 'review',
        actionTab: 'readiness',
        responsibleRole: 'Digitization lead',
        acknowledgementGate: true,
      },
    );
  }
  const knownRequiredGap = blockers.some((b) => b.code === 'required-source-missing');
  const state =
    !evaluated && !knownRequiredGap
      ? 'NOT_EVALUATED'
      : blockers.some((b) => b.severity === 'blocking')
        ? 'BLOCKED'
        : blockers.length
          ? 'NEEDS_REVIEW'
          : 'READY';
  const checks = {
    sources: !blockers.some((b) => /source|requirement/.test(b.code)),
    coverage:
      evaluated &&
      !blockers.some((b) =>
        [
          'source-extraction',
          'source-content-limitations',
          'source-analysis-coverage',
          'analysis-coverage',
        ].includes(b.code),
      ),
    criticalFindings: !blockers.some((b) => /finding|dismissal/.test(b.code)),
    decisions: !blockers.some((b) => /finding-approval|finding-unresolved/.test(b.code)),
    acknowledgement: acknowledgementCurrent,
  };
  return {
    state,
    blockers,
    warnings,
    checks,
    fingerprint,
    canAcknowledge,
    assessedAt: pkg.lastRun || null,
    acknowledgement: { record: ack, current: acknowledgementCurrent, history: review.history },
    coverage: {
      extractionComplete: checks.coverage,
      detectionComplete: false,
      supported: analysis?.coverage?.supported || '',
      manualReview: analysis?.coverage?.manualReview || '',
      unsupported: array(analysis?.coverage?.unsupported),
      files: array(analysis?.coverage?.files),
    },
    limits:
      'Calculated readiness is for internal digitization work only. It is not formal customer/counsel sign-off or legal approval. Recorded identities are unauthenticated in this browser-local MVP.',
  };
}

export function recordReadinessAcknowledgement(
  pkg,
  analysis,
  {
    recordedBy,
    rationale,
    coverageReview,
    acknowledged = false,
    now = new Date().toISOString(),
  } = {},
) {
  const result = evaluateReadiness(pkg, analysis);
  if (!result.canAcknowledge)
    throw new Error(
      'Resolve all mandatory readiness checks before recording an internal acknowledgement.',
    );
  if (!text(recordedBy) || !text(rationale) || !text(coverageReview) || !acknowledged)
    throw new Error(
      'Record a reviewer, rationale and manual coverage review, and explicitly acknowledge this package.',
    );
  if (!Number.isFinite(Date.parse(now))) throw new Error('Use a valid acknowledgement date.');
  const previous = normalizeReadinessReview(pkg.readinessReview);
  return {
    schemaVersion: 2,
    acknowledgement: {
      recordedBy: text(recordedBy),
      recordedAt: now,
      rationale: text(rationale),
      coverageReview: text(coverageReview),
      fingerprint: result.fingerprint,
    },
    history: [
      ...previous.history,
      ...(previous.acknowledgement
        ? [
            {
              ...previous.acknowledgement,
              reason: 'Previous internal readiness acknowledgement retained.',
            },
          ]
        : []),
    ],
  };
}
