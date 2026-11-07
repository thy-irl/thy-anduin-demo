import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { readPdfText } from './pdf-text.mjs';
import { chromium } from '@playwright/test';
import { analyzePackage } from '../src/features/analysis/engine.js';
import { findingCopy } from '../src/features/analysis/copy.js';
import { migrateReviewState } from '../src/features/review/review.js';
import {
  evaluateReadiness,
  recordReadinessAcknowledgement,
} from '../src/features/readiness/readiness.js';

const pkg = migrateReviewState({
  packages: [
    {
      id: 'ready-with-notes',
      name: 'Synthetic ready package',
      activity: [],
      findings: [],
      documents: [
        {
          id: 'source',
          name: 'Review source.docx',
          type: 'DOCX',
          version: 1,
          limitations: [
            'DOCX citations are XML paragraphs/segments, not original pages; page layout is not reconstructed.',
          ],
          pages: [
            {
              number: 1,
              text: 'SUBSCRIPTION AGREEMENT\n1. Entity investors\nEach entity investor must complete Exhibit D and provide beneficial ownership information.',
              status: 'searchable text',
            },
          ],
        },
      ],
    },
  ],
  activeId: 'ready-with-notes',
}).packages[0];
const analysis = analyzePackage(pkg.documents, pkg.intakeContext);
assert.equal(analysis.coverage.status, 'incomplete');
assert.ok(analysis.references.some((r) => r.classification !== 'resolved'));
pkg.findings = analysis.findings.map((f) => ({
  ...f,
  status: 'dismissed',
  note: 'Synthetic original inspected; reference is not applicable to this review.',
  history: [
    { event: 'Dismissed', status: 'dismissed', rationale: 'Synthetic reference reviewed.' },
  ],
}));
pkg.readinessReview = recordReadinessAcknowledgement(pkg, analysis, {
  recordedBy: 'Synthetic reviewer',
  rationale: 'Current package reviewed',
  coverageReview: 'Original inspected including reference and DOCX layout',
  acknowledged: true,
});
assert.equal(evaluateReadiness(pkg, analysis).state, 'READY');
await mkdir('.impeccable/review', { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 } });
    await context.addInitScript((pkg) => {
      if (!localStorage.getItem('anduin-preflight-v1'))
        localStorage.setItem(
          'anduin-preflight-v1',
          JSON.stringify({ packages: [pkg], activeId: pkg.id }),
        );
    }, pkg);
    const page = await context.newPage();
    await page.goto(process.env.PREFLIGHT_TEST_URL || 'http://127.0.0.1:5177');
    const summary = page.getByRole('region', { name: 'Package status', exact: true });
    await summary
      .getByRole('button', { name: 'Ready for internal handoff', exact: true })
      .waitFor();
    assert.equal(await summary.getByText('1 file needs verification', { exact: true }).count(), 0);
    assert.equal(await summary.getByText(/references? to verify/).count(), 0);
    await page
      .getByRole('button', { name: 'Run preflight again', exact: true })
      .waitFor({ state: 'visible' });
    await page
      .getByRole('navigation', { name: 'Package', exact: true })
      .getByRole('button', { name: /^Readiness/ })
      .click();
    await page.getByText('For internal handoff, send this summary', { exact: false }).waitFor();
    const downloadEvent = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download review summary (PDF)', exact: true }).click();
    const download = await downloadEvent;
    assert.match(download.suggestedFilename(), /review-summary\.pdf$/);
    const report = await readPdfText(await download.path());
    assert.match(report, /Internal review status: READY/);
    // No questions are selected, but the handoff summary retains dismissed findings.
    assert.ok(pkg.findings.length > 0);
    for (const finding of pkg.findings) assert.ok(report.includes(findingCopy(finding).title));
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
    await page.screenshot({ path: `.impeccable/review/handoff-${width}.png`, fullPage: true });
    await page.screenshot({ path: `.impeccable/review/status-${width}.png`, fullPage: true });
    await page.getByRole('button', { name: 'All packages', exact: true }).click();
    const card = page.getByRole('button', { name: /Synthetic ready package/ });
    await card.getByText('Ready for internal handoff', { exact: true }).waitFor();
    await page.screenshot({ path: `.impeccable/review/card-${width}.png`, fullPage: true });
    await card.click();
    await page
      .getByRole('navigation', { name: 'Package', exact: true })
      .getByRole('button', { name: /^Documents\s/ })
      .click();
    await page.getByText('Coverage', { exact: true }).first().waitFor();
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
    // A changed source must still invalidate readiness; presentation cannot grant approval.
    await page.evaluate(() => {
      const state = JSON.parse(localStorage.getItem('anduin-preflight-v1'));
      state.packages[0].documents[0].version = 2;
      localStorage.setItem('anduin-preflight-v1', JSON.stringify(state));
    });
    await page.reload();
    await summary.getByRole('button', { name: 'Internal handoff blocked', exact: true }).waitFor();
    await page
      .getByRole('navigation', { name: 'Package', exact: true })
      .getByRole('button', { name: /^Readiness/ })
      .click();
    await page.getByText('Download a progress snapshot.', { exact: false }).waitFor();
    const blockedDownloadEvent = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download review summary (PDF)', exact: true }).click();
    const blockedDownload = await blockedDownloadEvent;
    assert.match(
      await readPdfText(await blockedDownload.path()),
      /Internal review status: BLOCKED/,
    );
    await context.close();
  }
  console.log(
    'Package status regression passed: acknowledged readiness with retained DOCX/reference notes, exposed rerun, card/header consistency, mobile fit, changed-source blocking.',
  );
} finally {
  await browser.close();
}
