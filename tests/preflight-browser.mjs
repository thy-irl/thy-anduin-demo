import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { analyze } from '../src/features/analysis/engine.js';

const documents = [
  {
    id: 'agreement',
    name: 'Agreement.txt',
    type: 'TXT',
    version: 1,
    pages: [{ number: 1, text: 'Each beneficial owner must disclose ownership percentage.' }],
  },
  {
    id: 'form',
    name: 'Entity Form.txt',
    type: 'TXT',
    version: 1,
    pages: [{ number: 1, text: 'Entity Form\nName: ____\nAddress: ____' }],
  },
];
const pkg = {
  id: 'rules-smoke',
  name: 'Rule checks',
  documents,
  findings: analyze(documents),
  activity: [],
  createdAt: new Date().toISOString(),
};
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const context = await browser.newContext();
  await context.addInitScript(
    (state) => {
      if (!localStorage.getItem('anduin-preflight-v1'))
        localStorage.setItem('anduin-preflight-v1', JSON.stringify(state));
    },
    { packages: [pkg], activeId: pkg.id },
  );
  const page = await context.newPage(),
    errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(process.env.PREFLIGHT_TEST_URL || 'http://127.0.0.1:5176');
  assert.equal(
    await page.getByRole('button', { name: 'Requirements & work plan', exact: false }).count(),
    0,
  );
  await page.getByRole('button', { name: /^Documents\s+\d+$/ }).click();
  await page.getByRole('button', { name: 'Add requirement', exact: true }).click();
  await page.getByLabel('Required / referenced item', { exact: true }).fill('Ownership percentage');
  await page.getByLabel('Rule check', { exact: true }).selectOption('field');
  await page.getByLabel('Supplied document', { exact: true }).selectOption('form');
  await page.getByLabel('Source document', { exact: true }).selectOption('agreement');
  await page.getByLabel('Source quote', { exact: true }).fill(documents[0].pages[0].text);
  await page.getByRole('button', { name: 'Save entry', exact: true }).click();
  await page.getByRole('button', { name: /^Review\s+\d+$/ }).click();
  const finding = page.getByRole('button', { name: /Review Required field not found/ });
  await finding.waitFor();
  await finding.click();
  await page
    .getByRole('dialog', { name: 'Finding details', exact: true })
    .getByText('About this check', { exact: true })
    .click();
  await page.getByText('Detection method & original wording', { exact: true }).click();
  await page.getByText('required_field_missing', { exact: false }).first().waitFor();
  await page.getByRole('button', { name: 'Close finding details', exact: true }).click();
  await page.reload();
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem('anduin-preflight-v1')));
  const saved = state.packages.find((p) => p.id === 'rules-smoke');
  assert.equal(saved.intakeContext.requirements[0].check, 'field');
  assert.equal(
    saved.findings.find((f) => f.checkId === 'required_field_missing').detectionStatus,
    'detected',
  );
  assert.deepEqual(errors, []);
  console.log(
    'Browser smoke passed: configure required field, review exact evidence, persist result, reload.',
  );
} finally {
  await browser.close();
}
