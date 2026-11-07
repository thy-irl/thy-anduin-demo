import assert from 'node:assert/strict';
import { readPdfText } from './pdf-text.mjs';
import { chromium } from '@playwright/test';
import { analyze } from '../src/features/analysis/engine.js';
import { agreementText, memorandumText } from './fixtures/review-sources.js';

const documents = [agreementText('250,000'), memorandumText].map((text, i) => ({
  id: `source-${i}`,
  name: i ? 'Memorandum.txt' : 'Agreement.txt',
  type: 'TXT',
  version: 1,
  size: text.length,
  pages: [{ number: 1, text, status: 'searchable text' }],
}));
const historicalTask = {
  id: 'old-task',
  title: 'INACTIVE_PLAN_SENTINEL',
  customHistory: { preserve: true },
};
const pkg = {
  id: 'review-only',
  name: 'Review-only browser regression',
  documents,
  findings: analyze(documents),
  activity: [],
  createdAt: new Date().toISOString(),
  intakeContext: { tasks: [historicalTask] },
};
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const context = await browser.newContext();
  await context.addInitScript(
    (initial) => {
      if (!localStorage.getItem('anduin-preflight-v1'))
        localStorage.setItem('anduin-preflight-v1', JSON.stringify(initial));
    },
    { packages: [pkg], activeId: pkg.id },
  );
  const page = await context.newPage(),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(process.env.PREFLIGHT_TEST_URL || 'http://127.0.0.1:5176');
  const tab = (label) =>
    page
      .getByRole('navigation', { name: 'Package', exact: true })
      .getByRole('button', { name: new RegExp(`^${label}(?:\\s+\\d+)?$`) });
  assert.equal(await page.getByRole('button', { name: 'Requirements & work plan' }).count(), 0);
  const originalQueue = await page
    .getByRole('region', { name: 'Review queue', exact: true })
    .innerHTML();
  await tab('Documents').click();
  await page.getByText('Document identity & review requirements', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Add configuration task' }).count(), 0);
  assert.equal(await page.getByRole('button', { name: 'Add population' }).count(), 0);
  await tab('Review').click();
  assert.equal(
    await page.getByRole('region', { name: 'Review queue', exact: true }).innerHTML(),
    originalQueue,
  );

  await tab('Documents').click();
  await page.getByRole('button', { name: 'Edit identity for Agreement.txt', exact: true }).click();
  await page.getByLabel('Fund / vehicle', { exact: true }).fill('Cedar Learning Fund, L.P.');
  await page.getByLabel('Document role', { exact: true }).selectOption('subscription agreement');
  await page.getByLabel('Source quote', { exact: true }).fill(documents[0].pages[0].text);
  await page.getByRole('button', { name: 'Save identity', exact: true }).click();
  await page.getByRole('button', { name: 'Add requirement', exact: true }).click();
  await page
    .getByLabel('Required / referenced item', { exact: true })
    .fill('Subscription agreement');
  await page.getByLabel('Supplied document', { exact: true }).selectOption('source-0');
  await page.getByLabel('Source document', { exact: true }).selectOption('source-0');
  await page.getByLabel('Source quote', { exact: true }).fill(documents[0].pages[0].text);
  await page.getByRole('button', { name: 'Save entry', exact: true }).click();

  await tab('Review').click();
  await page.getByRole('button', { name: /Review .*minimums? .*differ/i }).click();
  await page.getByRole('button', { name: 'Draft question', exact: true }).click();
  await page.getByRole('form', { name: 'Edit question & answer', exact: true }).waitFor();
  assert.equal(await tab('Questions').getAttribute('aria-current'), 'page');
  assert.match(
    await page.getByLabel('Clarification question', { exact: true }).inputValue(),
    /minimum/i,
  );
  await page.getByRole('button', { name: 'Save question', exact: true }).click();
  await page
    .locator('.question-row')
    .filter({ has: page.getByRole('heading', { name: /minimums? .*differ/i }) })
    .getByRole('button', { name: 'Record answer', exact: true })
    .click();
  await page.locator('.question-response-details > summary').click();
  for (const [label, value] of [
    ['Response text', 'Synthetic response for Class A entities; review the applicable minimum.'],
    ['Who provided the response', 'Synthetic counsel'],
    ['How it was received', 'Email'],
    ['Response received date', '2026-11-07'],
    ['Email, document or other reference', 'Synthetic email reference'],
    ['Response recorded by', 'Synthetic reviewer'],
  ])
    await page.getByLabel(label, { exact: true }).fill(value);
  await page.getByRole('button', { name: 'Save response', exact: true }).click();
  const state = () =>
    page.evaluate(() =>
      JSON.parse(localStorage.getItem('anduin-preflight-v1')).packages.find(
        (p) => p.id === 'review-only',
      ),
    );
  assert.equal((await state()).intakeContext.decisions[0].approval, null);
  await page.getByRole('button', { name: 'Review internal approval', exact: true }).click();
  for (const [label, value] of [
    ['Internal approval recorded by', 'Synthetic lead'],
    ['Internal approval date', '2026-11-07'],
    ['Internal approval rationale', 'Synthetic scope and both sources reviewed'],
    ['Fund or vehicle covered', 'Cedar Learning Fund, L.P.'],
    ['Investor group or application route', 'Class A entities — initial subscription'],
  ])
    await page.getByLabel(label, { exact: true }).fill(value);
  await page.locator('summary').filter({ hasText: 'Approval source documents' }).click();
  const sourceGroup = page.getByRole('group', {
    name: 'Approval source documents · required for approval',
    exact: true,
  });
  for (const checkbox of await sourceGroup.getByRole('checkbox').all()) await checkbox.check();
  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  assert.equal((await state()).intakeContext.decisions[0].approval, null);
  await page.getByRole('button', { name: 'Review internal approval', exact: true }).click();
  await page
    .getByRole('form')
    .getByRole('button', { name: 'Record internal approval', exact: true })
    .click();
  assert.equal((await state()).intakeContext.decisions[0].routingStatus, 'approved');
  await tab('Readiness').click();
  assert.equal(await page.getByText('Linked tasks and sources', { exact: true }).count(), 0);
  assert.equal(await page.getByText('INACTIVE_PLAN_SENTINEL', { exact: false }).count(), 0);
  await tab('Questions').click();
  await page.locator('.question-other-downloads > summary').click();
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download review summary (PDF)', exact: true }).click();
  const download = await downloadEvent;
  assert.match(download.suggestedFilename(), /review-summary\.pdf$/);
  const summary = await readPdfText(await download.path());
  assert.match(summary, /minimums? .*differ/i);
  assert.match(summary, /Synthetic counsel/);
  assert.equal(summary.includes('INACTIVE_PLAN_SENTINEL'), false);

  await page.getByRole('button', { name: 'Add / replace files', exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: 'Agreement.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from(agreementText('500,000')),
  });
  await page.getByRole('button', { name: 'Upload & recheck', exact: true }).click();
  await page
    .getByRole('button', { name: 'Close upload', exact: true })
    .waitFor({ state: 'detached' });
  await tab('Documents').click();
  await page.getByRole('heading', { name: 'Source revisions', exact: true }).waitFor();
  await tab('Questions').click();
  await page
    .getByText(
      'The answer or its sources changed. Review them before recording internal approval again.',
      { exact: false },
    )
    .waitFor();
  await page.reload();
  await tab('Questions').click();
  const saved = await state();
  assert.deepEqual(saved.intakeContext.tasks, [historicalTask]);
  assert.equal(saved.intakeContext.decisions[0].response.author, 'Synthetic counsel');
  assert.equal(saved.documents.find((d) => d.id === 'source-0').version, 2);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: '/tmp/preflight-screen-removal/questions-mobile.png',
    fullPage: true,
  });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  assert.deepEqual(errors, []);
  console.log(
    'Review scope browser regression passed: unchanged queue, document declarations, clarification routing, response/draft/approval separation, summary, revisions, persistence and mobile layout.',
  );
} finally {
  await browser.close();
}
