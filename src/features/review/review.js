// Report selection is independent of review disposition. Keep the existing storage key.
import { findingDetails, describeFinding } from '../analysis/finding.js';
import { findingCopy } from '../analysis/copy.js';
import { decisionStatusNames } from '../../lib/workflow.js';
import {
  normalizeIntakeContext,
  operationalContext,
  reviewIntakeContext,
  withoutPlanning,
} from '../context/intake.js';
import { normalizeReadinessReview, evaluateReadiness } from '../readiness/readiness.js';
export const statusNames = {
  open: 'Needs review',
  confirmed: 'Issue confirmed',
  dismissed: 'Dismissed',
  resolved: 'Marked resolved',
  'needs-verification': 'Needs verification',
};
import { severityNames } from './priority.js';
export { severityNames } from './priority.js';
export function findingDispositionError(finding, status) {
  return status === 'dismissed' && !finding.note?.trim()
    ? 'Enter a reason in Reviewer note before dismissing this finding.'
    : '';
}
const coverageNames = {
  'fully analyzed': 'Text checked',
  'partially analyzed': 'Text coverage incomplete',
  rejected: 'File could not be checked',
};
export function migrateReviewState(state) {
  return {
    ...state,
    packages: state.packages.map((p) => ({
      ...p,
      ...(p.readinessReview
        ? { readinessReview: normalizeReadinessReview(p.readinessReview) }
        : {}),
      intakeContext: normalizeIntakeContext(p.intakeContext),
      revisions: p.revisions || [],
      findings: p.findings.map((f) => {
        const legacy = f.status === 'escalated';
        return {
          ...f,
          ...findingDetails(f),
          includeInReport:
            typeof f.includeInReport === 'boolean'
              ? f.includeInReport
              : ['confirmed', 'escalated'].includes(f.status),
          ...(legacy
            ? {
                status: 'open',
                history: [
                  ...(f.history || []),
                  {
                    event:
                      'Legacy counsel flag retained as report selection; review decision still required',
                    previousStatus: 'escalated',
                    time: new Date().toISOString(),
                  },
                ],
              }
            : {}),
        };
      }),
    })),
  };
}
export const reportFindings = (pkg) => pkg.findings.filter((f) => f.includeInReport === true);
export function reportData(pkg, analysis, { allFindings = false } = {}) {
  const operations = operationalContext(pkg, analysis);
  const reviewContext = {
    intakeContext: reviewIntakeContext(pkg.intakeContext),
    documents: operations.documents,
    requirements: operations.requirements,
    decisions: withoutPlanning(operations.decisions),
  };
  return {
    package: pkg.name,
    synthetic: !!pkg.demo,
    learningSample: !!pkg.learningSample,
    exportedAt: new Date().toISOString(),
    reviewType: 'Deterministic checks and analyst-supplied context; human review required',
    coverage: analysis.coverage,
    packageContext: withoutPlanning(analysis.context),
    operationalContext: reviewContext,
    revisions: pkg.revisions || [],
    readiness: evaluateReadiness(pkg, analysis),
    referenceMap: analysis.references,
    checkResults: analysis.checkResults || [],
    limitations: analysis.coverage.unsupported,
    findings: (allFindings ? pkg.findings : reportFindings(pkg)).map((f) =>
      findingCopy({ ...f, ...findingDetails(f) }),
    ),
  };
}
export function reportMarkdown(data, { demo = false, reviewSummary = false } = {}) {
  const c = data.coverage;
  return (
    `# ${data.package} — ${reviewSummary ? 'Review summary' : 'Counsel clarifications'}\n\nPrepared ${data.exportedAt}\n\n${
      reviewSummary && data.readiness
        ? `Internal review status: ${data.readiness.state}\nRemaining actions:\n${data.readiness.blockers.map((b) => `- ${b.reason}`).join('\n') || 'None recorded'}\n\n`
        : ''
    }${demo ? 'Synthetic demonstration package.\n\n' : ''}Review support only. Human disposition is not legal approval or authenticated authorization.\n\nCoverage: ${c.status}; ${c.pagesWithGaps} gaps.\nChecks applied: ${c.supported || 'Limited deterministic rules'}\nRequires manual review: ${c.manualReview || 'Unsupported checks and legal applicability'}\n${c.files.map((f) => `${f.name}: ${coverageNames[f.status] || f.status}; ${f.pagesChecked}/${f.originalPages} checked; ${f.gaps.map((g) => `page ${g.page}: ${g.status}`).join(', ')}; ${f.limitations.join('; ')}`).join('\n')}\n${data.packageContext?.documents?.length ? `Document context:\n${data.packageContext.documents.map((d) => `${c.files.find((f) => f.id === d.documentId)?.name || 'Document'}: ${d.role}; ${d.contractParties || d.fund || 'identity not established'}; ${d.declaredVersion ? 'stated version ' + d.declaredVersion : 'version not established'}; ${d.closing || 'closing not established'}`).join('\n')}\n` : ''}Unsupported: ${c.unsupported.join('; ')}\n\n${operationalMarkdown(data)}` +
    (data.checkResults?.length
      ? `### Checks not verified\n\n${data.checkResults.map((r) => `- ${r.checkId} — ${r.target}: ${r.reason}\n  Next action: ${r.nextAction || 'Verify the requirement and original.'}${r.evidence?.length ? '\n' + r.evidence.map((e) => `  ${e.document}, ${e.locator || 'Page'} ${e.page}, version ${e.documentVersion}\n  > ${e.text}`).join('\n') : ''}`).join('\n')}\n\n`
      : '') +
    data.findings
      .map(
        (f, i) =>
          `## ${i + 1}. ${f.title}\n\nCategory: ${describeFinding(f)} | Basis: ${findingDetails(f).certainty}\n\n${f.checkId ? `Check: ${f.checkId} | Result: ${f.detectionStatus}\n\n` : ''}Priority: ${severityNames[f.severity]} | Review state: ${statusNames[f.status]} | Rule: ${f.rule || 'Legacy deterministic rule; accuracy uncalibrated'} | Uncertainty: ${f.uncertainty || 'Review applicability'}\n\n${f.description}\n\n### Question for counsel\n${f.question}\n\n### Digitization impact\n${f.impact}\n\n### Source evidence\n${f.evidence.map((e) => `- ${e.document}, ${e.locator || 'Page'} ${e.page}, ${e.section || ''}, version ${e.documentVersion || 'legacy'}\n  > ${e.text}`).join('\n')}\n\n${f.resolutionEvidence?.length ? `### Corrected source evidence\n${f.resolutionEvidence.map((e) => `- ${e.document}, ${e.locator || 'Page'} ${e.page}, version ${e.documentVersion}\n  > ${e.text}`).join('\n')}\n\n` : ''}${f.note ? `Reviewer note: ${f.note}\n\n` : ''}`,
      )
      .join('\n')
  );
}

