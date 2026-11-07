// Presentation only. Approval and readiness remain calculated by their evaluators.
export const readinessLabels = {
  NOT_EVALUATED: 'Not evaluated',
  BLOCKED: 'Internal handoff blocked',
  NEEDS_REVIEW: 'Review needed for internal handoff',
  READY: 'Ready for internal handoff',
};

export const decisionStatusNames = {
  draft: 'Draft question',
  'awaiting-response': 'Awaiting response',
  'response-recorded': 'Response recorded',
  approved: 'Internal approval recorded',
  rejected: 'Rejected by reviewer',
  'needs-reconfirmation': 'Approval needs review',
};

export function findingQueueStatus(f, operations = {}) {
  const decisions = (operations.decisions || []).filter((d) => d.findingIds?.includes(f.id));
  if (f.status === 'dismissed') return { label: 'Dismissed', kind: 'closed' };
  if (decisions.some((d) => d.effectiveRoutingStatus === 'needs-reconfirmation'))
    return { label: 'Approval needs recheck', kind: 'recheck' };
  if (f.status === 'resolved' && f.resolutionEvidence?.length)
    return { label: 'Source corrected', kind: 'corrected' };
  if (decisions.some((d) => d.approvalCurrent))
    return { label: 'Internally approved', kind: 'approved' };
  if (f.status === 'resolved') return { label: 'Marked resolved', kind: 'closed' };
  if (decisions.some((d) => d.response?.text?.trim()))
    return { label: 'Response recorded', kind: 'recorded' };
  if (
    decisions.some(
      (d) =>
        d.effectiveRoutingStatus === 'awaiting-response' || d.routingStatus === 'awaiting-response',
    )
  )
    return { label: 'Awaiting response', kind: 'awaiting' };
  if (f.status === 'confirmed') return { label: 'Issue confirmed', kind: 'confirmed' };
  return { label: 'Unreviewed', kind: 'unreviewed' };
}

export function readinessWorkGroups(readiness) {
  const groups = [];
  for (const b of readiness.blockers.filter((b) => !b.acknowledgementGate)) {
    const key = b.id;
    const existing = groups.find((g) => g.key === key);
    if (existing) existing.items.push(b);
    else groups.push({ key, items: [b] });
  }
  return groups;
}

export function readinessAction(b) {
  if (b.code === 'finding-unresolved' || b.code === 'finding-approval-stale') {
    const hasResponse =
      b.code === 'finding-approval-stale' ||
      b.decisionStatuses?.some((d) =>
        ['response-recorded', 'approved', 'needs-reconfirmation'].includes(d.status),
      );
    return {
      title:
        b.code === 'finding-approval-stale'
          ? 'Recheck approval for this issue'
          : hasResponse
            ? 'Record scoped approval for this issue'
            : 'Review this finding',
      label: hasResponse ? 'Record internal approval' : 'Record response',
      stage: hasResponse ? 'approval' : 'response',
    };
  }
  if (b.findingId) return { title: 'Review this issue', label: 'Review finding' };
  if (b.code === 'finding-analysis-drift')
    return { title: 'Refresh the review queue', label: 'Run preflight again', rerun: true };
  if (b.actionTab === 'documents')
    return { title: 'Check the source documents', label: 'Check documents', tab: 'documents' };
  return {
    title: 'Review the recorded requirements',
    label: 'Review documents',
    tab: b.actionTab || 'documents',
  };
}

// Readiness wording is presentation only; the evaluator owns every gate.
export function readinessBlockerCopy(blocker) {
  if (blocker.code === 'finding-approval-stale')
    return {
      next: 'The source or scope has changed. Review the response and evidence, then record internal approval again.',
      requirement: 'Fresh internal approval for the current sources and scope',
    };
  if (blocker.code === 'finding-unresolved') {
    const hasResponse = blocker.decisionStatuses?.some((d) =>
      ['response-recorded', 'approved', 'needs-reconfirmation'].includes(d.status),
    );
    return hasResponse
      ? {
          next: 'Review the recorded response against the current sources, then record internal approval for the scope it covers.',
          requirement: 'Internal approval for the recorded response, sources and scope',
        }
      : {
          next: 'Review the cited text. If clarification is needed, record a response and internal approval. Otherwise, verify a source correction or dismiss the finding with a reason.',
          requirement: 'A reviewed resolution supported by current evidence',
        };
  }
  return null;
}
