import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { makeDemo } from '../src/features/documents/demo.js';

await mkdir('.impeccable/review', { recursive: true });
const pkg = makeDemo();
pkg.name = 'Synthetic finding writing review';
const corrected = pkg.findings[0];
corrected.status = 'resolved';
corrected.evidence[0].section =
  '2. Provide all required due diligence documentation for the applicable investor and application route';
corrected.resolutionEvidence = [corrected.evidence[0], corrected.evidence[0]];
pkg.intakeContext = {
  decisions: [
    {
      id: 'synthetic-response',
      title: 'Synthetic attachment response',
      question: corrected.question,
      findingIds: [corrected.id],
      response: {
        text: 'Synthetic response: attachment content reviewed against the cited source.',
      },
      routingStatus: 'response-recorded',
    },
  ],
};
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: width === 390 ? 844 : 1000 },
    });
    await context.addInitScript(
      (pkg) =>
        localStorage.setItem(
          'anduin-preflight-v1',
          JSON.stringify({ packages: [pkg], activeId: pkg.id }),
        ),
      pkg,
    );
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(process.env.PREFLIGHT_TEST_URL || 'http://127.0.0.1:5177');
    const findings = page.locator('.finding-row');
    assert.equal(await findings.count(), pkg.findings.length);
    for (let i = 0; i < pkg.findings.length; i++) {
      await findings.nth(i).click();
      const dialog = page.getByRole('dialog', { name: 'Finding details', exact: true });
      await dialog.waitFor();
      assert.equal(
        (await dialog.getByLabel('Question for counsel', { exact: true }).inputValue()) !== '',
        true,
      );
      assert.equal(await dialog.locator('.record-trace').evaluate((el) => el.open), false);
      assert.equal(
        await dialog.locator('.review-help strong').evaluate((el) => getComputedStyle(el).color),
        'rgb(32, 42, 44)',
      );
      assert.equal(await dialog.evaluate((el) => el.scrollWidth > el.clientWidth), false);
      if (i === 0) {
        await dialog.getByText('Corrected source found', { exact: true }).waitFor();
        assert.equal(await dialog.locator('.finding-explanation').evaluate((el) => el.open), false);
        assert.equal(
          await dialog.locator('.finding-work-context').evaluate((el) => el.open),
          false,
        );
        await page.screenshot({
          path: `.impeccable/review/writing-resolved-${width}.png`,
          animations: 'disabled',
        });
        await dialog.locator('.record-trace > summary').click();
        assert.equal(await dialog.locator('.trace-source[open]').count(), 0);
        const correctedGroup = dialog.locator('.trace-group').filter({
          has: page.getByRole('heading', { name: 'Corrected-source citations', exact: true }),
        });
        assert.equal(
          await correctedGroup.locator('.trace-source').count(),
          1,
          'Repeated identical citations are displayed once',
        );
        const quote = dialog.locator('.trace-source').first();
        assert.equal(
          (await quote.locator('summary').innerText()).includes(corrected.evidence[0].section),
          false,
        );
        await quote.locator('summary').click();
        assert.ok(
          (await quote.locator('.trace-section').innerText()).includes(
            corrected.evidence[0].section,
          ),
        );
        assert.equal(await quote.locator('blockquote').textContent(), corrected.evidence[0].text);
        await quote.locator('summary').click();
        await dialog.locator('.check-overview > summary').click();
        assert.equal(await dialog.locator('.check-diagnostics').evaluate((el) => el.open), false);
        assert.equal(await dialog.locator('.check-limits').evaluate((el) => el.open), false);
        assert.equal(await dialog.locator('.check-overview > .check-facts > div').count(), 2);
        await dialog
          .locator('.record-trace')
          .evaluate((el) => el.scrollIntoView({ block: 'start' }));
        await page.screenshot({
          path: `.impeccable/review/writing-record-${width}.png`,
          animations: 'disabled',
        });
        await dialog
          .locator('.check-overview')
          .evaluate((el) => el.scrollIntoView({ block: 'start' }));
        await page.screenshot({
          path: `.impeccable/review/writing-check-${width}.png`,
          animations: 'disabled',
        });
      } else if (i === 1) {
        await page.screenshot({
          path: `.impeccable/review/writing-open-${width}.png`,
          animations: 'disabled',
        });
      }
      await page.keyboard.press('Escape');
      await dialog.waitFor({ state: 'detached' });
    }
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log(
    'Finding writing checks passed: every demo finding at desktop/mobile, open/resolved guidance, neutral text, collapsed response/source records, exact quotations and duplicate-citation presentation.',
  );
} finally {
  await browser.close();
}
