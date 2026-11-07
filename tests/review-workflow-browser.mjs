import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { chromium } from '@playwright/test';
import { analyze } from '../src/features/analysis/engine.js';
import { findingCopy } from '../src/features/analysis/copy.js';
import { agreementText, memorandumText } from './fixtures/review-sources.js';

const documents = [agreementText('250,000'), memorandumText].map((text, i) => ({
  id: `source-${i}`,
  name: i ? 'Memorandum.txt' : 'Agreement.txt',
  type: 'TXT',
  version: 1,
  pages: [{ number: 1, text, status: 'searchable text' }],
}));
const pkg = {
  id: 'review-workflow',
  name: 'Review workflow regression',
  documents,
  findings: analyze(documents),
  activity: [],
  createdAt: new Date().toISOString(),
};
const finding = pkg.findings.find((f) => f.checkId === 'value_mismatch');
assert.ok(finding?.evidence.length >= 2);
let browser;
before(async () => {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
});
after(async () => {
  await browser?.close();
});

async function workspace(run, viewport = { width: 1440, height: 1000 }) {
  const context = await browser.newContext({ viewport });
  context.setDefaultTimeout(5000);
  try {
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
    await page.goto(process.env.PREFLIGHT_TEST_URL || 'http://127.0.0.1:5188');
    await run(page);
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
  }
}
const savedPackage = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('anduin-preflight-v1')).packages[0]);
const openFinding = async (page) => {
  await page
    .getByRole('button', { name: `Review ${findingCopy(finding).title}`, exact: true })
    .click();
  return page.getByRole('dialog', { name: 'Finding details', exact: true });
};

test('Questions navigation opens the answer queue directly', () =>
  workspace(async (page) => {
    await page
      .getByRole('navigation', { name: 'Package', exact: true })
      .getByRole('button', { name: /^Questions(?:\s+\d+)?$/ })
      .click();
    assert.equal(
      await page
        .getByRole('navigation', { name: 'Package', exact: true })
        .getByRole('button', { name: /^Questions(?:\s+\d+)?$/ })
        .getAttribute('aria-current'),
      'page',
    );
    await page.getByRole('region', { name: 'Questions and answers', exact: true }).waitFor();
    assert.ok(await page.getByRole('button', { name: 'Record answer', exact: true }).count());
    assert.equal(
      await page.locator('#context-decisions').evaluate((el) => {
        const rect = el.getBoundingClientRect();
        return rect.top >= 0 && rect.top < innerHeight;
      }),
      true,
    );
  }));

test('dismissal rejects an empty reason, focuses the note and persists a valid rationale', () =>
  workspace(async (page) => {
    const dialog = await openFinding(page);
    const note = dialog.getByLabel('Reviewer note', { exact: true });
    for (const value of ['', ' \n ']) {
      await note.fill(value);
      await dialog.getByRole('button', { name: 'Dismiss finding', exact: true }).click();
      await dialog
        .getByRole('alert')
        .filter({ hasText: /reason.*dismiss/i })
        .waitFor();
      assert.equal(await note.getAttribute('aria-invalid'), 'true');
      assert.equal(await note.evaluate((el) => el === document.activeElement), true);
      assert.equal(
        (await savedPackage(page)).findings.find((f) => f.id === finding.id).status,
        finding.status,
      );
    }
    await note.fill('  Not applicable to the reviewed investor class.  ');
    await dialog.getByRole('button', { name: 'Dismiss finding', exact: true }).click();
    await dialog.getByRole('button', { name: 'Reopen', exact: true }).waitFor();
    const saved = (await savedPackage(page)).findings.find((f) => f.id === finding.id);
    assert.equal(saved.status, 'dismissed');
    assert.equal(saved.history.at(-1).rationale, 'Not applicable to the reviewed investor class.');
    await page.reload();
    const reopened = await openFinding(page);
    await reopened.getByRole('button', { name: 'Reopen', exact: true }).click();
    await reopened.getByRole('button', { name: 'Confirm issue', exact: true }).waitFor();
  }));

