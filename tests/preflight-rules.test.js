import test from 'node:test';
import assert from 'node:assert/strict';
import { analyze, analyzePackage, mergeFindings } from '../src/features/analysis/engine.js';
import { normalizeIntakeContext } from '../src/features/context/intake.js';
import { evaluateReadiness } from '../src/features/readiness/readiness.js';
import { reportData, reportMarkdown, migrateReviewState } from '../src/features/review/review.js';
import { makeDemo } from '../src/features/documents/demo.js';

const doc = (id, text) => ({
  id,
  name: `${id}.pdf`,
  type: 'PDF',
  version: 1,
  pages: [{ number: 1, text, status: 'searchable text' }],
});
const fund = 'Example Growth Fund Limited\n';
const check = (documents, id, context) => {
  const findings = analyze(documents, context).filter((f) => f.checkId === id);
  for (const f of findings) {
    assert.ok(['detected', 'needs_review', 'not_verified'].includes(f.detectionStatus));
    for (const e of f.evidence) {
      const d = documents.find((d) => d.id === e.documentId);
      assert.equal(e.documentVersion, d.version);
      assert.equal(
        d.pages.find((p) => p.number === e.page).text.slice(e.span.start, e.span.end),
        e.text,
      );
    }
  }
  return findings;
};
const requirement = (d, extra) => ({
  requirements: [
    {
      id: 'r',
      label: 'Ownership percentage',
      relationship: 'attached',
      check: 'field',
      documentId: 'form',
      source: { documentId: d.id, documentVersion: 1, page: 1, quote: d.pages[0].text },
      ...extra,
    },
  ],
});

