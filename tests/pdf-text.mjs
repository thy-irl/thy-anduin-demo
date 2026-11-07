import { readFile } from 'node:fs/promises';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

export async function readPdfText(path) {
  const bytes = await readFile(path);
  if (bytes.subarray(0, 5).toString() !== '%PDF-') throw new Error('Download is not a PDF');
  const loadingTask = getDocument({ data: new Uint8Array(bytes), useSystemFonts: true });
  const document = await loadingTask.promise;
  try {
    const pages = [];
    for (let i = 1; i <= document.numPages; i++) {
      const page = await document.getPage(i);
      const text = await page.getTextContent();
      pages.push(text.items.map((item) => item.str || '').join(' '));
    }
    return pages.join('\n').replace(/\s+/g, ' ');
  } finally {
    await loadingTask.destroy();
  }
}
