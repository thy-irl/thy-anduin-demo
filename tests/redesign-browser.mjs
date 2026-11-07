import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const output = '.impeccable/review';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  for (const [device, width, height] of [
    ['desktop', 1440, 1000],
    ['mobile', 390, 844],
  ]) {
    const context = await browser.newContext({ viewport: { width, height } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(process.env.PREFLIGHT_TEST_URL || 'http://127.0.0.1:5177');
    for (const label of ['Review', 'Documents', 'Questions', 'Readiness']) {
      await page
        .getByRole('navigation', { name: 'Package', exact: true })
        .getByRole('button', { name: new RegExp(`^${label}(?:\\s+\\d+)?$`) })
        .click();
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        path: `${output}/${device}${label === 'Review' ? '' : `-${label.toLowerCase()}`}.png`,
        fullPage: true,
        animations: 'disabled',
      });
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
        false,
        `${device} ${label} must fit the viewport`,
      );
    }
    await page
      .getByRole('navigation', { name: 'Package', exact: true })
      .getByRole('button', { name: /^Questions\s/ })
      .click();
    await page.locator('.question-download > summary').click();
    const selection = page.getByRole('checkbox', {
      name: /Include Minimum investment amounts differ/,
    });
    await selection.check();
    await page.getByRole('button', { name: 'Download 1 question', exact: true }).waitFor();
    await selection.uncheck();
    await page
      .getByRole('navigation', { name: 'Package', exact: true })
      .getByRole('button', { name: /^Review\s/ })
      .click();
    await page.getByRole('button', { name: /Review Minimum investment amounts differ/ }).click();
    const dialog = page.getByRole('dialog', { name: 'Finding details', exact: true });
    await dialog.waitFor();
    await page.screenshot({
      path: `${output}/${device}-evidence.png`,
      fullPage: false,
      animations: 'disabled',
    });
    if (device === 'mobile') {
      assert.equal(
        await page.locator('.source-content').evaluate((el) => getComputedStyle(el).overflowY),
        'visible',
      );
      assert.equal(
        await page.locator('.review-editor').evaluate((el) => getComputedStyle(el).overflowY),
        'visible',
      );
      assert.equal(
        await page.locator('.review-body').evaluate((el) => getComputedStyle(el).overflowY),
        'auto',
      );
    }
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'detached' });
    assert.match(await page.locator(':focus').getAttribute('aria-label'), /Review Minimum/);
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log(
    'Redesign browser checks passed: four screens at desktop/mobile, no overflow, one mobile evidence scroll region, Escape and focus restoration.',
  );
} finally {
  await browser.close();
}
