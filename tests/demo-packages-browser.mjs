import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';
import fs from 'node:fs/promises';
const url = process.env.PREFLIGHT_TEST_URL || 'http://127.0.0.1:5182';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [];
const output = '.impeccable/review/demo-packages';
await fs.mkdir(output, { recursive: true });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(url);
  await page.getByRole('heading', { name: 'Cedar Harbor — Open findings', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Packages', exact: true }).click();
  await page
    .getByRole('heading', { name: 'Willow Quay — Ready to hand off', exact: true })
    .waitFor();
  assert.equal(await page.locator('.package-card .readiness-state-ready').count(), 1);
  await page.screenshot({ path: `${output}/packages-desktop.png`, fullPage: true });
  await page.getByRole('button', { name: /Willow Quay — Ready to hand off/ }).click();
  await page.getByRole('button', { name: /Readiness/ }).click();
  await page.screenshot({ path: `${output}/ready-desktop.png`, fullPage: true });
  const result = await page.evaluate(async () => {
    const { getOriginal } = await import('/src/features/documents/originals.js');
    const { pdfLibrary } = await import('/src/features/documents/parser.js');
    const s = JSON.parse(localStorage.getItem('anduin-preflight-v1'));
    const ready = s.packages.find((p) => p.id === 'willow-quay-ready-demo');
    const pdfjs = await pdfLibrary();
    const blob = await getOriginal(ready.documents[0].originalKey);
    const task = pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) });
    const pdf = await task.promise;
    const count = pdf.numPages;
    await task.destroy();
    return { count, packages: s.packages.length };
  });
  assert.ok(result.count > 0);
  assert.equal(result.packages, 3);
  await page.reload();
  await page
    .getByRole('heading', { name: 'Willow Quay — Ready to hand off', exact: true })
    .waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Packages', exact: true }).click();
  await page.screenshot({ path: `${output}/packages-mobile.png`, fullPage: true });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await page.getByRole('button', { name: /Willow Quay — Ready to hand off/ }).click();
  await page.getByRole('button', { name: /Readiness/ }).click();
  await page.screenshot({ path: `${output}/ready-mobile.png`, fullPage: true });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: 'Packages', exact: true }).click();
  await page.getByRole('button', { name: /Alder Point — Package requirements/ }).click();
  await page.getByRole('button', { name: /^Documents/ }).click();
  await page
    .getByRole('button', { name: 'Edit Exhibit D — Beneficial Ownership', exact: true })
    .click();
  const form = page
    .locator('form')
    .filter({ has: page.getByRole('heading', { name: 'Package requirement', exact: true }) });
  await expect(form.getByLabel('Required / referenced item')).toHaveValue(
    'Exhibit D — Beneficial Ownership',
  );
  await expect(form.getByLabel('Responsible owner')).toHaveValue('Fund operations team (demo)');
  await expect(form.getByLabel('Supplied document')).toHaveValue('');
  await expect(form.getByLabel('Source document', { exact: true })).toHaveValue(
    'alder-point-instructions',
  );
  await expect(form.getByLabel('Source quote')).toHaveValue(
    'Entity investors must supply Exhibit D — Beneficial Ownership with this package.',
  );
  await expect(form.getByText('Source current', { exact: true })).toBeVisible();
  await form.scrollIntoViewIfNeeded();
  await form.screenshot({ path: `${output}/requirement-prefilled-desktop.png` });
  await page.setViewportSize({ width: 390, height: 844 });
  await form.screenshot({ path: `${output}/requirement-prefilled-mobile.png` });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await form.getByRole('button', { name: 'Save entry', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: /^Documents/ }).click();
  await page.getByRole('button', { name: 'Edit Ownership Chart', exact: true }).click();
  await expect(page.getByLabel('Supplied document')).toHaveValue('alder-point-ownership-chart');
  const original = await page.evaluate(async () => {
    const { getOriginal } = await import('/src/features/documents/originals.js');
    return (await getOriginal('alder-point-instructions-v1')).text();
  });
  assert.ok(original.includes('Entity investors must supply Exhibit D'));
  await context.close();
  const existing = await browser.newContext();
  await existing.addInitScript(() => {
    if (!localStorage.getItem('anduin-preflight-v1'))
      localStorage.setItem(
        'anduin-preflight-v1',
        JSON.stringify({
          activeId: 'saved',
          packages: [
            {
              id: 'saved',
              name: 'Saved work',
              documents: [],
              findings: [],
              activity: [],
              scoping: { preserve: 'legacy' },
            },
          ],
        }),
      );
  });
  const old = await existing.newPage();
  old.on('pageerror', (e) => errors.push(e.message));
  await old.goto(url);
  await old.getByRole('button', { name: 'Packages', exact: true }).click();
  await old.getByRole('button', { name: 'Add demo packages', exact: true }).click();
  await old
    .getByRole('heading', { name: 'Willow Quay — Ready to hand off', exact: true })
    .waitFor();
  assert.equal(await old.locator('.package-card').count(), 4);
  const retained = await old.evaluate(() =>
    JSON.parse(localStorage.getItem('anduin-preflight-v1')),
  );
  assert.equal(retained.activeId, 'saved');
  assert.deepEqual(retained.packages[0].scoping, { preserve: 'legacy' });
  assert.deepEqual(errors, []);
  console.log(
    'Demo browser checks passed: default states, original PDF, persistence, mobile layout and saved-work preservation.',
  );
} finally {
  await browser.close();
}
