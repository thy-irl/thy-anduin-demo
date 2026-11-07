import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';
import { makeDemo } from '../src/features/documents/demo.js';

const pkg = makeDemo();
pkg.demo = false;
pkg.findings = Array.from({ length: 12 }, (_, index) => ({
  ...pkg.findings[0],
  manual: true,
  id: `pagination-${index + 1}`,
  title: `Pagination finding ${index + 1}`,
  severity: index < 7 ? 'blocking' : 'review',
  status: index < 11 ? 'open' : 'resolved',
}));
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
      const pagination = page.getByRole('navigation', { name: 'Review pagination' });
      const rows = page.locator('.findings-list .finding-row');
      const next = pagination.getByRole('button', { name: 'Next', exact: true });
      const previous = pagination.getByRole('button', { name: 'Previous', exact: true });
      await expect(rows).toHaveCount(5);
      await expect(pagination.getByRole('button', { name: 'Page 1', exact: true })).toHaveAttribute(
        'aria-current',
        'page',
      );
      await pagination.getByRole('button', { name: 'Page 3', exact: true }).click();
      await expect(rows).toHaveCount(2);
      await pagination.getByRole('button', { name: 'Page 1', exact: true }).click();
      await expect(previous).toBeDisabled();
      const savedBefore = await page.evaluate(() => localStorage.getItem('anduin-preflight-v1'));
      await next.click();
      await expect(pagination).toContainText('Showing 6–10 of 12 findings');
      await expect(rows).toHaveCount(5);
      await rows.first().click();
      const dialog = page.getByRole('dialog', { name: 'Finding details', exact: true });
      await expect(dialog).toContainText('Finding 6 of 12');
      await dialog.getByRole('button', { name: 'Previous finding', exact: true }).click();
      await expect(dialog).toContainText('Finding 5 of 12');
      await dialog.getByRole('button', { name: 'Close finding details', exact: true }).click();
      await next.click();
      await expect(rows).toHaveCount(2);
      await expect(pagination).toContainText('Showing 11–12 of 12 findings');
      await expect(next).toBeDisabled();
      assert.equal(
        await page.evaluate(() => localStorage.getItem('anduin-preflight-v1')),
        savedBefore,
      );
      await previous.click();
      await expect(pagination).toContainText('Page 2 of 3');
      await page
        .getByRole('textbox', { name: 'Search findings', exact: true })
        .fill('Pagination finding 12');
      await expect(rows).toHaveCount(1);
      await expect(pagination).toContainText('Page 1 of 1');
      await page
        .getByRole('textbox', { name: 'Search findings', exact: true })
        .fill('no matching pagination finding');
      await expect(rows).toHaveCount(0);
      await expect(pagination).toHaveCount(0);
      await expect(page.getByText('No matching findings', { exact: true })).toBeVisible();
      await page.getByRole('textbox', { name: 'Search findings', exact: true }).fill('');
      await next.click();
      await page.getByLabel('Priority filter', { exact: true }).selectOption('blocking');
      await expect(pagination).toContainText('Showing 1–5 of 7 findings');
      await next.click();
      await expect(rows).toHaveCount(2);
      await page.getByLabel('Review filter', { exact: true }).selectOption('closed');
      await expect(rows).toHaveCount(0);
      await page.getByLabel('Priority filter', { exact: true }).selectOption('all');
      await expect(rows).toHaveCount(1);
      await expect(pagination).toContainText('Page 1 of 1');
      await expect(next).toBeDisabled();
      await expect(previous).toBeDisabled();
      await page.getByLabel('Review filter', { exact: true }).selectOption('all');
      await pagination.scrollIntoViewIfNeeded();
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
        false,
      );
      await page.screenshot({
        path: `/tmp/preflight-review-pagination-${width}.png`,
        fullPage: true,
      });
      await page.evaluate(() => {
        const state = JSON.parse(localStorage.getItem('anduin-preflight-v1'));
        const source = state.packages[0].findings[0];
        state.packages[0].findings = Array.from({ length: 60 }, (_, index) => ({
          ...source,
          id: `large-pagination-${index}`,
          title: `Finding ${index + 1}`,
        }));
        localStorage.setItem('anduin-preflight-v1', JSON.stringify(state));
      });
      await page.reload();
      await pagination.getByRole('button', { name: 'Page 12', exact: true }).click();
      await expect(pagination).toContainText('Showing 56–60 of 60 findings');
      await expect(next).toBeDisabled();
      await pagination.getByRole('button', { name: 'Page 1', exact: true }).click();
      for (let index = 0; index < 3; index++) await next.click();
      await expect(pagination.getByRole('button', { name: 'Page 4', exact: true })).toHaveAttribute(
        'aria-current',
        'page',
      );
      await expect(pagination.getByRole('button')).toHaveCount(5);
      await pagination.scrollIntoViewIfNeeded();
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
        false,
      );
      await page.screenshot({
        path: `/tmp/preflight-review-pagination-many-${width}.png`,
        fullPage: true,
      });
      assert.deepEqual(errors, []);
      console.log(`Review pagination passed at ${width}px`);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
