import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';
import fs from 'node:fs/promises';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const output = '.impeccable/review/document-references';
await fs.mkdir(output, { recursive: true });
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(process.env.PREFLIGHT_TEST_URL || 'http://127.0.0.1:5182');
  await page.getByRole('button', { name: 'Packages', exact: true }).click();
  await page.getByRole('button', { name: /Willow Quay — Ready to hand off/ }).click();
  await page.getByRole('button', { name: /^Documents\s/ }).click();
  const panel = page.locator('.inventory-panel');
  await expect(
    panel.getByRole('heading', { name: 'Document references', exact: true }),
  ).toBeVisible();
  await expect(
    panel.getByText('No reference issues detected in the checked text.', { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: /reference.*(?:noted|need.*review)/ })).toHaveCount(
    0,
  );
  await expect(panel.locator('.reference-support')).not.toHaveAttribute('open', '');
  await expect(panel.getByText('Not required for this package', { exact: false })).toBeHidden();
  await panel
    .locator('.reference-group > summary')
    .filter({ hasText: 'Other referenced documents' })
    .click();
  await expect(
    panel.locator('.reference-entry > summary').filter({ hasText: 'Schedule K-1' }),
  ).toContainText('Not required for this package');
  await panel.locator('.reference-entry > summary').filter({ hasText: 'Schedule K-1' }).click();
  await expect(
    panel.locator('blockquote').filter({ hasText: 'not a required subscription attachment' }),
  ).toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('anduin-preflight-v1')));
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await panel.screenshot({ path: `${output}/ready-${width}.png` });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  }
  await panel.locator('.reference-support > summary').click();
  await panel.locator('.document-outline > summary').click();
  await expect(
    panel.locator('.document-outline > details > summary').filter({ hasText: 'Schedule K' }),
  ).toHaveCount(0);
  await expect(
    panel
      .locator('.document-outline > details > summary')
      .filter({ hasText: 'Subscription Agreement' }),
  ).toHaveCount(1);
  await panel.locator('.reference-entry .evidence-link').first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: /Close/ }).first().click();
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('anduin-preflight-v1')));
  assert.deepEqual(after, saved, 'Inspecting sources and details must not change saved state');
  await page.getByRole('button', { name: 'Packages', exact: true }).click();
  await page.getByRole('button', { name: /Cedar Harbor — Open findings/ }).click();
  await page.getByRole('button', { name: /^Documents\s/ }).click();
  const missing = panel
    .locator('.reference-entry')
    .filter({ has: page.locator('summary strong', { hasText: 'Exhibit D' }) })
    .first();
  await missing.locator('summary').first().click();
  await expect(missing).toContainText('Referenced content not found');
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await panel.screenshot({ path: `${output}/attention-${width}.png` });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  }
  await missing.getByRole('button', { name: 'Open finding' }).click();
  await expect(page.getByRole('dialog', { name: 'Finding details', exact: true })).toBeVisible();
  assert.deepEqual(errors, []);
  console.log(
    'Document reference browser checks passed: actionable gaps, source-backed notes, heading deduplication, finding/source navigation, unchanged saved data and desktop/mobile layout.',
  );
} finally {
  await browser.close();
}