test('annexure subsection references resolve inside the named annexure only', () => {
  const text =
    'See Annexure B §3.\nAnnexure A — Persons\n3. Controlling Persons\nName: ____\nAnnexure B — Details\n1. Investor details\n1.2 Address\nAddress: ____';
  const fs = check([doc('a', text)], 'broken_reference');
  assert.equal(fs.length, 1);
  assert.equal(fs[0].target, 'Annexure B §3');
  assert.equal(fs[0].detectionStatus, 'detected');
  assert.equal(
    check([doc('a', text + '\n3. Controlling Persons\nName: ____')], 'broken_reference').length,
    0,
  );
});
test('integer, symbol, table and missing schedule references are checked', () => {
  const fs = check(
    [
      doc(
        'a',
        '1. Instructions\nSee Section 7, §8 and Table 2. See Schedule 2.\nSchedule 1 — Details\nPlease provide name and address: __________',
      ),
    ],
    'broken_reference',
  );
  assert.deepEqual(
    new Set(fs.map((f) => f.target)),
    new Set(['Section 7', 'Section 8', 'Table 2', 'Schedule 2']),
  );
});
test('self-reference compares the enclosing number and suppresses duplicate broken-reference issues', () => {
  const fs = check(
    [
      doc(
        'a',
        '3.20 AEOI\nThe information in this paragraph 3.21 is required.\n3.21 AML\nSee information under §3.20.',
      ),
    ],
    'suspect_reference',
  );
  assert.equal(fs.length, 1);
  assert.match(fs[0].description, /3.20/);
  assert.equal(
    check(
      [doc('a', '3.20 AEOI\nInformation under §3.21.\n3.21 AML\nThis paragraph 3.21 applies.')],
      'suspect_reference',
    ).length,
    0,
  );
});
test('named received documents and required appendices match substantive embedded headings', () => {
  const a = doc(
    'a',
    fund +
      '1. Receipt\nThe Investor acknowledges receipt of the Key Investor Information Document.',
  );
  assert.equal(check([a], 'missing_document').length, 1);
  assert.equal(
    check(
      [
        a,
        doc(
          'kiid',
          fund +
            'Key Investor Information Document\nPlease read these investment risks before subscribing.',
        ),
      ],
      'missing_document',
    ).length,
    0,
  );
  const embedded = doc(
    'ppm',
    fund +
      'PRIVATE PLACEMENT MEMORANDUM\nPortfolio Explanatory Appendix\nPlease review the portfolio investment risks and strategy.',
  );
  const cfg = requirement(a, {
    check: 'document',
    label: 'Portfolio Explanatory Appendix',
    documentId: '',
  });
  assert.equal(check([a], 'missing_document', cfg).length, 2);
  assert.equal(check([a, embedded], 'missing_document', cfg).length, 1);
});
test('parties are compared by role and scope, including jurisdiction words and approved aliases', () => {
  const a = doc(
    'a',
    fund +
      'Portfolio Manager: Peregrine Capital Management IC Limited\nAdministrator: Example Fund Services (Guernsey) Limited',
  );
  const b = doc(
    'b',
    fund +
      'Portfolio Manager: Peregrine Capital Internal IC Limited\nAdministrator: Example Fund Services (Jersey) Limited',
  );
  const fs = check([a, b], 'party_name_mismatch');
  assert.equal(fs.length, 2);
  assert.ok(fs.every((f) => f.question.includes('Which legal name should be used?')));
  assert.equal(
    check(
      [a, doc('c', fund + 'Custodian: Example Fund Services (Jersey) Limited')],
      'party_name_mismatch',
    ).length,
    0,
  );
  const aliasSource = doc(
    'approval',
    'Example Fund Services Ltd. is an approved alias for Example Fund Services Limited.',
  );
  const cfg = requirement(aliasSource, {
    check: 'alias',
    label: 'Example Fund Services Ltd.',
    canonicalName: 'Example Fund Services Limited',
    partyRole: 'administrator',
    documentId: '',
  });
  assert.equal(
    check(
      [
        doc('x', fund + 'Administrator: Example Fund Services Limited'),
        doc('y', fund + 'Administrator: Example Fund Services Ltd.'),
        aliasSource,
      ],
      'party_name_mismatch',
      cfg,
    ).length,
    0,
  );
});
test('deadlines preserve action, anchor, day basis, time zone, category and class', () => {
  const a = doc(
    'a',
    fund +
      'For Class AA investors only.\nFunding is due on Closing Date.\nApplications must be submitted five days before Closing Date.',
  );
  const b = doc(
    'b',
    fund +
      'For Class AA investors only.\nFunding is due on the last Business Day before Closing Date.',
  );
  assert.equal(check([a, b], 'deadline_mismatch').length, 1);
  const cutoff = (zone) =>
    doc(zone, fund + `Class AA funding is due by 5 p.m. ${zone} time on Closing Date.`);
  assert.equal(check([cutoff('South Africa'), cutoff('Bermuda')], 'deadline_mismatch').length, 1);
  assert.equal(
    check(
      [
        doc('a', fund + 'Individual forms are due five days before closing.'),
        doc('b', fund + 'Entity forms are due two days before closing.'),
      ],
      'deadline_mismatch',
    ).length,
    0,
  );
  assert.equal(
    check(
      [
        a,
        doc(
          'b',
          fund +
            'For Class BB investors only.\nFunding is due two Business Days before Closing Date.',
        ),
      ],
      'deadline_mismatch',
    ).length,
    0,
  );
  assert.equal(
    check(
      [
        doc('a', fund + 'Funding is due 2 calendar days before Closing Date.'),
        doc('b', fund + 'Funding is due two Business Days before Closing Date.'),
      ],
      'deadline_mismatch',
    ).length,
    1,
  );
});
test('known typos honor approved vocabulary without flagging legal words', () => {
  assert.equal(
    check([doc('a', 'Invetsor Details\nPlease complete FACTA. Annexure information.')], 'typo')
      .length,
    2,
  );
  const a = doc('approval', 'FACTA is an approved abbreviation for this package.');
  assert.equal(
    check([doc('a', 'FACTA'), a], 'typo', requirement(a, { check: 'vocabulary', label: 'FACTA' }))
      .length,
    0,
  );
});
test('definitions normalize punctuation and whitespace; duplicate and mismatch are mutually exclusive', () => {
  const a = doc(
    'a',
    '1. Definitions\n“Closing Date” means 1 December 2027.\n"Closing Date" means 1 December 2027.',
  );
  assert.equal(check([a], 'duplicate_definition').length, 1);
  assert.equal(check([a], 'definition_mismatch').length, 0);
  a.pages[0].text += '\n“Closing Date” means 2 December 2027.';
  assert.equal(check([a], 'duplicate_definition').length, 0);
  assert.equal(check([a], 'definition_mismatch').length, 1);
  assert.equal(
    check(
      [
        doc('a', fund + '“Business Day” means London banking days.'),
        doc('b', fund + '"Business Day" means London\nbanking days.'),
      ],
      'definition_mismatch',
    ).length,
    0,
  );
  assert.equal(
    check(
      [
        doc('a', fund + '“Qualified Plan” includes IRAs.'),
        doc('b', fund + '“Qualified Plan” means a plan with at least 100 employees.'),
      ],
      'definition_mismatch',
    ).length,
    1,
  );
});
test('like values normalize currency and number words and keep evidence ages and scopes', () => {
  const age = (n) =>
    doc(n, fund + `For individual investors only.\nProof of address must be within ${n} months.`);
  assert.equal(check([age('three'), age('six')], 'value_mismatch').length, 1);
  assert.equal(
    check(
      [
        doc('a', fund + 'Class AA minimum subscription is USD 100,000.'),
        doc('b', fund + 'Class AA minimum subscription is US$100,000.'),
      ],
      'value_mismatch',
    ).length,
    0,
  );
  assert.equal(
    check(
      [
        doc('a', fund + 'Ownership threshold is 10%.'),
        doc('b', fund + 'Ownership threshold is 25%.'),
      ],
      'value_mismatch',
    ).length,
    1,
  );
});
test('configured fields count labeled blanks as present and require current requirement evidence', () => {
  const a = doc('agreement', 'Each beneficial owner must disclose ownership percentage.');
  const form = doc('form', 'Entity Form\nBeneficial owner name: ____\nAddress: ____');
  const cfg = requirement(a);
  assert.equal(check([a, form], 'required_field_missing', cfg).length, 1);
  form.pages[0].text += '\nOwnership percentage: ____';
  assert.equal(check([a, form], 'required_field_missing', cfg).length, 0);
  form.pages[0].text = 'Entity Form\nInstructions discuss ownership percentage.\nName: ____';
  assert.equal(check([a, form], 'required_field_missing', cfg).length, 1);
  cfg.requirements[0].source.documentVersion = 9;
  const result = analyzePackage([a, form], cfg);
  assert.ok(
    result.checkResults.some(
      (r) => r.checkId === 'required_field_missing' && r.status === 'not_verified',
    ),
  );
  assert.ok(
    !result.findings.some(
      (f) => f.checkId === 'required_field_missing' && f.detectionStatus === 'detected',
    ),
  );
});
test('contact purpose and approved version are explicit; ordinary dates never imply a version defect', () => {
  const a = doc(
    'a',
    fund + 'Send KYC originals to the administrator at: 10 Main Street, Guernsey.',
  );
  const b = doc('b', fund + 'Send KYC originals to the administrator at: 20 Main Street, Jersey.');
  assert.equal(check([a, b], 'contact_or_version_mismatch').length, 1);
  assert.equal(
    check(
      [
        doc('a', fund + 'Courier address: 10 Main Street.'),
        doc('b', fund + 'General correspondence address: 20 Main Street.'),
      ],
      'contact_or_version_mismatch',
    ).length,
    0,
  );
  const approved = doc('checklist', 'Approved entity form version: September 2025.');
  const form = doc('form', 'Entity Form\nVersion: August 2024\nName: ____');
  assert.equal(
    check(
      [approved, form],
      'contact_or_version_mismatch',
      requirement(approved, {
        check: 'version',
        label: 'Entity Form',
        expectedVersion: 'September 2025',
      }),
    ).length,
    1,
  );
  assert.equal(
    check(
      [doc('a', 'Dated September 2025'), doc('b', 'Dated August 2024')],
      'contact_or_version_mismatch',
    ).length,
    0,
  );
});
test('gaps and ambiguous references cannot become detected absences; repeated evidence is grouped', () => {
  const a = doc(
    'a',
    'See Annexure B §3.\nSee Annexure B §3.\nAnnexure B — Details\n1. Name\nName: ____',
  );
  a.pages.push({ number: 2, text: '', status: 'OCR required' });
  const fs = check([a], 'broken_reference');
  assert.equal(fs.length, 1);
  assert.equal(fs[0].detectionStatus, 'not_verified');
  assert.match(fs[0].verificationReason, /coverage|unreadable/i);
});
test('configuration normalizes compatibly and changes reopen reviewed findings', () => {
  const a = doc('a', 'Disclosure requirement: ownership percentage.'),
    form = doc('form', 'Name: ____');
  const cfg = requirement(a, { aliases: ['Percentage owned'] });
  assert.deepEqual(
    normalizeIntakeContext(normalizeIntakeContext(cfg)),
    normalizeIntakeContext(cfg),
  );
  assert.deepEqual(normalizeIntakeContext(cfg).requirements[0].aliases, ['Percentage owned']);
  const prior = analyze([a, form], cfg).map((f) => ({
    ...f,
    status: 'confirmed',
    note: 'Checked',
  }));
  assert.equal(mergeFindings(prior, analyze([a, form], cfg))[0].status, 'confirmed');
  form.version = 2;
  form.pages[0].text += '\nAddress: ____';
  assert.equal(mergeFindings(prior, analyze([a, form], cfg))[0].status, 'open');
});

