import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzePackage } from '../src/features/analysis/engine.js';
import { normalizeIntakeContext, reconcileFindingLinks } from '../src/features/context/intake.js';
import {
  evaluateReadiness,
  recordReadinessAcknowledgement,
} from '../src/features/readiness/readiness.js';
import { reportData, reportMarkdown, migrateReviewState } from '../src/features/review/review.js';
import {
  saveDecisionResolution,
  decisionWorkflowState,
} from '../src/features/context/decisions.js';

const makePackage = () => ({
  id: 'review-scope',
  name: 'Review scope',
  findings: [],
  activity: [],
  documents: [
    {
      id: 'source',
      name: 'Notes.txt',
      type: 'TXT',
      version: 1,
      pages: [{ number: 1, text: 'Review source text.', status: 'searchable text' }],
    },
  ],
  intakeContext: normalizeIntakeContext(),
});
const legacyTask = {
  id: 'old-task',
  title: 'HISTORICAL_PLAN_SENTINEL',
  owner: '',
  status: 'not-started',
  documentIds: ['missing'],
  documentVersions: {},
  findingIds: ['removed-finding'],
  fieldIds: ['old_field'],
  rule: 'Historical rule',
  testPlan: '',
  source: { documentId: 'missing', documentVersion: 1, page: 1, quote: 'old' },
  retainedExtension: { important: true },
};

test('historical tasks and populations do not block review or invalidate acknowledgement', () => {
  const pkg = makePackage(),
    analysis = analyzePackage(pkg.documents, pkg.intakeContext);
  pkg.readinessReview = recordReadinessAcknowledgement(pkg, analysis, {
    recordedBy: 'Reviewer',
    rationale: 'Sources inspected',
    coverageReview: 'Original inspected',
    acknowledged: true,
  });
  const before = evaluateReadiness(pkg, analysis);
  pkg.intakeContext.tasks = [legacyTask];
  pkg.intakeContext.applicability = [
    { id: 'old-population', label: 'Historical group', documentIds: ['missing'] },
  ];
  const after = evaluateReadiness(pkg, analyzePackage(pkg.documents, pkg.intakeContext));
  assert.equal(before.state, 'READY');
  assert.equal(after.state, 'READY');
  assert.equal(after.fingerprint, before.fingerprint);
  assert.equal(Object.hasOwn(after.checks, 'workTasks'), false);
  pkg.documents[0].version = 2;
  assert.equal(
    evaluateReadiness(pkg, analyzePackage(pkg.documents, pkg.intakeContext)).acknowledgement
      .current,
    false,
  );
});

test('legacy plans survive migration, context saves and finding reconciliation unchanged', () => {
  const pkg = makePackage();
  pkg.intakeContext.tasks = [legacyTask];
  pkg.scoping = { historical: true, custom: ['preserve'] };
  const migrated = migrateReviewState({ packages: [pkg], activeId: pkg.id }).packages[0];
  assert.deepEqual(migrated.intakeContext.tasks, [legacyTask]);
  assert.deepEqual(reconcileFindingLinks(migrated.intakeContext, []).tasks, [legacyTask]);
  assert.deepEqual(migrated.scoping, pkg.scoping);
});

test('review exports retain clarifications and sources without historical planning data', () => {
  const pkg = makePackage();
  pkg.intakeContext.tasks = [legacyTask];
  pkg.intakeContext.decisions = [
    {
      id: 'answer',
      title: 'Clarification retained',
      question: 'What applies?',
      response: { text: 'Response retained', author: 'Counsel' },
      impactedTaskIds: ['HISTORICAL_PLAN_SENTINEL'],
      history: [{ approval: { snapshot: { impactedTaskIds: ['HISTORICAL_PLAN_SENTINEL'] } } }],
    },
  ];
  const data = reportData(pkg, analyzePackage(pkg.documents, pkg.intakeContext));
  assert.equal(JSON.stringify(data).includes('HISTORICAL_PLAN_SENTINEL'), false);
  assert.equal(reportMarkdown(data).includes('Configuration work and dependencies'), false);
  assert.match(reportMarkdown(data), /Response retained/);
  assert.equal(data.operationalContext.documents.length, 0);
});

test('approval ignores inactive task links while preserving evidence and explicit approval gates', () => {
  const pkg = makePackage();
  const source = {
    documentId: 'source',
    documentVersion: 1,
    page: 1,
    quote: 'Review source text.',
  };
  const input = {
    id: 'decision',
    title: 'Clarify',
    question: 'What applies?',
    source,
    documentVersions: { source: 1 },
    impactedTaskIds: ['missing-legacy-task'],
    impactDisposition: 'scope-change',
    response: {
      text: 'Applies to the recorded route',
      author: 'Counsel',
      channel: 'email',
      receivedAt: '2026-11-07',
      reference: 'Email reference',
      recordedBy: 'Reviewer',
    },
    approval: {
      recordedBy: 'Lead',
      approvedAt: '2026-11-07',
      rationale: 'Reviewed',
      applicability: {
        vehicle: 'Example Fund',
        investorRoute: 'Entity',
        documentIds: ['source'],
        documentVersions: { source: 1 },
      },
    },
  };
  const context = { documents: pkg.documents, findings: [] };
  const approved = saveDecisionResolution(null, input, context, { recordApproval: true });
  assert.equal(decisionWorkflowState(approved, context).approvalCurrent, true);
  const draft = saveDecisionResolution(null, input, context);
  assert.equal(decisionWorkflowState(draft, context).approvalCurrent, false);
  const changed = { ...context, documents: [{ ...pkg.documents[0], version: 2 }] };
  assert.equal(decisionWorkflowState(approved, changed).approvalCurrent, false);
});
