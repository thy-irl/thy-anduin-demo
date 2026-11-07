import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';
import { makeDemo } from '../src/features/documents/demo.js';
import fs from 'node:fs/promises';
const pkg = makeDemo();
pkg.findings = ['blocking', 'review', 'advisory'].map((severity, index) => ({
  ...pkg.findings[0],
  id: `priority-${index}`,
  severity,
  status: index === 2 ? 'resolved' : index === 1 ? 'dismissed' : 'open',
}));
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const context = await browser.newContext();
  await context.addInitScript((pkg) => {
    if (!localStorage.getItem('anduin-preflight-v1'))
      localStorage.setItem(
        'anduin-preflight-v1',
        JSON.stringify({ packages: [pkg], activeId: pkg.id }),
      );
  }, pkg);
  const page = await context.newPage();
  await page.goto(process.env.PREFLIGHT_TEST_URL || 'http://127.0.0.1:5182');
  const filter = page.getByLabel('Priority filter', { exact: true });
  assert.deepEqual(await filter.locator('option').allTextContents(), [
    'All priorities',
    'Blocking',
    'Note',
  ]);
  const badges = page.locator('.finding-labels > .badge:first-child');
  assert.deepEqual(await badges.allTextContents(), ['Blocking', 'Blocking', 'Note']);
  const colors = await page.locator('.finding-labels').evaluateAll((groups) =>
    groups.map((group) =>
      [...group.querySelectorAll('.badge')].map((badge) => ({
        text: badge.textContent.trim(),
        ink: getComputedStyle(badge).color,
        background: getComputedStyle(badge).backgroundColor,
      })),
    ),
  );
  assert.equal(colors[0][0].background, 'rgb(255, 240, 241)');
  assert.equal(colors[2][0].background, 'rgb(255, 244, 194)');
  assert.equal(colors[2][0].ink, 'rgb(128, 91, 0)');
  assert.equal(colors[2][1].text, 'Marked resolved');
  assert.equal(colors[2][1].background, 'rgb(237, 244, 255)');
  assert.equal(colors[2][1].ink, 'rgb(23, 79, 157)');
  assert.equal(colors[1][1].text, 'Dismissed');
  assert.equal(colors[1][1].background, 'rgb(241, 243, 246)');

  const blockingTip = page.getByRole('tooltip', {
    name: 'Must be addressed before handoff',
    exact: true,
  });
  const noteTip = page.getByRole('tooltip', {
    name: 'Remains visible but does not block handoff by itself',
    exact: true,
  });
  await badges.nth(0).hover();
  await expect(blockingTip).toBeVisible();
  await blockingTip.hover();
  await expect(blockingTip).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(blockingTip).toBeHidden();
  await page.mouse.move(0, 0);
  await page.locator('.finding-row').nth(1).focus();
  await expect(blockingTip).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(blockingTip).toBeHidden();
  await filter.focus();
  await badges.nth(2).hover();
  await expect(noteTip).toBeVisible();
  await page.mouse.move(0, 0);
  await expect(noteTip).toBeHidden();
  await filter.selectOption('blocking');
  assert.equal(await badges.count(), 2);
  await filter.selectOption('advisory');
  assert.deepEqual(await badges.allTextContents(), ['Note']);
  await filter.selectOption('all');
  await page.getByRole('button', { name: 'Add issue', exact: true }).click();
  const priority = page.getByLabel('Issue priority', { exact: true });
  assert.deepEqual(await priority.locator('option').allTextContents(), ['Blocking', 'Note']);
  assert.equal(await priority.inputValue(), 'blocking');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.reload();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('anduin-preflight-v1')));
  assert.deepEqual(
    saved.packages[0].findings.map((f) => f.severity),
    ['blocking', 'review', 'advisory'],
  );
  await fs.mkdir('.impeccable/review/priority-labels', { recursive: true });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await badges.nth(2).hover();
    await expect(noteTip).toBeVisible();
    const bounds = await noteTip.boundingBox();
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width);
    await page.screenshot({
      path: `.impeccable/review/priority-labels/${width}.png`,
      fullPage: true,
    });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  }
  console.log(
    'Priority labels, hover text, grouped filter, manual choices, saved severity and responsive layout passed.',
  );
} finally {
  await browser.close();
}
