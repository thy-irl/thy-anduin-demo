import { describeFinding } from '../analysis/finding.js';
import { statusNames, severityNames } from './review.js';
import { decisionStatusNames, readinessLabels } from '../../lib/workflow.js';

// Build from report data directly: never parse document quotations as Markdown.
export function reviewSummaryDefinition(data) {
  const content = [];
  const value = (v) => (v === undefined || v === null || v === '' ? 'Not recorded' : String(v));
  const paragraph = (text) => content.push({ text: value(text), margin: [0, 0, 0, 7] });
  const heading = (text, level = 2) =>
    content.push({
      text,
      style: `heading${level}`,
      margin: [0, level === 2 ? 0 : 14, 0, 8],
      headlineLevel: level,
      ...(level === 2 ? { tocItem: true, pageBreak: 'before' } : {}),
    });
  const field = (label, text) =>
    content.push({
      table: {
        widths: [126, '*'],
        dontBreakRows: value(text).length < 1000,
        body: [[{ text: `${label}:`, color: '#53636a', fontSize: 9 }, { text: value(text) }]],
      },
      layout: {
        hLineWidth: () => 0,
        vLineWidth: () => 0,
        paddingLeft: () => 0,
        paddingRight: () => 10,
        paddingTop: () => 3,
        paddingBottom: () => 5,
      },
      margin: [0, 0, 0, 2],
    });
  const file = (id) =>
    data.coverage.files.find((f) => f.id === id)?.name || id || 'Source not specified';
  const source = (e) => {
    paragraph(
      [
        e.document || file(e.documentId),
        `${e.locator || 'Page / paragraph'} ${e.page || 'unverified'}`,
        `Version ${e.documentVersion || 'unverified'}`,
        e.section,
      ]
        .filter(Boolean)
        .join(' · '),
    );
    if (e.text || e.quote)
      content.push({ text: e.text || e.quote, style: 'quotation', margin: [12, 0, 0, 10] });
  };
  const contextSource = (row) => {
    if (row.source) source(row.source);
    field(
      'Source status',
      [row.sourceState?.status || 'unverified', row.sourceState?.reason]
        .filter(Boolean)
        .join(' — '),
    );
    if (row.dependencyState)
      field(
        'Linked source versions',
        `${row.dependencyState.status}: ${row.dependencyState.reason || ''}`,
      );
  };

  content.push({ text: 'PREFLIGHT / INTERNAL DOCUMENT REVIEW', style: 'eyebrow' });
  heading('Review summary', 1);
  content.push({ text: data.package, style: 'packageName', margin: [0, 4, 0, 18] });
  field('Prepared', data.exportedAt);
  if (data.synthetic) paragraph('Synthetic demonstration package.');
  paragraph(
    'Review support only. Human disposition is not legal approval or authenticated authorization. Original files are not included in this PDF.',
  );
  content.push({
    table: {
      widths: ['*', '*', '*'],
      body: [
        [
          {
            text: [
              { text: 'READINESS\n', style: 'eyebrow' },
              { text: data.readiness?.state || 'NOT_EVALUATED', bold: true, fontSize: 14 },
            ],
          },
          {
            text: [
              { text: 'SOURCE FILES\n', style: 'eyebrow' },
              { text: String(data.coverage.files.length), bold: true, fontSize: 14 },
            ],
          },
          {
            text: [
              { text: 'FINDINGS\n', style: 'eyebrow' },
              { text: String(data.findings.length), bold: true, fontSize: 14 },
            ],
          },
        ],
      ],
    },
    layout: {
      hLineWidth: () => 0,
      vLineWidth: () => 0,
      fillColor: () => '#edf3f4',
      paddingTop: () => 12,
      paddingBottom: () => 12,
      paddingLeft: () => 12,
      paddingRight: () => 12,
    },
    margin: [0, 14, 0, 24],
  });
  content.push({
    toc: {
      title: { text: 'Contents', style: 'heading2', margin: [0, 0, 0, 12] },
      textStyle: { fontSize: 11, color: '#234e58' },
      numberStyle: { fontSize: 11, color: '#234e58' },
      textMargin: [0, 0, 12, 9],
    },
  });
  if (data.readiness) {
    heading('Internal readiness');
    field('Internal review status', data.readiness.state);
    paragraph(readinessLabels[data.readiness.state]);
    heading('Remaining actions', 3);
    if (!data.readiness.blockers.length) paragraph('None recorded');
    for (const blocker of data.readiness.blockers) {
      paragraph(blocker.reason);
      field('Next action', blocker.nextAction);
    }
    if (data.readiness.acknowledgement.record) {
      heading('Internal readiness acknowledgement', 3);
      const ack = data.readiness.acknowledgement;
      field('Current', ack.current ? 'Yes' : 'No — renewed review required');
      field('Recorded by', ack.record.recordedBy);
      field('Recorded at', ack.record.recordedAt);
      field('Rationale', ack.record.rationale);
      field('Manual coverage review', ack.record.coverageReview);
    }
    paragraph(data.readiness.limits);
  }
  heading('Coverage & source documents');
  field('Coverage', `${data.coverage.status}; ${data.coverage.pagesWithGaps} gaps`);
  field('Checks applied', data.coverage.supported);
  field('Requires manual review', data.coverage.manualReview);
  for (const doc of data.coverage.files) {
    heading(doc.name, 3);
    field('Text coverage', `${doc.status}; ${doc.pagesChecked}/${doc.originalPages} checked`);
    for (const gap of doc.gaps)
      paragraph(`Page ${gap.page}: ${gap.status}${gap.reason ? ` — ${gap.reason}` : ''}`);
    for (const limitation of doc.limitations) paragraph(limitation);
  }
  heading('Unsupported checks & limitations', 3);
  for (const limitation of data.coverage.unsupported) paragraph(limitation);
  for (const doc of data.packageContext?.documents || []) {
    heading(`Document context: ${file(doc.documentId)}`, 3);
    field('Role', doc.role);
    field('Identity', doc.contractParties || doc.fund || 'Identity not established');
    field('Stated version', doc.declaredVersion);
    field('Closing', doc.closing);
  }
  for (const issue of data.packageContext?.metadataIssues || [])
    paragraph(`${file(issue.documentId)}: ${issue.reason}`);

  const context = data.operationalContext || {};
  for (const row of context.documents || []) {
    heading(`Analyst context: ${file(row.documentId)}`, 3);
    field('Status', row.status || 'current');
    contextSource(row);
  }
  for (const row of context.requirements || []) {
    heading(`Required or external document: ${row.label}`, 3);
    field('Relationship', row.relationship);
    field('Owner', row.owner || 'Unassigned');
    if (row.documentId) field('Supplied file', file(row.documentId));
    contextSource(row);
  }
  if (context.decisions?.length) heading('Questions, responses & internal approval');
  for (const row of context.decisions || []) {
    heading(row.title, 3);
    field('Interpretation status', row.effectiveStatus || row.status);
    field('Owner', row.owner || 'Unassigned');
    if (row.answer) field('Recorded interpretation', row.answer);
    contextSource(row);
    field('Linked findings', row.findingIds?.join(', ') || 'None');
    field('Link recorded by', row.linkProvenance?.actor || 'Reviewer; individual not recorded');
    field(
      'Link rationale',
      row.linkProvenance?.reason ||
        'Related findings selected by the reviewer; no further rationale recorded',
    );
    if (row.linkProvenance?.recordedAt) field('Link recorded at', row.linkProvenance.recordedAt);
    field(
      'Question status',
      decisionStatusNames[row.effectiveRoutingStatus || row.routingStatus] || 'Draft question',
    );
    field('Response needed from', row.issueType);
    field('Question', row.question);
    field('Assigned to', row.assignedTo);
    field('Asked', row.askedAt);
    heading('Recorded response', 3);
    const response = row.response || {};
    for (const [label, key] of [
      ['Response', 'text'],
      ['Response author', 'author'],
      ['Channel', 'channel'],
      ['Received', 'receivedAt'],
      ['Reference', 'reference'],
      ['Response recorded by', 'recordedBy'],
    ])
      field(label, response[key]);
    heading('Internal approval & scope', 3);
    const approval = row.approval || {},
      applicability = approval.applicability || {};
    field(
      'Internal approval current',
      row.approvalCurrent ? 'Yes, for the recorded scope and sources' : 'No',
    );
    field('Preserved internal approval recorded by', approval.recordedBy);
    field('Approval date', approval.approvedAt);
    field('Approval rationale', approval.rationale);
    field('Vehicle', applicability.vehicle);
    field('Investor group / route', applicability.investorRoute);
    field(
      'Approved source versions',
      Object.entries(applicability.documentVersions || {})
        .map(([id, version]) => `${file(id)} version ${version}`)
        .join('; '),
    );
    field('Conditions', applicability.conditions);
    field('Workflow history entries retained', row.history?.length || 0);
    paragraph(
      'Recorded names are entered manually and are not authenticated. A preserved approval record does not establish current approval.',
    );
  }
  if (data.checkResults?.length) heading('Checks not verified');
  for (const check of data.checkResults || []) {
    heading(`${check.checkId} — ${check.target}`, 3);
    paragraph(check.reason);
    field('Next action', check.nextAction || 'Verify the requirement and original.');
    for (const e of check.evidence || []) source(e);
  }
  heading('Findings');
  if (!data.findings.length)
    paragraph(
      'No findings recorded. Automated checks do not establish completeness or legal approval.',
    );
  data.findings.forEach((finding, i) => {
    heading(`${i + 1}. ${finding.title}`, 3);
    field('Category', describeFinding(finding));
    field('Basis', finding.certainty);
    field('Priority', severityNames[finding.severity] || finding.severity);
    field('Review state', statusNames[finding.status] || finding.status);
    if (finding.checkId)
      field('Check', `${finding.checkId} · ${finding.detectionStatus || 'unverified'}`);
    field('Rule', finding.rule || 'Legacy deterministic rule; accuracy uncalibrated');
    field('Uncertainty', finding.uncertainty || 'Review applicability');
    paragraph(finding.description);
    heading('Question for counsel', 3);
    paragraph(finding.question);
    heading('Digitization impact', 3);
    paragraph(finding.impact);
    heading('Source evidence', 3);
    for (const e of finding.evidence || []) source(e);
    if (finding.resolutionEvidence?.length) {
      heading('Corrected source evidence', 3);
      for (const e of finding.resolutionEvidence) source(e);
    }
    if (finding.note) field('Reviewer note', finding.note);
  });
  if (data.revisions?.length) heading('Source revision history');
  for (const revision of data.revisions || []) {
    heading(`${revision.name} · Version ${revision.fromVersion} → ${revision.toVersion}`, 3);
    paragraph(revision.summary);
    if (revision.limited) paragraph('Revision comparison is limited.');
    for (const change of revision.changes || []) {
      field('Before', change.before.map((p) => p.text).join('\n'));
      field('After', change.after.map((p) => p.text).join('\n'));
    }
  }
  return {
    info: {
      title: `${data.package} — Review summary`,
      author: 'Preflight',
      subject: 'Internal document review',
    },
    pageSize: 'A4',
    pageMargins: [48, 56, 48, 54],
    defaultStyle: { font: 'Roboto', fontSize: 10.5, lineHeight: 1.25, color: '#202a2c' },
    styles: {
      eyebrow: { fontSize: 8, color: '#53636a', characterSpacing: 1, lineHeight: 1.5 },
      packageName: { fontSize: 17, color: '#53636a' },
      heading1: { fontSize: 30, bold: true, color: '#234e58' },
      heading2: { fontSize: 20, bold: true, color: '#234e58' },
      heading3: { fontSize: 11, bold: true },
      quotation: { fontSize: 10, color: '#33433f', italics: true },
    },
    pageBreakBefore: (node, container) =>
      !!node.headlineLevel &&
      (container.getFollowingNodesOnPage().length === 0 ||
        node.startPosition.top > node.startPosition.pageInnerHeight + 56 - 90),
    header: (page) =>
      page === 1
        ? null
        : {
            text: 'PREFLIGHT / REVIEW SUMMARY',
            fontSize: 8,
            color: '#53636a',
            characterSpacing: 1,
            margin: [48, 25, 48, 0],
          },
    footer: (page, pages) => ({
      text: `Preflight · Internal review    |    ${page} / ${pages}`,
      alignment: 'right',
      fontSize: 9,
      color: '#485451',
      margin: [48, 16, 48, 0],
    }),
    content,
  };
}

let engine;
export async function createReviewSummaryPdf(data) {
  engine ||= Promise.all([
    import('pdfmake/build/pdfmake.js'),
    import('pdfmake/build/vfs_fonts.js'),
  ]).then(([module, fonts]) => {
    const pdfmake = module.default;
    pdfmake.addVirtualFileSystem(fonts.default);
    return pdfmake;
  });
  const pdfmake = await engine.catch((error) => {
    engine = undefined;
    throw error;
  });
  return pdfmake.createPdf(reviewSummaryDefinition(data)).getBlob();
}
