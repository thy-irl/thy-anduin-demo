import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';

await mkdir('.impeccable/review/colors', { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const url = process.env.PREFLIGHT_TEST_URL || 'http://127.0.0.1:5180';
const style = (locator) =>
  locator.evaluate((el) => {
    const s = getComputedStyle(el);
    return {
      background: s.backgroundColor,
      color: s.color,
      height: el.getBoundingClientRect().height,
      font: parseFloat(s.fontSize),
      border: s.borderBottomColor,
      borderWidth: s.borderBottomWidth,
    };
  });
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: width === 390 ? 844 : 1000 },
    });
    const page = await context.newPage();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(url);
    const nav = page.getByRole('navigation', { name: 'Package', exact: true });
    const tab = (name) => nav.getByRole('button', { name: new RegExp(`^${name}(?:\\s+\\d+)?$`) });
    const capture = async (name) => {
      const colorIssues = await page.evaluate(() => {
        const hue = (color) => {
          const values = color.match(/[\d.]+/g)?.map(Number);
          if (!values || values.length < 3 || values[3] === 0) return null;
          const [r, g, b] = values.slice(0, 3).map((value) => value / 255);
          const max = Math.max(r, g, b),
            min = Math.min(r, g, b),
            delta = max - min;
          if (!delta) return null;
          const light = (max + min) / 2;
          const saturation = delta / (1 - Math.abs(2 * light - 1));
          let h =
            max === r
              ? ((g - b) / delta) % 6
              : max === g
                ? (b - r) / delta + 2
                : (r - g) / delta + 4;
          h = (h * 60 + 360) % 360;
          return { h, saturation };
        };
        const issues = [];
        for (const el of document.querySelectorAll('body *')) {
          if (!el.getClientRects().length) continue;
          const style = getComputedStyle(el);
          const properties = ['color', 'backgroundColor', 'borderTopColor', 'borderBottomColor'];
          if (style.outlineStyle !== 'none') properties.push('outlineColor');
          if (el.matches('input[type="checkbox"]')) properties.push('accentColor');
          for (const property of properties) {
            const value = style[property],
              tone = hue(value);
            if (tone && tone.h >= 240 && tone.h <= 330 && tone.saturation > 0.08)
              issues.push({
                reason: 'purple',
                tag: el.tagName,
                class: el.className?.toString(),
                property,
                value,
              });
          }
        }
        return issues;
      });
      assert.deepEqual(colorIssues, [], `${name}: no unused purple treatments`);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        path: `.impeccable/review/colors/${name}-${width}.png`,
        fullPage: true,
        animations: 'disabled',
      });
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
        false,
        `${name} fits ${width}`,
      );
    };
    for (const name of ['Documents', 'Review', 'Questions', 'Readiness']) {
      await tab(name).click();
      await capture(name.toLowerCase());
    }
    await tab('Questions').click();
    if (width === 1440) {
      const cdp = await context.newCDPSession(page);
      for (const type of ['protanopia', 'deuteranopia', 'tritanopia']) {
        await cdp.send('Emulation.setEmulatedVisionDeficiency', { type });
        assert.equal(await page.locator('.question-state').first().innerText(), 'Needs an answer');
        await page.screenshot({
          path: `.impeccable/review/colors/questions-${type}.png`,
          fullPage: true,
          animations: 'disabled',
        });
      }
      await cdp.send('Emulation.setEmulatedVisionDeficiency', { type: 'none' });
      await cdp.detach();
    }
    await page.mouse.move(0, 0);
    const filter = page.getByRole('button', { name: /^All questions/ });
    const action = page.getByRole('button', { name: 'Record answer', exact: true }).first();
    const selectedNav = await style(tab('Questions'));
    const selectedFilter = await style(filter);
    const primary = await style(action);
    assert.notEqual(
      selectedFilter.background,
      primary.background,
      'Filter must not look like a primary action',
    );
    assert.notEqual(
      selectedFilter.color,
      primary.color,
      'Blue selection and neutral answer action remain distinct',
    );
    assert.equal(primary.background, 'rgb(255, 255, 255)', 'Primary actions retain white surfaces');
    for (const answer of await page
      .getByRole('button', { name: 'Record answer', exact: true })
      .all()) {
      const colors = await style(answer);
      assert.equal(colors.color, 'rgb(34, 34, 34)', 'Every Record answer label uses neutral ink');
      assert.equal(colors.border, 'rgb(197, 202, 210)', 'Every Record answer border is neutral');
    }
    assert.equal(selectedNav.background, 'rgb(237, 244, 255)', 'Selection uses pale blue');
    assert.equal(
      selectedFilter.borderWidth,
      '2px',
      'Selected filter has a non-color underline cue',
    );
    assert.notEqual(
      selectedNav.background,
      primary.background,
      'Navigation selection is separate from action',
    );
    assert.ok(selectedFilter.font < primary.font, 'Filter text is quieter than primary actions');
    if (width === 1440)
      assert.ok(selectedFilter.height < primary.height, 'Desktop filter is shorter than action');
    else assert.ok(selectedFilter.height >= 44, 'Mobile filter preserves a touch target');
    assert.equal(
      (await style(page.getByRole('button', { name: 'Edit question', exact: true }).first())).color,
      'rgb(34, 34, 34)',
      'Secondary question actions use neutral ink',
    );
    assert.equal(
      (await style(page.getByRole('button', { name: 'New package', exact: true }))).border,
      'rgb(197, 202, 210)',
      'Global package creation has a quieter boundary',
    );
    assert.equal(
      (await style(page.locator('.package-summary > div:nth-child(2)'))).background,
      'rgb(241, 243, 246)',
      'Coverage uses the shared supporting neutral',
    );
    await tab('Documents').hover();
    assert.equal((await style(tab('Documents'))).background, 'rgb(237, 240, 244)');
    assert.equal((await style(tab('Questions'))).background, 'rgb(237, 244, 255)');
    await filter.hover();
    assert.notEqual((await style(filter)).background, primary.background);
    await page.keyboard.press('Tab');
    await filter.focus();
    assert.equal(
      await filter.evaluate((el) => getComputedStyle(el).outlineColor),
      'rgb(24, 90, 189)',
    );
    await action.click();
    const editor = page.getByRole('form', { name: 'Edit question & answer', exact: true });
    const selectedStep = await style(editor.getByRole('button', { name: /^2 Answer$/ }));
    assert.notEqual(
      selectedStep.background,
      (await style(editor.getByRole('button', { name: 'Save response', exact: true }))).background,
    );
    await capture('answer');
    await editor.getByRole('button', { name: /^3 Internal approval$/ }).click();
    await capture('approval');
    await editor.getByRole('button', { name: /^1 Question$/ }).click();
    await capture('draft');
    await editor.getByRole('button', { name: 'Cancel', exact: true }).click();
    await tab('Review').click();
    await page.locator('.finding-row').first().click();
    await page.getByRole('dialog', { name: 'Finding details', exact: true }).waitFor();
    await capture('finding');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Help', exact: true }).click();
    await capture('help');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Add / replace files', exact: true }).click();
    await capture('upload');
    await page.keyboard.press('Escape');
    await tab('Documents').click();
    await page.locator('.document-row').first().click();
    await capture('source-document');
    await page.keyboard.press('Escape');
    await page
      .getByRole('button', { name: /^Edit identity for/ })
      .first()
      .click();
    await capture('declaration');
    await page.getByRole('button', { name: 'Cancel context edit', exact: true }).click();
    await page.getByRole('button', { name: 'All packages', exact: true }).click();
    await capture('packages');
    assert.deepEqual(errors, []);
    await context.close();
  }
} finally {
  await browser.close();
}
console.log(
  'App palette audit passed: supplied blue actions and selection, no unused purple treatments, distinct control hierarchy, desktop/mobile routes, dialogs, Help, Packages and overflow.',
);
