import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { makeDemo } from '../src/features/documents/demo.js';

await mkdir('.impeccable/review', { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  for (const width of [1440, 390]) {
    const pkg = makeDemo();
    const context = await browser.newContext({
      viewport: { width, height: width === 390 ? 844 : 1000 },
    });
    await context.addInitScript((pkg) => {
      if (!localStorage.getItem('anduin-preflight-v1'))
        localStorage.setItem(
          'anduin-preflight-v1',
          JSON.stringify({ packages: [pkg], activeId: pkg.id }),
        );
    }, pkg);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(process.env.PREFLIGHT_TEST_URL || 'http://127.0.0.1:5180');
    const questions = () =>
      page
        .getByRole('navigation', { name: 'Package', exact: true })
        .getByRole('button', { name: /^Questions/ })
        .click();
    const fits = async () =>
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
        false,
        `Questions fits ${width}px`,
      );
    await questions();
    const queue = page.getByRole('region', { name: 'Questions and answers', exact: true });
    assert.equal(
      await queue.locator('.question-row').count(),
      pkg.findings.filter((finding) => finding.question && finding.status !== 'dismissed').length,
    );
    await fits();
    await page.screenshot({
      path: `.impeccable/review/questions-${width}.png`,
      fullPage: true,
      animations: 'disabled',
    });
    await queue.getByRole('button', { name: 'Record answer', exact: true }).first().click();
    const editor = page.getByRole('form', { name: 'Edit question & answer', exact: true });
    assert.ok(await editor.getByLabel('Question title', { exact: true }).inputValue());
    assert.equal(
      await editor.getByLabel('Response text', { exact: true }).getAttribute('aria-required'),
      'true',
    );
    await editor.getByRole('button', { name: 'Save response', exact: true }).click();
    await editor
      .getByRole('alert')
      .getByText('Enter the response text before saving a response.')
      .waitFor();
    assert.equal(
      await editor
        .getByLabel('Response text', { exact: true })
        .evaluate((el) => el === document.activeElement),
      true,
    );
    await editor
      .getByLabel('Response text', { exact: true })
      .fill('Synthetic answer: review the applicable minimum against both supplied sources.');
    await editor.getByRole('button', { name: /^1 Question$/ }).click();
    await editor.getByRole('button', { name: /^2 Answer$/ }).click();
    assert.match(
      await editor.getByLabel('Response text', { exact: true }).inputValue(),
      /Synthetic answer/,
    );
    await fits();
    await page.screenshot({
      path: `.impeccable/review/questions-answer-${width}.png`,
      fullPage: true,
      animations: 'disabled',
    });
    await editor.getByRole('button', { name: 'Save response', exact: true }).click();
    await queue.getByRole('button', { name: 'Edit answer', exact: true }).waitFor();
    const savedState = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('anduin-preflight-v1')),
    );
    const saved = savedState.packages.find((item) => item.id === pkg.id).intakeContext.decisions[0];
    assert.equal(saved.approval, null);
    assert.equal(saved.routingStatus, 'response-recorded');
    assert.deepEqual(saved.findingIds, [pkg.findings[0].id]);
    await queue.getByRole('button', { name: 'Review internal approval', exact: true }).click();
    await editor.getByRole('button', { name: 'Record internal approval', exact: true }).click();
    await editor.getByRole('alert').waitFor();
    assert.match(await editor.getByRole('alert').innerText(), /response author/);
    await fits();
    await page.screenshot({
      path: `.impeccable/review/questions-approval-${width}.png`,
      fullPage: true,
      animations: 'disabled',
    });
    await editor.getByRole('button', { name: 'Save draft', exact: true }).click();
    await queue.getByRole('button', { name: /^Answer saved/ }).click();
    assert.equal(await queue.locator('.question-row').count(), 1);
    await queue
      .getByRole('searchbox', { name: 'Find a question' })
      .fill('no match for this search');
    await queue.getByText('No matching questions', { exact: true }).waitFor();
    await queue.getByRole('button', { name: 'Show all questions', exact: true }).click();
    await page.reload();
    await questions();
    await queue.getByRole('button', { name: 'Edit answer', exact: true }).waitFor();
    await page.evaluate(() => {
      const state = JSON.parse(localStorage.getItem('anduin-preflight-v1'));
      const sourceId = state.packages[0].intakeContext.decisions[0].source.documentId;
      state.packages[0].documents.find((document) => document.id === sourceId).version += 1;
      localStorage.setItem('anduin-preflight-v1', JSON.stringify(state));
    });
    await page.reload();
    await questions();
    await queue.getByRole('button', { name: 'Edit answer', exact: true }).click();
    await editor.getByRole('complementary', { name: 'Sources need review' }).waitFor();
    assert.match(
      await editor.getByRole('complementary', { name: 'Sources need review' }).innerText(),
      /source|evidence/i,
    );
    await fits();
    await page.screenshot({
      path: `.impeccable/review/questions-stale-${width}.png`,
      fullPage: true,
      animations: 'disabled',
    });
    assert.deepEqual(errors, []);
    await context.close();
  }
} finally {
  await browser.close();
}
console.log(
  'Questions desktop/mobile: queue, required answer, draft preservation, save/reload, approval gates, filtering and overflow passed.',
);