test('Save response rejects empty text and preserves the editor and provenance', () =>
  workspace(async (page) => {
    const dialog = await openFinding(page);
    await dialog.getByRole('button', { name: 'Record response', exact: true }).click();
    const form = page.getByRole('form', { name: 'Edit question & answer', exact: true });
    await form.locator('.question-response-details > summary').click();
    await form.getByLabel('Who provided the response', { exact: true }).fill('Synthetic counsel');
    const response = form.getByLabel('Response text', { exact: true });
    for (const text of ['', ' \n ']) {
      await response.fill(text);
      await form.getByRole('button', { name: 'Save response', exact: true }).click();
      await form
        .getByRole('alert')
        .filter({ hasText: /enter.*response text/i })
        .waitFor();
      assert.equal(await response.getAttribute('aria-invalid'), 'true');
      assert.equal(await response.evaluate((el) => el === document.activeElement), true);
      assert.equal(
        await form.getByLabel('Who provided the response', { exact: true }).inputValue(),
        'Synthetic counsel',
      );
      assert.equal((await savedPackage(page)).intakeContext.decisions.length, 0);
    }
    await response.fill('Verify the applicable investor class before selecting a minimum.');
    await form.getByRole('button', { name: 'Save response', exact: true }).click();
    await form.waitFor({ state: 'detached' });
    await page.reload();
    const saved = (await savedPackage(page)).intakeContext.decisions[0];
    assert.equal(saved.response.author, 'Synthetic counsel');
    assert.equal(saved.routingStatus, 'response-recorded');
    assert.equal(saved.approval, null);
  }));

for (const viewport of [
  { width: 1440, height: 1000 },
  { width: 390, height: 844 },
])
  test(`response entry keeps both citations and the selected source at ${viewport.width}px`, () =>
    workspace(async (page) => {
      const dialog = await openFinding(page);
      await dialog.locator('.source-selector button').nth(1).click();
      await dialog.getByRole('button', { name: 'Record response', exact: true }).click();
      const form = page.getByRole('form', { name: 'Edit question & answer', exact: true });
      const evidence = form.getByRole('region', {
        name: 'Question and source evidence',
        exact: true,
      });
      await evidence.waitFor();
      await evidence.locator('.question-evidence-details > summary').click();
      assert.ok((await evidence.innerText()).includes(findingCopy(finding).question));
      for (const source of finding.evidence) {
        assert.ok((await evidence.innerText()).includes(source.text));
        assert.ok((await evidence.innerText()).includes(source.document));
      }
      const draft = 'Unsaved response remains while I check the source.';
      await form.getByLabel('Response text', { exact: true }).fill(draft);
      if (process.env.PREFLIGHT_WORKFLOW_CAPTURE) {
        await form.evaluate((el) => el.scrollIntoView({ block: 'start' }));
        await page.screenshot({ path: `/tmp/preflight-p1-response-${viewport.width}.png` });
      }
      await evidence.getByRole('button', { name: /^Return to finding:/ }).click();
      const returned = page.getByRole('dialog', { name: 'Finding details', exact: true });
      assert.equal(
        await returned.locator('.source-selector button').nth(1).getAttribute('aria-pressed'),
        'true',
      );
      await returned.getByRole('button', { name: 'Close finding details', exact: true }).click();
      assert.equal(await form.getByLabel('Response text', { exact: true }).inputValue(), draft);
      await evidence.getByRole('button', { name: /^Return to finding:/ }).click();
      await page
        .getByRole('dialog', { name: 'Finding details', exact: true })
        .getByRole('button', { name: 'Record response', exact: true })
        .click();
      assert.equal(await form.getByLabel('Response text', { exact: true }).inputValue(), draft);
      await form.getByRole('button', { name: 'Save response', exact: true }).click();
      await form.waitFor({ state: 'detached' });
      const saved = (await savedPackage(page)).intakeContext.decisions[0];
      assert.equal(saved.source.documentId, finding.evidence[1].documentId);
      assert.equal(saved.source.quote, finding.evidence[1].text);
      assert.equal(saved.approval, null);
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
        false,
      );
    }, viewport));
