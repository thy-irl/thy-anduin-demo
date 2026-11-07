import assert from 'node:assert/strict';
import test from 'node:test';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { makeDemo } from '../src/features/documents/demo.js';
import { analyzePackage } from '../src/features/analysis/engine.js';
import { reportData } from '../src/features/review/review.js';
import { createReviewSummaryPdf, reviewSummaryDefinition } from '../src/features/review/pdf.js';

test('PDF summary retains unselected findings, exact Unicode quotations and review limits across pages', async () => {
  const pkg = makeDemo();
  pkg.name = 'Synthetic Nguyễn — Review';
  pkg.findings.forEach((f) => {
    f.includeInReport = false;
  });
  const quote = '“Quoted evidence” — €250,000 · Nguyễn\nSecond line of evidence.';
  pkg.findings[0].evidence[0].text = quote;
  pkg.findings[0].note = 'Long review note. '.repeat(500) + 'FINAL_NOTE_SENTINEL';
  pkg.intakeContext = { tasks: [{ id: 'inactive', title: 'INACTIVE_PLAN_SENTINEL' }] };
  const data = reportData(pkg, analyzePackage(pkg.documents, pkg.intakeContext), {
    allFindings: true,
  });
  const before = JSON.stringify(data);
  const definition = reviewSummaryDefinition(data);
  assert.ok(definition.content.some((item) => item.text === quote));
  const blob = await createReviewSummaryPdf(data);
  assert.equal(blob.type, 'application/pdf');
  const bytes = new Uint8Array(await blob.arrayBuffer());
  assert.equal(new TextDecoder().decode(bytes.slice(0, 5)), '%PDF-');
  const loadingTask = getDocument({ data: bytes, useSystemFonts: true });
  const pdf = await loadingTask.promise;
  try {
    assert.ok(pdf.numPages > 2, 'Long reports must paginate');
    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const contents = await page.getTextContent();
      text += contents.items.map((item) => item.str || '').join(' ') + '\n';
    }
    assert.match(text, /Nguyễn/);
    assert.match(text, /“Quoted evidence” — €250,000/);
    assert.match(text, /FINAL_NOTE_SENTINEL/);
    assert.match(text, /Internal review status:\s+BLOCKED/);
    assert.match(text, /not legal approval/);
    for (const f of data.findings) assert.ok(text.includes(f.title), f.title);
    assert.equal(text.includes('INACTIVE_PLAN_SENTINEL'), false);
    assert.equal(JSON.stringify(data), before);
  } finally {
    await loadingTask.destroy();
  }
});

test('PDF contents link to the actual section pages and omit absent sections', async () => {
  const pkg = makeDemo();
  const data = reportData(pkg, analyzePackage(pkg.documents, pkg.intakeContext), {
    allFindings: true,
  });
  const definition = reviewSummaryDefinition(data);
  assert.ok(definition.content.some((item) => item.toc));
  const sections = definition.content.filter((item) => item.tocItem).map((item) => item.text);
  assert.ok(sections.includes('Findings'));
  assert.ok(!sections.includes('Source revision history'));
  const blob = await createReviewSummaryPdf(data);
  const task = getDocument({
    data: new Uint8Array(await blob.arrayBuffer()),
    useSystemFonts: true,
  });
  const pdf = await task.promise;
  try {
    const cover = await pdf.getPage(1);
    const coverText = (await cover.getTextContent()).items.map((item) => item.str || '').join(' ');
    assert.match(coverText, /Contents/);
    const links = (await cover.getAnnotations()).filter(
      (item) => item.subtype === 'Link' && item.dest,
    );
    assert.ok(links.length >= sections.length);
    const destinations = [...new Set(links.map((item) => item.dest))];
    assert.equal(destinations.length, sections.length);
    for (const [index, destination] of destinations.entries()) {
      const target = await pdf.getDestination(destination);
      const pageNumber = (await pdf.getPageIndex(target[0])) + 1;
      assert.ok(pageNumber > 1);
      const page = await pdf.getPage(pageNumber);
      const text = (await page.getTextContent()).items.map((item) => item.str || '').join(' ');
      assert.ok(text.includes(sections[index]), sections[index]);
      assert.match(coverText, new RegExp(`${sections[index]}\\s+${pageNumber}`));
    }
  } finally {
    await task.destroy();
  }
});
