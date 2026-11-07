import assert from 'node:assert/strict';
import test from 'node:test';
import {
  findingReviewGuidance,
  findingReviewExplanation,
  uniqueCitations,
} from '../src/features/review/presentation.js';

test('finding guidance distinguishes review, response and internal approval without mutating records', () => {
  const f = { id: 'finding', status: 'open', evidence: [{ text: 'Original quote' }] };
  const before = JSON.stringify(f);
  assert.equal(findingReviewGuidance(f).title, 'Review this finding');
  assert.match(findingReviewGuidance(f).next, /not legal conclusions/);
  assert.equal(findingReviewGuidance({ ...f, status: 'confirmed' }).title, 'Issue confirmed');
  assert.equal(findingReviewGuidance({ ...f, status: 'dismissed' }).title, 'Finding dismissed');
  const response = { findingIds: [f.id], response: { text: 'An answer' } };
  assert.equal(findingReviewGuidance(f, { decisions: [response] }).title, 'Response recorded');
  assert.equal(
    findingReviewGuidance(f, { decisions: [{ ...response, approvalCurrent: true }] }).title,
    'Internal approval recorded',
  );
  assert.equal(
    findingReviewGuidance(f, {
      decisions: [{ ...response, effectiveRoutingStatus: 'needs-reconfirmation' }],
    }).title,
    'Internal approval needs review',
  );
  assert.equal(
    findingReviewGuidance(f, {
      decisions: [{ ...response, findingIds: ['other'], approvalCurrent: true }],
    }).title,
    'Review this finding',
  );
  assert.equal(JSON.stringify(f), before);
});

test('a resolved label cannot imply a correction or current approval', () => {
  const f = { id: 'f', status: 'resolved' };
  assert.equal(findingReviewGuidance(f).title, 'Marked as resolved');
  assert.match(findingReviewGuidance(f).next, /still requires/);
  const corrected = findingReviewGuidance({
    ...f,
    resolutionEvidence: [{ text: 'Corrected quote' }],
  });
  assert.equal(corrected.title, 'Corrected source found');
  assert.match(corrected.next, /original finding is retained/);
  assert.match(corrected.next, /Check Readiness/);
});

test('concise explanations retain coverage caveats and manual wording', () => {
  const f = {
    type: 'Missing attachment',
    target: 'Schedule A',
    description: 'Full recorded explanation',
  };
  assert.match(findingReviewExplanation(f), /checked text/);
  assert.match(
    findingReviewExplanation({ ...f, classification: 'insufficient extraction coverage' }),
    /before treating it as missing/,
  );
  assert.match(
    findingReviewExplanation({ ...f, classification: 'ambiguous target' }),
    /possible match/,
  );
  assert.equal(findingReviewExplanation({ ...f, manual: true }), f.description);
  assert.equal(
    findingReviewExplanation({ type: 'Preflight', description: 'Precise check wording' }),
    'Precise check wording',
  );
  assert.equal(
    findingReviewGuidance(
      { id: 'f', status: 'resolved', resolutionEvidence: [{}] },
      { decisions: [{ findingIds: ['f'], effectiveRoutingStatus: 'needs-reconfirmation' }] },
    ).title,
    'Internal approval needs review',
  );
});

test('citation display removes exact duplicates while preserving distinct locations and originals', () => {
  const e = {
    documentId: 'd',
    document: 'Source.pdf',
    documentVersion: 1,
    page: 1,
    text: 'Exact quote',
    section: 'Terms',
    locator: 'Page',
    originalKey: 'bytes-1',
    span: { start: 0, end: 11 },
  };
  const items = [
    e,
    { ...e },
    { ...e, section: 'Appendix' },
    { ...e, locator: 'Paragraph' },
    { ...e, originalKey: 'bytes-2' },
    { ...e, span: { start: 20, end: 31 } },
  ];
  const before = JSON.stringify(items);
  assert.equal(uniqueCitations(items).length, 5);
  assert.equal(uniqueCitations(items)[0], e);
  assert.equal(JSON.stringify(items), before);
});
