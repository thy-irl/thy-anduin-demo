import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';
import { makeDemo } from '../src/features/documents/demo.js';

const pkg = makeDemo();
pkg.demo = false;
pkg.intakeContext = {
  decisions: Array.from({ length: 12 }, (_, index) => ({
    id: `question-pagination-${index + 1}`,
    title: `Question ${index + 1}`,
    question: `Please clarify item ${index + 1}.`,
    findingIds: pkg.findings.map((finding) => finding.id),
    source: {
      documentId: pkg.findings[0].evidence[0].documentId,
      documentVersion: 1,
      page: pkg.findings[0].evidence[0].page,
      quote: pkg.findings[0].evidence[0].text,
    },
  })),
};
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 } });
    try {
      await context.addInitScript(
        (state) => {
          if (!localStorage.getItem('anduin-preflight-v1'))
            localStorage.setItem('anduin-preflight-v1', JSON.stringify(state));
        },
        { packages: [pkg], activeId: pkg.id },
      );
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(process.env.PREFLIGHT_TEST_URL || 'http://127.0.0.1:5188');
      await page
        .getByRole('navigation', { name: 'Package', exact: true })
        .getByRole('button', { name: /^Questions(?:\s+\d+)?$/ })
        .click();
      const queue = page.getByRole('region', { name: 'Questions and answers', exact: true });
      const rows = queue.locator('.question-row');
      const pagination = queue.getByRole('navigation', { name: 'Questions pagination' });
      const next = pagination.getByRole('button', { name: 'Next', exact: true });
      const previous = pagination.getByRole('button', { name: 'Previous', exact: true });
      const search = queue.getByRole('searchbox', { name: 'Find a question' });
      const filters = queue.getByRole('group', { name: 'Filter questions' });
      await expect(rows).toHaveCount(5);
      await expect(previous).toBeDisabled();
      await expect(pagination).toContainText('Showing 1–5 of 12 questions');
      const before = await page.evaluate(() => localStorage.getItem('anduin-preflight-v1'));
      await next.click();
      await expect(rows.first()).toContainText('Question 6');
      await expect(pagination).toContainText('Page 2 of 3');
      await pagination.getByRole('button', { name: 'Page 3', exact: true }).click();
      await expect(rows).toHaveCount(2);
      await expect(pagination).toContainText('Showing 11–12 of 12 questions');
      await expect(next).toBeDisabled();
      assert.equal(await page.evaluate(() => localStorage.getItem('anduin-preflight-v1')), before);
      await search.fill('clarify item 12.');
      await expect(rows).toHaveCount(1);
      await expect(pagination).toContainText('Page 1 of 1');
      await search.fill('no matching question');
      await expect(rows).toHaveCount(0);
      await expect(pagination).toHaveCount(0);
      await expect(queue.getByText('No matching questions', { exact: true })).toBeVisible();
      await queue.getByRole('button', { name: 'Show all questions' }).click();
      await expect(rows).toHaveCount(5);
      await next.click();
      await filters.getByRole('button', { name: /^Needs an answer/ }).click();
      await expect(pagination).toContainText('Page 1 of 3');
      await next.click();
      await rows.first().getByRole('button', { name: 'Record answer', exact: true }).click();
      const form = page.getByRole('form', { name: 'Edit question & answer', exact: true });
      await expect(form).toBeVisible();
      await expect(pagination).toHaveCount(0);
      await form
        .getByLabel('Response text', { exact: true })
        .fill('Synthetic answer from page two.');
      await queue.getByRole('button', { name: /Back to questions/ }).click();
      await expect(pagination).toContainText('Page 2 of 3');
      assert.equal(await page.evaluate(() => localStorage.getItem('anduin-preflight-v1')), before);
      await rows.first().getByRole('button', { name: 'Record answer', exact: true }).click();
      await form
        .getByLabel('Response text', { exact: true })
        .fill('Synthetic answer from page two.');
      await form.getByRole('button', { name: 'Save response', exact: true }).click();
      await expect(form).toHaveCount(0);
      const saved = await page.evaluate(
        () => JSON.parse(localStorage.getItem('anduin-preflight-v1')).packages[0],
      );
      const answer = saved.intakeContext.decisions.find(
        (item) => item.id === 'question-pagination-6',
      );
      assert.ok(
        answer,
        JSON.stringify(
          saved.intakeContext.decisions.map(({ title, findingIds }) => ({ title, findingIds })),
        ),
      );
      assert.equal(answer.response.text, 'Synthetic answer from page two.');
      assert.equal(answer.approval, null);
      await expect(pagination).toContainText('of 11 questions');
      await filters.getByRole('button', { name: /^Answer saved/ }).click();
      await expect(rows).toHaveCount(1);
      await expect(rows.first()).toContainText('Synthetic answer from page two.');
      await expect(pagination).toContainText('Page 1 of 1');
      await expect(next).toBeDisabled();
      await expect(previous).toBeDisabled();
      await filters.getByRole('button', { name: /^All questions/ }).click();
      await expect(rows).toHaveCount(5);
      await pagination.scrollIntoViewIfNeeded();
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
        false,
      );
      await page.screenshot({
        path: `/tmp/preflight-questions-pagination-${width}.png`,
        fullPage: true,
      });
      assert.deepEqual(errors, []);
      console.log(`Questions pagination passed at ${width}px`);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