function decisionWorkflowMarkdown(row, file) {
  const response = row.response || {},
    approval = row.approval || {},
    applicability = approval.applicability || {};
  const versions = Object.entries(applicability.documentVersions || {})
    .map(([id, version]) => `${file(id)} version ${version}`)
    .join('; ');
  return `\nQuestion status: ${decisionStatusNames[row.effectiveRoutingStatus || row.routingStatus] || decisionStatusNames.draft}; response needed from: ${row.issueType || 'unclassified'}\nQuestion: ${row.question || 'not recorded'}\nAssigned to: ${row.assignedTo || 'unassigned'}; asked: ${row.askedAt || 'not recorded'}\nResponse: ${response.text || 'not recorded'}\nResponse attribution: ${response.author || 'unknown'}; channel: ${response.channel || 'unknown'}; received: ${response.receivedAt || 'not recorded'}; reference: ${response.reference || 'not recorded'}; recorded by: ${response.recordedBy || 'unknown'}\nRecorded internal approval (preserved record; does not establish current approval): ${approval.recordedBy || 'not recorded'}; date: ${approval.approvedAt || 'not recorded'}\nApproval rationale: ${approval.rationale || 'not recorded'}\nApplicability: vehicle ${applicability.vehicle || 'not recorded'}; investor route ${applicability.investorRoute || 'not recorded'}; ${versions || 'source versions not recorded'}; conditions: ${applicability.conditions || 'not recorded'}\nUnverified actor attribution: names are entered by the user and are not authenticated.\nPreserved workflow history entries: ${(row.history || []).length}`;
}

