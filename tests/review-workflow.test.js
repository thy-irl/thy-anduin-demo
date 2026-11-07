import assert from 'node:assert/strict';
import test from 'node:test';
import { findingDispositionError } from '../src/features/review/review.js';
import { saveDecisionResolution } from '../src/features/context/decisions.js';

test('dismissal requires a meaningful reviewer rationale without restricting other dispositions', () => {
  for (const note of [undefined, '', ' \n\t '])
    assert.match(findingDispositionError({ note }, 'dismissed'), /reason.*dismiss/i);
  assert.equal(
    findingDispositionError({ note: 'Not applicable to this investor.' }, 'dismissed'),
    '',
  );
  for (const status of ['open', 'confirmed', 'resolved'])
    assert.equal(findingDispositionError({}, status), '');
});

test('recording a response rejects empty and whitespace-only text without changing the draft', () => {
  for (const text of [undefined, '', ' \n\t ']) {
    const input = {
      id: 'answer',
      title: 'Minimum question',
      response: { text, author: 'Counsel' },
    };
    const before = structuredClone(input);
    assert.throws(
      () => saveDecisionResolution(null, input, {}, { recordResponse: true }),
      /enter.*response text/i,
    );
    assert.deepEqual(input, before);
  }
});

test('saving a response records its routing state without granting approval', () => {
  const saved = saveDecisionResolution(
    null,
    {
      id: 'answer',
      title: 'Minimum question',
      routingStatus: 'awaiting-response',
      response: { text: '  Please verify the applicable class.  ', author: 'Counsel' },
    },
    {},
    { recordResponse: true },
  );
  assert.equal(saved.response.text, 'Please verify the applicable class.');
  assert.equal(saved.response.author, 'Counsel');
  assert.equal(saved.routingStatus, 'response-recorded');
  assert.equal(saved.approval, null);
});

test('question and approval drafts can still be saved without response text', () => {
  const saved = saveDecisionResolution(null, {
    id: 'draft',
    title: 'Clarification draft',
    question: 'Which class applies?',
  });
  assert.equal(saved.routingStatus, 'draft');
  assert.equal(saved.approval, null);
});
