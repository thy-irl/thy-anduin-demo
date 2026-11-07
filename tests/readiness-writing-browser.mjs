import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { analyze } from '../src/features/analysis/engine.js';
import { agreementText, memorandumText } from './fixtures/review-sources.js';
import { readinessBlockerCopy } from '../src/lib/workflow.js';

assert.match(readinessBlockerCopy({ code: 'finding-approval-stale' }).next, /approval again/);
assert.match(
  readinessBlockerCopy({
    code: 'finding-unresolved',
    decisionStatuses: [{ status: 'response-recorded' }],
  }).next,
  /record internal approval/,
);
assert.match(readinessBlockerCopy({ code: 'finding-unresolved' }).next, /dismiss.*reason/);
const documents = [agreementText('250,000'), memorandumText].map((text, i) => ({
  id: `source-${i}`,
  name: i ? 'Memorandum.txt' : 'Agreement.txt',
  type: 'TXT',
  version: 1,
  pages: [{ number: 1, text, status: 'searchable text' }],
}));
const pkg = {
  id: 'readiness-writing',
  name: 'Synthetic readiness review',
  documents,
  findings: analyze(documents),
  activity: [],
};
const finding = pkg.findings.find((f) => f.checkId === 'value_mismatch');
assert.ok(finding);
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
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(process.env.PREFLIGHT_TEST_URL || 'http://127.0.0.1:5177');
    await page.getByRole('button', { name: /Review .*minimums? .*differ/i }).click();
    await page.getByRole('button', { name: 'Record response', exact: true }).click();
    await page
      .getByLabel('Response text', { exact: true })
      .fill('Synthetic response: review both current sources and the applicable investor class.');
    await page.getByRole('button', { name: 'Save response', exact: true }).click();
    await page
      .getByRole('navigation', { name: 'Package', exact: true })
      .getByRole('button', { name: 'Readiness', exact: true })
      .click();
    const card = page
      .locator('.readiness-blocker')
      .filter({ has: page.getByRole('heading', { name: /minimums? .*differ/i }) });
    if (await page.getByRole('button', { name: 'Dismiss notification', exact: true }).count())
      await page.getByRole('button', { name: 'Dismiss notification', exact: true }).click();
    await card.getByText('Sources & requirements', { exact: true }).click();
    const rows = card.locator('.readiness-evidence');
    assert.equal(await rows.count(), finding.evidence.length);
    assert.equal(await card.locator('.readiness-evidence[open]').count(), 0);
    assert.match(await card.locator(':scope > p').innerText(), /record internal approval/);
    assert.equal(await card.locator('.readiness-assessment').evaluate((el) => el.open), false);
    await card.evaluate((el) => el.scrollIntoView({ block: 'start' }));
    await page.screenshot({
      path: `.impeccable/review/readiness-writing-${width}.png`,
      animations: 'disabled',
    });
    await rows.first().locator('summary').click();
    assert.equal(await rows.first().locator('blockquote').textContent(), finding.evidence[0].text);
    assert.equal(await rows.nth(1).evaluate((el) => el.open), false);
    await page.screenshot({
      path: `.impeccable/review/readiness-quote-${width}.png`,
      animations: 'disabled',
    });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
    await card.getByRole('button', { name: 'Record internal approval', exact: true }).click();
    await page.getByLabel('Internal approval recorded by', { exact: true }).waitFor();
    const saved = await page.evaluate(
      () => JSON.parse(localStorage.getItem('anduin-preflight-v1')).packages[0],
    );
    assert.equal(saved.intakeContext.decisions[0].approval, null);
    assert.equal(saved.intakeContext.decisions[0].routingStatus, 'response-recorded');
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log(
    'Readiness writing checks passed: desktop/mobile approval routing, concise next step, per-source quotation disclosure, exact citations and response/approval separation.',
  );
} finally {
  await browser.close();
}