function operationalMarkdown(data) {
  const o = data.operationalContext;
  if (!o) return '';
  const file = (id) =>
    data.coverage.files.find((f) => f.id === id)?.name || id || 'Document not specified';
  const link = (row) =>
    !row.findingIds?.length
      ? 'No finding links recorded; this is reviewer-entered context, not an automatically inferred relationship.'
      : `Links recorded by: ${row.linkProvenance?.actor || 'reviewer; individual creator not recorded'}. Reason: ${row.linkProvenance?.reason || 'related issues selected by the reviewer; no further rationale recorded'}${row.linkProvenance?.recordedAt ? '; recorded ' + row.linkProvenance.recordedAt : ''}`;
  const source = (row) => {
    const s = row.source;
    return s
      ? `Source: ${file(s.documentId)}, ${s.page ? 'page / paragraph ' + s.page : 'location not recorded'}, version ${s.documentVersion || 'not recorded'}; ${row.sourceState?.status || 'unverified'}${row.sourceState?.reason ? ' — ' + row.sourceState.reason : ''}${row.dependencyState && row.dependencyState.status !== 'current' ? '\nLinked sources: ' + row.dependencyState.reason : ''}${s.quote ? '\n> ' + s.quote : ''}`
      : 'Source not recorded; requires verification';
  };
  let text = '';
  if (data.packageContext?.metadataIssues?.length)
    text +=
      '### Document identity requires review\n\n' +
      data.packageContext.metadataIssues
        .map((r) => `- ${file(r.documentId)}: ${r.reason}`)
        .join('\n') +
      '\n\n';
  if (o.documents?.length)
    text +=
      '### Analyst document context\n\n' +
      o.documents
        .map((d) => `- ${file(d.documentId)}: ${d.status || 'current'}; ${source(d)}`)
        .join('\n') +
      '\n\n';
  if (o.requirements?.length)
    text +=
      '### Required and external documents\n\n' +
      o.requirements
        .map(
          (r) =>
            `- ${r.label} — ${r.relationship}; owner: ${r.owner || 'unassigned'}${r.documentId ? '; supplied file: ' + file(r.documentId) : ''}\n${source(r)}`,
        )
        .join('\n\n') +
      '\n\n';
  if (o.decisions?.length)
    text +=
      '### Recorded interpretations\n\n' +
      o.decisions
        .map(
          (r) =>
            `- ${r.title} — ${r.effectiveStatus || r.status}; owner: ${r.owner || 'unassigned'}\n${r.answer}\n${source(r)}\nLinked issue IDs: ${(r.findingIds || []).join(', ') || 'none'}\n${link(r)}${decisionWorkflowMarkdown(r, file)}`,
        )
        .join('\n\n') +
      '\n\n';
  if (data.revisions?.length)
    text +=
      '### Source revision history\n\n' +
      data.revisions
        .map(
          (r) =>
            `- ${r.name}, version ${r.fromVersion} → ${r.toVersion}: ${r.summary}${r.limited ? ' (comparison limited)' : ''}\n${r.changes.map((c) => `Before: ${c.before.map((p) => p.text).join(' ')}\nAfter: ${c.after.map((p) => p.text).join(' ')}`).join('\n')}`,
        )
        .join('\n\n') +
      '\n\n';
  return text;
}
