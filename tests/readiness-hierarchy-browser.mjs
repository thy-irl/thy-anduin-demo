import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { makeDemo } from '../src/features/documents/demo.js';
import { analyzePackage } from '../src/features/analysis/engine.js';
import { evaluateReadiness } from '../src/features/readiness/readiness.js';

await mkdir('.impeccable/review/readiness-hierarchy', { recursive: true });
const pkg = makeDemo();
const eligible = structuredClone(pkg);
eligible.findings = eligible.findings.map((finding) => ({
  ...finding,
  status: 'dismissed',
  note: 'Synthetic original inspected; not applicable to this review.',
  history: [
    ...(finding.history || []),
    { event: 'Dismissed', status: 'dismissed', rationale: 'Synthetic reference reviewed.' },
  ],
}));
assert.equal(
  evaluateReadiness(eligible, analyzePackage(eligible.documents, eligible.intakeContext))
    .canAcknowledge,
  true,
);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  for (const width of [1440, 390]) {
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
    page.on('pageerror', (e) => errors.push(e.message));
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(process.env.PREFLIGHT_TEST_URL || 'http://127.0.0.1:5180');
    await page
      .locator('.finding-row')
      .filter({ has: page.getByRole('heading', { name: /Minimum investment amounts differ/i }) })
      .click();
    const source = page.locator('.review-source');
    assert.equal(
      await source.evaluate((el) => getComputedStyle(el).backgroundColor),
      'rgb(241, 243, 246)',
    );
    assert.equal(
      await page
        .locator('.source-selector > button.active')
        .evaluate((el) => getComputedStyle(el).backgroundColor),
      'rgb(237, 244, 255)',
    );
    await page.screenshot({
      path: `.impeccable/review/readiness-hierarchy/review-${width}.png`,
      animations: 'disabled',
    });
    await page.keyboard.press('Escape');
    const readiness = () =>
      page
        .getByRole('navigation', { name: 'Package', exact: true })
        .getByRole('button', { name: /^Readiness/ })
        .click();
    await readiness();
    const panel = page.getByRole('region', { name: 'Digitization readiness', exact: true });
    const progress = panel.getByRole('progressbar', {
      name: 'Readiness checks passed',
      exact: true,
    });
    await progress.waitFor();
    assert.equal(
      await panel.locator('.readiness-check-overview').evaluate((el) => el.tagName),
      'SECTION',
    );
    assert.equal(
      await panel.evaluate((el) => el.children[1].classList.contains('readiness-check-overview')),
      true,
      'Progress immediately follows the page heading',
    );
    assert.equal(await panel.locator('.readiness-checks > div').count(), 5);
    const responseActions = panel.getByRole('button', { name: 'Record response', exact: true });
    assert.ok((await responseActions.count()) > 1);
    for (const action of await responseActions.all()) {
      const colors = await action.evaluate((el) => {
        const style = getComputedStyle(el);
        return { text: style.color, border: style.borderColor };
      });
      assert.deepEqual(
        colors,
        {
          text: 'rgb(34, 34, 34)',
          border: 'rgb(197, 202, 210)',
        },
        'Every blocker response action has the same neutral treatment',
      );
    }
    const confirm = page.getByRole('button', {
      name: 'Acknowledge internal readiness',
      exact: true,
    });
    assert.equal(await confirm.isDisabled(), true);
    assert.equal(
      await confirm.evaluate((el) => getComputedStyle(el).backgroundColor),
      'rgb(241, 243, 246)',
    );
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: `.impeccable/review/readiness-hierarchy/blocked-${width}.png`,
      fullPage: true,
      animations: 'disabled',
    });
    await page.evaluate(
      (pkg) =>
        localStorage.setItem(
          'anduin-preflight-v1',
          JSON.stringify({ packages: [pkg], activeId: pkg.id }),
        ),
      eligible,
    );
    await page.reload();
    await readiness();
    assert.equal(await progress.getAttribute('value'), '4');
    await page.getByLabel('Readiness recorded by', { exact: true }).fill('Synthetic reviewer');
    await page
      .getByLabel('Readiness rationale', { exact: true })
      .fill('Current package reviewed for internal handoff.');
    await page
      .getByLabel('Manual coverage review', { exact: true })
      .fill('Originals and requirements outside automated checks inspected.');
    assert.equal(await confirm.isDisabled(), true, 'Consent remains required');
    await page
      .getByRole('checkbox', {
        name: 'I acknowledge this current package for internal digitization handoff',
        exact: true,
      })
      .check();
    assert.equal(await confirm.isEnabled(), true);
    assert.equal(
      await confirm.evaluate((el) => getComputedStyle(el).backgroundColor),
      'rgb(253, 160, 80)',
    );
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: `.impeccable/review/readiness-hierarchy/eligible-${width}.png`,
      fullPage: true,
      animations: 'disabled',
    });
    await confirm.click();
    await page
      .getByRole('heading', { name: 'Current internal acknowledgement', exact: true })
      .waitFor();
    assert.equal(await progress.getAttribute('value'), '5');
    assert.equal(await confirm.count(), 0);
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
    assert.deepEqual(errors, []);
    await context.close();
  }
} finally {
  await browser.close();
}
console.log(
  'Readiness hierarchy passed: blue source selection, visible top progress, blocked/eligible final action, consent gate, acknowledgement and updated progress on desktop/mobile.',
);
