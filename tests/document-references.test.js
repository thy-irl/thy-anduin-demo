import test from 'node:test';
import assert from 'node:assert/strict';
import { documentReferences, documentSections } from '../src/features/documents/references.js';
import { makeDemoPackages } from '../src/features/documents/demo.js';
import { analyzePackage } from '../src/features/analysis/engine.js';
import { evaluateReadiness } from '../src/features/readiness/readiness.js';

function review(pkg) {
  const analysis = analyzePackage(pkg.documents, pkg.intakeContext);
  return { analysis, readiness: evaluateReadiness(pkg, analysis) };
}
test('future K-1 is a source-backed note, not an action or a supplied attachment', () => {
  const pkg = makeDemoPackages()[1];
  const { analysis, readiness } = review(pkg);
  const result = documentReferences(analysis, pkg.documents, readiness);
  assert.equal(result.attention.length, 0);
  assert.equal(result.notes.length, 1);
  assert.equal(result.notes[0].label, 'Schedule K-1');
  assert.equal(result.notes[0].status, 'Not required for this package');
  assert.match(result.notes[0].reference.evidence.text, /not a required subscription attachment/);
  assert.ok(result.matched.length);
  const sections = documentSections(analysis.inventory, analysis.references);
  assert.ok(!sections.some((s) => /^Schedule K/.test(s.title)));
  assert.equal(sections.filter((s) => s.title === 'Subscription Agreement').length, 1);
  assert.equal(readiness.state, 'READY');
});
test('missing required content stays actionable and links to its finding', () => {
  const pkg = makeDemoPackages()[0];
  const { analysis, readiness } = review(pkg);
  const result = documentReferences(analysis, pkg.documents, readiness);
  const missing = result.attention.find((r) => r.label === 'Exhibit D');
  assert.ok(missing);
  assert.ok(missing.findingId);
  assert.equal(result.attention.length, 2);
  assert.ok(missing.mentions.length > 1);
  assert.ok(pkg.findings.some((f) => f.id === missing.findingId));
  assert.equal(readiness.state, 'BLOCKED');
});
test('a tax-form mention without an explicit exclusion still needs a check', () => {
  const reference = {
    kind: 'legislative/tax form',
    target: 'Schedule K',
    classification: 'external document not supplied',
    evidence: {
      documentId: 'doc',
      documentVersion: 1,
      page: 1,
      text: 'Schedule K-1 must be supplied before acceptance.',
    },
    targets: [],
  };
  const doc = { id: 'doc', version: 1, pages: [{ number: 1, text: reference.evidence.text }] };
  const result = documentReferences({ references: [reference], findings: [] }, [doc]);
  assert.equal(result.notes.length, 0);
  assert.equal(result.attention.length, 1);
});
test('stale evidence and an active finding cannot be hidden as an informational exclusion', () => {
  const pkg = makeDemoPackages()[1];
  const { analysis } = review(pkg);
  const tax = analysis.references.find((r) => r.kind === 'legislative/tax form');
  const stale = structuredClone(pkg.documents);
  stale[0].version++;
  assert.equal(documentReferences(analysis, stale).notes.length, 0);
  analysis.findings.push({ id: 'required-form', target: tax.target, evidence: [tax.evidence] });
  const result = documentReferences(analysis, pkg.documents, {
    blockers: [{ findingId: 'required-form' }],
  });
  assert.equal(result.notes.length, 0);
  assert.ok(result.attention.some((r) => r.findingId === 'required-form'));
});
