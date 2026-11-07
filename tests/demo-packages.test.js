import test from 'node:test';
import assert from 'node:assert/strict';
import { makeDemoPackages, addDemoPackages } from '../src/features/documents/demo.js';
import { analyzePackage } from '../src/features/analysis/engine.js';
import { evaluateReadiness } from '../src/features/readiness/readiness.js';
import { migrateReviewState } from '../src/features/review/review.js';
import { readFile } from 'node:fs/promises';

test('supplied demos show eight open findings and a genuinely ready handoff after migration', () => {
  const state = migrateReviewState({ packages: makeDemoPackages() });
  const [open, ready] = state.packages;
  assert.equal(open.findings.filter((f) => f.status === 'open').length, 8);
  assert.equal(
    evaluateReadiness(open, analyzePackage(open.documents, open.intakeContext)).state,
    'BLOCKED',
  );
  assert.equal(
    evaluateReadiness(ready, analyzePackage(ready.documents, ready.intakeContext)).state,
    'READY',
  );
  assert.ok(ready.intakeContext.decisions[0].response.text);
  assert.ok(ready.intakeContext.decisions[0].approval.snapshot);
  for (const p of state.packages)
    for (const d of p.documents) {
      assert.ok(d.samplePath);
      assert.ok(d.originalKey);
    }
  const revised = structuredClone(ready);
  revised.documents[0].version++;
  assert.notEqual(
    evaluateReadiness(revised, analyzePackage(revised.documents, revised.intakeContext)).state,
    'READY',
  );
});

test('adding demos preserves all saved data and active selection, and is idempotent', () => {
  const existing = { id: 'mine', documents: [], findings: [], scoping: { legacy: true } };
  const state = { packages: [existing], activeId: 'mine' };
  const next = addDemoPackages(state);
  assert.equal(next.packages[0], existing);
  assert.equal(next.activeId, 'mine');
  assert.equal(next.packages.length, 4);
  assert.deepEqual(addDemoPackages(next), next);
  const first = makeDemoPackages();
  first[0].documents[0].pages[0].text = 'changed';
  assert.notEqual(makeDemoPackages()[0].documents[0].pages[0].text, 'changed');
});

test('requirement demo retains current citations, supplied originals and a missing exhibit', async () => {
  const pkg = migrateReviewState({ packages: makeDemoPackages() }).packages[2];
  assert.ok(pkg, 'The package requirement demo is available');
  const [missing, supplied] = pkg.intakeContext.requirements;
  assert.equal(missing.documentId, '');
  assert.equal(missing.label, 'Exhibit D — Beneficial Ownership');
  assert.ok(pkg.documents.some((doc) => doc.id === supplied.documentId));
  for (const row of pkg.intakeContext.requirements) {
    const source = pkg.documents.find((doc) => doc.id === row.source.documentId);
    assert.equal(source.version, row.source.documentVersion);
    assert.ok(
      source.pages.find((page) => page.number === row.source.page).text.includes(row.source.quote),
    );
  }
  for (const doc of pkg.documents) {
    const original = await readFile(
      new URL(`../public/${doc.samplePath}`, import.meta.url),
      'utf8',
    );
    assert.equal(original, doc.pages[0].text);
    assert.equal(Buffer.byteLength(original), doc.size);
  }
  const analysis = analyzePackage(pkg.documents, pkg.intakeContext);
  assert.ok(
    analysis.findings.some(
      (finding) =>
        finding.requirementIds?.includes(missing.id) ||
        finding.identity === `missing_document:requirement:${missing.id}`,
    ),
  );
  assert.equal(evaluateReadiness(pkg, analysis).state, 'BLOCKED');
});
