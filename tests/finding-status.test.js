import assert from 'node:assert/strict';
import test from 'node:test';
import { findingQueueStatus } from '../src/lib/workflow.js';

const finding = { id: 'finding', status: 'open', severity: 'blocking' };
const response = {
  findingIds: ['finding'],
  response: { text: 'Recorded answer' },
  routingStatus: 'response-recorded',
};

test('queue status distinguishes a recorded response from verified internal approval', () => {
  const operations = { decisions: [response] };
  const before = JSON.stringify({ finding, operations });
  assert.deepEqual(findingQueueStatus(finding, operations), {
    label: 'Response recorded',
    kind: 'recorded',
  });
  assert.equal(
    findingQueueStatus(finding, {
      decisions: [{ ...response, routingStatus: 'approved' }],
    }).label,
    'Response recorded',
  );
  assert.deepEqual(
    findingQueueStatus(finding, { decisions: [{ ...response, approvalCurrent: true }] }),
    { label: 'Internally approved', kind: 'approved' },
  );
  assert.equal(JSON.stringify({ finding, operations }), before);
});

test('stale approval takes precedence over other approvals and closed review labels', () => {
  const operations = {
    decisions: [
      { ...response, approvalCurrent: true },
      { ...response, effectiveRoutingStatus: 'needs-reconfirmation' },
    ],
  };
  assert.deepEqual(findingQueueStatus({ ...finding, status: 'resolved' }, operations), {
    label: 'Approval needs recheck',
    kind: 'recheck',
  });
  assert.equal(
    findingQueueStatus({ ...finding, status: 'dismissed' }, operations).label,
    'Dismissed',
  );
});

test('queue status preserves review states and ignores unrelated responses', () => {
  assert.equal(findingQueueStatus(finding).label, 'Unreviewed');
  assert.equal(findingQueueStatus({ ...finding, status: 'confirmed' }).label, 'Issue confirmed');
  assert.equal(findingQueueStatus({ ...finding, status: 'resolved' }).label, 'Marked resolved');
  assert.equal(
    findingQueueStatus({ ...finding, status: 'resolved', resolutionEvidence: [{}] }).label,
    'Source corrected',
  );
  assert.equal(
    findingQueueStatus(finding, {
      decisions: [{ findingIds: ['finding'], routingStatus: 'awaiting-response' }],
    }).label,
    'Awaiting response',
  );
  assert.equal(
    findingQueueStatus(finding, {
      decisions: [{ ...response, findingIds: ['other'], approvalCurrent: true }, {}],
    }).label,
    'Unreviewed',
  );
  assert.equal(
    findingQueueStatus({ ...finding, severity: 'advisory' }, { decisions: [response] }).label,
    'Response recorded',
  );
});
