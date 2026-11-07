import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const failures = [];
  for (const width of [1440, 720, 390, 320]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 } });
    const page = await context.newPage();
    await page.goto(process.env.PREFLIGHT_TEST_URL || 'http://127.0.0.1:5177');
    for (const tab of ['Review', 'Documents', 'Questions', 'Readiness']) {
      await page
        .getByRole('navigation', { name: 'Package', exact: true })
        .getByRole('button', { name: new RegExp(`^${tab}(?:\\s+\\d+)?$`) })
        .click();
      if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth))
        failures.push({ width, tab, reason: 'overflow' });
      const issues = await page.evaluate(() => {
        const rgb = (s) => (s.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
        const luminance = (c) =>
          c
            .map((n) => n / 255)
            .map((n) => (n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4))
            .reduce((a, n, i) => a + n * [0.2126, 0.7152, 0.0722][i], 0);
        const result = [];
        for (const el of document.querySelectorAll(
          'main p, main span, main small, main label, main button, main summary, main dt, main dd',
        )) {
          if (
            !el.getClientRects().length ||
            el.closest('[disabled]') ||
            ![...el.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim())
          )
            continue;
          const style = getComputedStyle(el);
          if (parseFloat(style.fontSize) < 14)
            result.push({
              reason: 'small',
              size: style.fontSize,
              selector: el.className,
              text: el.textContent.trim().slice(0, 60),
            });
          let parent = el,
            background;
          while (parent) {
            const value = getComputedStyle(parent).backgroundColor;
            if (!value.endsWith(', 0)') && value !== 'transparent') {
              background = value;
              break;
            }
            parent = parent.parentElement;
          }
          if (!background) continue;
          const a = luminance(rgb(style.color)),
            b = luminance(rgb(background));
          const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
          if (ratio < 4.5)
            result.push({
              reason: 'contrast',
              ratio: +ratio.toFixed(2),
              selector: el.className,
              text: el.textContent.trim().slice(0, 60),
            });
        }
        return result;
      });
      failures.push(...issues.map((issue) => ({ width, tab, ...issue })));
    }
    await context.close();
  }
  assert.deepEqual(failures, [], 'Text must reflow, remain >=14px and meet 4.5:1 contrast');
  console.log(
    'Typography checks passed: four screens at 1440/720/390/320px; functional text >=14px, contrast >=4.5:1 and no horizontal overflow. 720px exercises the reflow width of a 1440px viewport at 200% zoom.',
  );
} finally {
  await browser.close();
}