test('annexures deep in a page establish their own numbering scopes', () => {
  const text =
    'See Annexure B §3.\n1. Introduction\nPlease read all instructions carefully.\n2. Terms\nThese instructions apply to this agreement.\nAnnexure A — Individuals\n3. Controlling Persons\nName: ____\nAnnexure B — Entities\n1. Details\nName: ____';
  assert.equal(check([doc('a', text)], 'broken_reference').length, 1);
});
test('deadline extraction separates clauses, amounts and anchor events and follows wrapped lines', () => {
  const a = doc(
    'a',
    fund +
      'Funding is due two Business\nDays before Closing Date. Applications are due five days before Closing Date.',
  );
  const b = doc(
    'b',
    fund +
      'Funding is due three Business Days before Closing Date. Applications are due four days before Closing Date.',
  );
  assert.equal(check([a, b], 'deadline_mismatch').length, 2);
  const clause = (amount, anchor) =>
    `The Investor must fund ${amount}% of the accepted commitment within three Business Days after receiving the ${anchor} notice.`;
  assert.equal(
    check(
      [doc('a', fund + clause(100, 'acceptance')), doc('b', fund + clause(50, 'capital call'))],
      'deadline_mismatch',
    ).length,
    0,
  );
});
test('named documents can match a unique supplied title without an inferred fund identity', () => {
  const a = doc('a', 'The investor acknowledges receipt of the Key Investor Information Document.');
  const b = doc(
    'b',
    'Key Investor Information Document\nPlease review the investment risks and portfolio strategy.',
  );
  assert.equal(check([a, b], 'missing_document').length, 0);
  assert.equal(
    check([a, b, doc('c', b.pages[0].text)], 'missing_document')[0].detectionStatus,
    'not_verified',
  );
});
test('separate legal agreement scopes keep local definitions', () => {
  assert.equal(
    check(
      [
        doc('a', fund + 'PRIVATE PLACEMENT MEMORANDUM\n“Business Day” means London banking days.'),
        doc(
          'b',
          fund + 'LIMITED PARTNERSHIP AGREEMENT\n“Business Day” means Bermuda banking days.',
        ),
      ],
      'definition_mismatch',
    ).length,
    0,
  );
});
test('incomplete checks block readiness and export both result statuses and source excerpts', () => {
  const a = doc('a', 'The form must collect Ownership percentage.'),
    form = doc('form', 'Name: ____');
  form.pages.push({ number: 2, text: '', status: 'OCR required' });
  const intakeContext = requirement(a),
    documents = [a, form],
    analysis = analyzePackage(documents, intakeContext);
  const pkg = { name: 'Review', documents, intakeContext, findings: analysis.findings };
  assert.ok(
    evaluateReadiness(pkg, analysis).blockers.some((b) => b.code === 'preflight-not-verified'),
  );
  const data = reportData(pkg, analysis);
  assert.match(reportMarkdown(data), /Checks not verified/);
  assert.equal(data.checkResults[0].status, 'not_verified');
  const findings = analyze([
    doc('broken', 'See Annexure B §3.\nAnnexure B — Details\n1. Details\nName: ____'),
  ]).map((f) => ({ ...f, includeInReport: true }));
  const d = [doc('broken', 'See Annexure B §3.\nAnnexure B — Details\n1. Details\nName: ____')];
  const exported = reportData({ name: 'Review', documents: d, findings }, analyzePackage(d));
  assert.match(reportMarkdown(exported), /Check: broken_reference \| Result: detected/);
  assert.match(reportMarkdown(exported), /See Annexure B §3/);
  const migrated = migrateReviewState({
    packages: [{ findings, intakeContext, scoping: { legacy: 'preserve' } }],
  }).packages[0];
  assert.deepEqual(migrated.scoping, { legacy: 'preserve' });
  assert.equal(migrated.findings[0].detectionStatus, 'detected');
});
test('the established guided sample retains its four source-backed issues', () => {
  const p = makeDemo();
  assert.equal(p.findings.length, 4);
  assert.equal(p.findings.filter((f) => f.checkId).length, 3);
});

