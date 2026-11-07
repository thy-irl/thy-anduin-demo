// Display guidance only. Never changes disposition, approval or source evidence.
export function findingReviewGuidance(f, operations = {}) {
  const decisions = (operations.decisions || []).filter((d) => d.findingIds?.includes(f.id));
  if (f.status === 'dismissed')
    return {
      title: 'Finding dismissed',
      next: 'The dismissal is retained in Finding history. Reopen the finding if it needs another review.',
    };
  if (decisions.some((d) => d.effectiveRoutingStatus === 'needs-reconfirmation'))
    return {
      title: 'Internal approval needs review',
      next: 'The source or scope has changed. Review the response and current evidence, then record internal approval again.',
    };
  if (f.status === 'resolved' && f.resolutionEvidence?.length)
    return {
      title: 'Corrected source found',
      next: 'Matching content was found in a later source check. The original finding is retained for reference. Check Readiness for the package’s handoff status.',
    };
  if (decisions.some((d) => d.approvalCurrent))
    return {
      title: 'Internal approval recorded',
      next: 'Approval covers the recorded scope and source versions. Finding review and package readiness are tracked separately.',
    };
  if (f.status === 'resolved')
    return {
      title: 'Marked as resolved',
      next: 'This records your review status. Internal handoff still requires corrected-source evidence or current scoped approval.',
    };
  if (decisions.some((d) => d.response?.text))
    return {
      title: 'Response recorded',
      next: 'Review the answer and its source context. Record internal approval separately if the response is ready to use.',
    };
  if (f.status === 'confirmed')
    return {
      title: 'Issue confirmed',
      next: 'Record a response if clarification is needed, or review a corrected source. Confirming an issue does not approve a legal interpretation.',
    };
  return {
    title: f.severity === 'advisory' ? 'Manual review suggested' : 'Review this finding',
    next: 'Compare the cited text with the original. Confirm the issue, or dismiss it with a reason. Findings are review candidates, not legal conclusions.',
  };
}

// Keep the full recorded explanation in check details and reports; the workbench
// already displays the source location beside the evidence.
export function findingReviewExplanation(f) {
  if (f.manual) return f.description;
  if (f.type === 'Missing attachment' && f.target) {
    if (f.classification === 'insufficient extraction coverage')
      return `Some source content could not be read as text. Check the original for ${f.target} before treating it as missing.`;
    if (f.classification === 'ambiguous target')
      return `A possible match for ${f.target} needs review. Confirm that its agreement, parties and version match this reference.`;
    // Keep special identity conflicts and their source-specific caveats intact.
    if (/different fund/i.test(f.description || '')) return f.description;
    return `The checked text refers to ${f.target}, but no matching attachment content was identified. Check the original and confirm whether the attachment was supplied and applies here.`;
  }
  if (f.type === 'Broken reference' && f.target)
    return f.classification === 'insufficient extraction coverage'
      ? `Some source content could not be read as text. Check the original for ${f.target} before treating the provision as missing.`
      : `The checked text did not match ${f.target} to a heading in this agreement. Check the original for the provision or a numbering error.`;
  if (f.type === 'Defined term') {
    const term = f.title?.match(/“([^”]+)”/)?.[1];
    if (term)
      return /differ|inconsistent/i.test(f.title)
        ? `The cited definitions of “${term}” differ. Check whether they cover the same investor and requirement; different agreements may use different definitions.`
        : `No definition of “${term}” was matched in this agreement’s checked text. Check the original and any referenced definitions.`;
  }
  return f.description;
}

// Deduplicate presentation only; preserve distinct locations and original bytes.
export function uniqueCitations(items) {
  const seen = new Set();
  return items.filter((e) => {
    const identity = JSON.stringify([
      e.documentId,
      e.document,
      e.documentVersion,
      e.page,
      e.text,
      e.section,
      e.locator,
      e.originalKey,
      e.span?.start,
      e.span?.end,
    ]);
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
}
