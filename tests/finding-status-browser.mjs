import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
import { makeDemo } from '../src/features/documents/demo.js';
import { findingCopy } from '../src/features/analysis/copy.js';

const pkg = makeDemo();
// Existing learning packages remain usable without showing tutorial controls.
pkg.learningSample = true;
pkg.intakeContext = {
  tasks: [{ id: 'historical-task', retained: 'unchanged' }],
  decisions: pkg.findings.slice(0, 3).map((finding, index) => ({
    id: `status-${index}`,
    title: finding.title,
    findingIds: [finding.id],
    question: finding.question,
    response: { text: index === 1 ? '' : 'Synthetic recorded response.' },
    routingStatus: ['response-recorded', 'awaiting-response', 'approved'][index],
  })),
};
const labels = ['Response recorded', 'Awaiting response', 'Approval needs recheck', 'Unreviewed'];
const output = '.impeccable/review/finding-status';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  for (const width of [1440, 390, 320]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 } });
    try {
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
      await page.goto(process.env.PREFLIGHT_TEST_URL || 'http://127.0.0.1:5189');
      const rowFor = (finding) =>
        page.getByRole('button', { name: `Review ${findingCopy(finding).title}`, exact: true });
      await expect(page.locator('.finding-row')).toHaveCount(4);
      for (const [index, finding] of pkg.findings.entries()) {
        const row = rowFor(finding);
        await expect(row.locator('.finding-status')).toHaveText(labels[index]);
        await expect(row.locator('.finding-labels .badge')).toHaveCount(2);
        const [priority, status] = await row.locator('.finding-labels .badge').all();
        const a = await priority.boundingBox();
        const b = await status.boundingBox();
        assert.ok(Math.abs(a.y - b.y) < 2, 'Priority and status are adjacent on the same line');
        assert.ok(b.x >= a.x + a.width, 'Workflow state follows priority');
        await expect(row).not.toContainText('Internal approval needed');
        await expect(row).not.toContainText('Selected for download');
      }
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
        false,
      );
      await page.screenshot({ path: `${output}/review-${width}.png`, fullPage: true });

      const savedBefore = await page.evaluate(() =>
        JSON.parse(localStorage.getItem('anduin-preflight-v1')),
      );
      for (const label of ['Documents', 'Questions', 'Readiness', 'Review']) {
        await page
          .getByRole('navigation', { name: 'Package', exact: true })
          .getByRole('button', { name: new RegExp(`^${label}(?:\\s+\\d+)?$`) })
          .click();
        await expect(
          page.locator('.screen-intro, .guided-example, .explain, .guide-modal'),
        ).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Help', exact: true })).toHaveCount(0);
      }
      await rowFor(pkg.findings[0]).click();
      const dialog = page.getByRole('dialog', { name: 'Finding details', exact: true });
      await dialog.locator('.record-trace > summary').click();
      await expect(dialog.getByText('Original citations', { exact: true })).toBeVisible();
      await expect(dialog.getByRole('button', { name: /Record internal approval/ })).toBeVisible();
      await dialog.getByRole('button', { name: 'Close finding details', exact: true }).click();
      const savedAfter = await page.evaluate(() =>
        JSON.parse(localStorage.getItem('anduin-preflight-v1')),
      );
      assert.deepEqual(
        savedAfter,
        savedBefore,
        'Viewing statuses and records must not change saved data',
      );
      assert.deepEqual(savedAfter.packages[0].intakeContext.tasks, pkg.intakeContext.tasks);
      assert.equal(savedAfter.packages[0].learningSample, true);
      await page.reload();
      await expect(rowFor(pkg.findings[0]).locator('.finding-status')).toHaveText(
        'Response recorded',
      );
      const lastRow = rowFor(pkg.findings[3]);
      await lastRow.click();
      await dialog.getByRole('button', { name: 'Confirm issue', exact: true }).click();
      await dialog.getByRole('button', { name: 'Close finding details', exact: true }).click();
      await expect(lastRow.locator('.finding-status')).toHaveText('Issue confirmed');
      await lastRow.click();
      await dialog.getByRole('button', { name: 'Mark as resolved', exact: true }).click();
      await dialog.getByRole('button', { name: 'Close finding details', exact: true }).click();
      await expect(lastRow.locator('.finding-status')).toHaveText('Marked resolved');
      await page.reload();
      await expect(lastRow.locator('.finding-status')).toHaveText('Marked resolved');
      await lastRow.click();
      await dialog.getByRole('button', { name: 'Reopen', exact: true }).click();
      await dialog.getByRole('button', { name: 'Close finding details', exact: true }).click();
      await expect(lastRow.locator('.finding-status')).toHaveText('Unreviewed');
      assert.deepEqual(errors, []);
      console.log(`Finding statuses and learning removal passed at ${width}px`);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