test('deadline cutoff times are compared after the date as well as before it', () => {
  const funding = (zone, time = '5 p.m.') =>
    doc(zone, fund + `Class AA funding is due on Closing Date by ${time} ${zone} time.`);
  assert.equal(check([funding('South Africa'), funding('Bermuda')], 'deadline_mismatch').length, 1);
  assert.equal(
    check(
      [
        funding('Bermuda'),
        doc('other', fund + 'Class AA funding is due on Closing Date by 17:00 Bermuda time.'),
      ],
      'deadline_mismatch',
    ).length,
    0,
  );
});

test('a separately uploaded annexure resolves only for the applicable identified package', () => {
  const ref = doc('ref', fund + 'See Annexure B §3.');
  const body = doc(
    'annex',
    fund +
      'Annexure B — Entity details\n1. Name\nName: ____\n3. Controlling Persons\nPlease identify each controlling person: ____',
  );
  assert.equal(check([ref, body], 'broken_reference').length, 0);
});

test('different class minimums stay separate and repeated named-document requirements group evidence', () => {
  assert.equal(
    check(
      [
        doc('a', fund + 'Class AA minimum subscription is USD 100,000.'),
        doc('b', fund + 'Class BB minimum subscription is USD 150,000.'),
      ],
      'value_mismatch',
    ).length,
    0,
  );
  const a = doc('a', fund + 'Class AA checklist requires a portfolio Explanatory Appendix.');
  const b = doc('b', fund + 'Class AA checklist requires a portfolio Explanatory Appendix.');
  const fs = check([a, b], 'missing_document');
  assert.equal(fs.length, 1);
  assert.equal(fs[0].evidence.length, 2);
});
