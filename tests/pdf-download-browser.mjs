import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { readPdfText } from './pdf-text.mjs';

await mkdir('.impeccable/review', { recursive: true });
const url = process.env.PREFLIGHT_TEST_URL || 'http://127.0.0.1:5177';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 } });
    const page = await context.newPage(),
      externalRequests = [];
    page.on('request', (r) => {
      if (!['127.0.0.1', 'localhost'].includes(new URL(r.url()).hostname))
        externalRequests.push(r.url());
    });
    await page.goto(url);
    for (const tab of ['Readiness', 'Questions']) {
      await page
        .getByRole('navigation', { name: 'Package', exact: true })
        .getByRole('button', { name: new RegExp(`^${tab}(?:\\s+\\d+)?$`) })
        .click();
      if (tab === 'Questions') await page.locator('.question-other-downloads > summary').click();
      const downloadEvent = page.waitForEvent('download');
      await page
        .getByRole('button', { name: 'Download review summary (PDF)', exact: true })
        .click();
      const download = await downloadEvent;
      assert.match(download.suggestedFilename(), /review-summary\.pdf$/);
      const path = `.impeccable/review/summary-${tab.toLowerCase()}-${width}.pdf`;
      await download.saveAs(path);
      const text = await readPdfText(path);
      assert.match(text, /Internal review status: BLOCKED/);
      assert.match(text, /Minimum investment amounts differ/);
      assert.match(text, /Subscription Agreement\.pdf/);
      assert.match(text, /not legal approval/);
      await page
        .getByRole('button', { name: 'Download review summary (PDF)', exact: true })
        .waitFor({ state: 'visible' });
    }
    assert.deepEqual(externalRequests, [], 'PDF generation must not contact external services');
    await context.close();
  }
  // A failed lazy import must show a recoverable error and re-enable download.
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.route('**/src/features/review/pdf.js*', (route) => route.abort());
  await page.goto(url);
  await page
    .getByRole('navigation', { name: 'Package', exact: true })
    .getByRole('button', { name: 'Readiness', exact: true })
    .click();
  const button = page.getByRole('button', { name: 'Download review summary (PDF)', exact: true });
  await button.click();
  await page.getByRole('alert').filter({ hasText: 'The PDF could not be generated' }).waitFor();
  assert.equal(await button.isEnabled(), true);
  await context.close();
  console.log(
    'PDF downloads passed: Questions/Readiness, desktop/mobile, real PDF text extraction, all findings and citations, no external requests and recoverable failure.',
  );
} finally {
  await browser.close();
}
